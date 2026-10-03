"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { markLeadSent } from "@/lib/article-lead-memory";
import { captureAttribution, readAttribution } from "@/lib/lead-attribution";
import { LEAD_LIMITS, isValidPhone, normalizePhone, type QuizContext } from "@/lib/lead-validation";
import {
  GOAL_CAPTCHA_UNAVAILABLE,
  GOAL_FORM_ERROR,
  GOAL_FORM_SUBMIT,
  reachGoal,
} from "@/lib/analytics";

/**
 * Вся логика заявки: поля, валидация, капча, отправка и состояния.
 *
 * Модалка на первом и последнем экранах и встроенная форма под результатом квиза
 * используют один и тот же хук. Раньше логика жила внутри модалки, и встроить ту же
 * форму в другое место можно было только копированием — а копия неизбежно разошлась бы
 * с оригиналом.
 */

export type LeadFormStatus = "idle" | "sending" | "success" | "error";

/** Сколько ждём токен капчи, прежде чем отправить заявку без него.
 *  Бесконечное ожидание — это молча потерянная заявка, поэтому ожидание ограничено. */
const CAPTCHA_WAIT_MS = 6000;

/** Зависший запрос не должен навсегда оставить кнопку в состоянии «Отправляем…». */
const REQUEST_TIMEOUT_MS = 15000;

const DEFAULT_ERROR = "Не удалось отправить заявку. Попробуйте ещё раз или позвоните нам.";

/** Причины отказа для Метрики. Свободного текста и персональных данных здесь быть не может. */
type ErrorReason = "validation" | "network" | "timeout" | "http" | "rejected";

export function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("8") || digits.startsWith("7") ? digits.slice(1) : digits;
  return withoutCountry.slice(0, 10);
}

/** Маска +7 (900) 000-00-00 для поля ввода. */
export function formatPhone(value: string) {
  const digits = getPhoneDigits(value);

  if (!digits.length) {
    return "";
  }

  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const firstPair = digits.slice(6, 8);
  const secondPair = digits.slice(8, 10);

  let formatted = "+7";

  if (area) {
    formatted += ` (${area}`;
  }

  if (area.length === 3) {
    formatted += ")";
  }

  if (prefix) {
    formatted += ` ${prefix}`;
  }

  if (firstPair) {
    formatted += `-${firstPair}`;
  }

  if (secondPair) {
    formatted += `-${secondPair}`;
  }

  return formatted;
}

type UseLeadFormOptions = {
  /** Человекочитаемая метка места, откуда пришла заявка. */
  source: string;
  /** Ответы квиза, если форма показана под расчётом. */
  quiz?: QuizContext | null;
};

export function useLeadForm({ source, quiz = null }: UseLeadFormOptions) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Капчу монтируем только после того, как человек начал заполнять форму: до этого
  // грузить сторонний скрипт незачем — он замедляет страницу всем, включая тех,
  // кто до формы не дойдёт.
  const [captchaArmed, setCaptchaArmed] = useState(false);
  const [captchaVisible, setCaptchaVisible] = useState(false);
  const [captchaNonce, setCaptchaNonce] = useState(0);

  const captchaTokenRef = useRef("");
  const captchaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Одна попытка отправки = максимум один запрос. Раньше флаг «отправка идёт» снимался
   * в `finally`, и колбэк капчи, пришедший после сработавшего таймаута, отправлял заявку
   * второй раз — в Telegram падал дубль, а `lead_form_submit` засчитывался дважды.
   */
  const dispatchedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // Форма есть на странице с первого рендера, поэтому метки рекламы забираем здесь:
    // к моменту отправки роутер уже успевает вычистить `utm_*` и `yclid` из адреса.
    captureAttribution();
    return () => {
      mountedRef.current = false;
      if (captchaTimerRef.current) {
        clearTimeout(captchaTimerRef.current);
        captchaTimerRef.current = null;
      }
    };
  }, []);

  const clearCaptchaTimer = useCallback(() => {
    if (captchaTimerRef.current) {
      clearTimeout(captchaTimerRef.current);
      captchaTimerRef.current = null;
    }
  }, []);

  /** Вызывается при первом касании формы — с этого момента капче есть смысл прогреваться. */
  const armCaptcha = useCallback(() => {
    setCaptchaArmed(true);
  }, []);

  const fail = useCallback(
    (message: string, reason: ErrorReason) => {
      if (!mountedRef.current) {
        return;
      }
      setStatus("error");
      setErrorMessage(message);
      reachGoal(GOAL_FORM_ERROR, { source, reason });
    },
    [source],
  );

  const send = useCallback(
    async (token: string) => {
      const controller = new AbortController();
      const requestTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            name: name.trim().slice(0, LEAD_LIMITS.name),
            phone: normalizePhone(phone) ?? phone,
            source,
            consent,
            company,
            captchaToken: token,
            quiz,
            attribution: readAttribution(),
          }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string }
          | null;

        // Успех засчитываем только по подтверждению сервера. Раньше хватало `response.ok`,
        // а роут умел отвечать 202 «заявка сохранена, но почта не настроена» — цель
        // `lead_form_submit` засчитывалась там, где доставка на самом деле сломалась.
        if (!response.ok || payload?.ok !== true) {
          fail(payload?.message || DEFAULT_ERROR, response.ok ? "rejected" : "http");
          return;
        }

        if (!mountedRef.current) {
          return;
        }

        setStatus("success");
        setErrorMessage("");
        setName("");
        setPhone("");
        setConsent(false);
        reachGoal(GOAL_FORM_SUBMIT, { source });
        // Тому, кто уже оставил заявку, окно в статьях больше не открывается само.
        markLeadSent();
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        fail(
          aborted ? "Сервер не ответил вовремя. Попробуйте ещё раз." : DEFAULT_ERROR,
          aborted ? "timeout" : "network",
        );
      } finally {
        clearTimeout(requestTimer);
        if (mountedRef.current) {
          // Токен одноразовый: следующая попытка получает свежий виджет и свежий токен.
          captchaTokenRef.current = "";
          setCaptchaVisible(false);
          setCaptchaNonce((value) => value + 1);
        }
      }
    },
    [company, consent, fail, name, phone, quiz, source],
  );

  /** Единственная дверь к отправке: повторные вызовы в рамках одной попытки игнорируются. */
  const dispatch = useCallback(
    (token: string) => {
      if (dispatchedRef.current) {
        return;
      }
      dispatchedRef.current = true;
      clearCaptchaTimer();
      void send(token);
    },
    [clearCaptchaTimer, send],
  );

  const submit = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();

      if (status === "sending") {
        return;
      }

      if (!isValidPhone(phone)) {
        setStatus("error");
        setErrorMessage("Укажите телефон полностью — 11 цифр российского номера.");
        reachGoal(GOAL_FORM_ERROR, { source, reason: "validation" });
        return;
      }

      if (!consent) {
        setStatus("error");
        setErrorMessage("Отметьте согласие на обработку персональных данных.");
        reachGoal(GOAL_FORM_ERROR, { source, reason: "validation" });
        return;
      }

      dispatchedRef.current = false;
      setStatus("sending");
      setErrorMessage("");

      const readyToken = captchaTokenRef.current;

      if (readyToken) {
        captchaTokenRef.current = "";
        dispatch(readyToken);
        return;
      }

      // Токена ещё нет — запускаем невидимую капчу и ждём его ограниченное время.
      setCaptchaArmed(true);
      setCaptchaVisible(true);
      clearCaptchaTimer();

      captchaTimerRef.current = setTimeout(() => {
        captchaTimerRef.current = null;
        if (dispatchedRef.current) {
          return;
        }
        // Капча не ответила. Заявку живого человека терять нельзя: отправляем без токена —
        // сервер примет её как непроверенную, honeypot и лимит по IP при этом работают.
        // Сбой капчи при этом виден в Метрике, а не тонет в тишине.
        reachGoal(GOAL_CAPTCHA_UNAVAILABLE, { source, reason: "timeout" });
        reachGoal(GOAL_FORM_ERROR, { source, reason: "timeout" });
        dispatch("");
      }, CAPTCHA_WAIT_MS);
    },
    [clearCaptchaTimer, consent, dispatch, phone, source, status],
  );

  const onCaptchaSuccess = useCallback(
    (token: string) => {
      captchaTokenRef.current = token;

      // Токен пришёл во время ожидания отправки — используем сразу.
      if (captchaTimerRef.current) {
        captchaTokenRef.current = "";
        dispatch(token);
      }
    },
    [dispatch],
  );

  /** Капча сдалась: сеть, ошибка скрипта или закрытый пользователем челлендж. */
  const onCaptchaUnavailable = useCallback(
    (reason: string) => {
      if (!captchaTimerRef.current || dispatchedRef.current) {
        return;
      }
      reachGoal(GOAL_CAPTCHA_UNAVAILABLE, { source, reason });
      reachGoal(GOAL_FORM_ERROR, { source, reason: "timeout" });
      dispatch("");
    },
    [dispatch, source],
  );

  const onCaptchaTokenExpired = useCallback(() => {
    captchaTokenRef.current = "";
  }, []);

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(formatPhone(value));
  }, []);

  const handlePhoneFocus = useCallback(() => {
    setCaptchaArmed(true);
    setPhone((current) => (current ? current : "+7 "));
  }, []);

  const handlePhoneBlur = useCallback(() => {
    setPhone((current) => (getPhoneDigits(current).length ? current : ""));
  }, []);

  /** Возврат в исходное состояние — например, при закрытии модалки после успеха. */
  const reset = useCallback(() => {
    clearCaptchaTimer();
    dispatchedRef.current = false;
    captchaTokenRef.current = "";
    setStatus("idle");
    setErrorMessage("");
    setCaptchaVisible(false);
  }, [clearCaptchaTimer]);

  return {
    name,
    setName,
    phone,
    handlePhoneChange,
    handlePhoneFocus,
    handlePhoneBlur,
    consent,
    setConsent,
    company,
    setCompany,
    status,
    errorMessage,
    submit,
    reset,
    armCaptcha,
    captcha: {
      armed: captchaArmed,
      visible: captchaVisible,
      nonce: captchaNonce,
      onSuccess: onCaptchaSuccess,
      onUnavailable: onCaptchaUnavailable,
      onTokenExpired: onCaptchaTokenExpired,
    },
  };
}
