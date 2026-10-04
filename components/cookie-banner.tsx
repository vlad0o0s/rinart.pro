"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_MODE,
  CONSENT_SETTINGS_EVENT,
  isAnalyticsAllowed,
  needsDecision,
  type CookieConsent,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import { LEGAL_PATHS } from "@/lib/legal";
import { clearAnalyticsTraces, saveCookieConsent, useCookieConsent } from "./use-cookie-consent";
import styles from "./cookie-banner.module.css";

/**
 * Баннер о файлах куки.
 *
 * Показывается, пока посетитель не сделал выбор, и открывается снова по ссылке «Настройки
 * куки» в подвале — отозвать согласие должно быть так же просто, как дать. Страницу баннер
 * не перекрывает и фокус не перехватывает.
 *
 * Счётчик Метрики до согласия не работает. В мягком режиме согласием считается и нажатие
 * «Принять», и то, что человек, увидев баннер, продолжил пользоваться сайтом; в строгом —
 * только нажатие. Режим задаёт ANALYTICS_MODE в lib/cookie-consent.ts.
 *
 * В разметке, которую отдаёт сервер, баннера нет: он появляется после загрузки страницы
 * в браузере. Так текст о куки не попадает в поисковую выдачу вместо описания страницы.
 */

type CookieBannerProps = {
  /** Выбор о куки, прочитанный сервером из запроса. */
  initialConsent: CookieConsent | null;
};

/** Баннер должен пробыть на виду хотя бы столько, прежде чем действие на странице что-то значит. */
const SEEN_BEFORE_ACTION_MS = 1000;
/** Прокрутка считается действием, только если страница заметно сдвинулась. */
const SCROLL_DISTANCE_PX = 200;
/** После согласия действием баннер ещё немного остаётся: можно успеть отказаться. */
const LINGER_AFTER_IMPLIED_MS = 10_000;
/** Клавиши чтения и перехода. Tab сюда не входит: им добираются до кнопок самого баннера. */
const ACTION_KEYS = new Set([" ", "Enter", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"]);

const LEGAL_PAGE_PATHS: readonly string[] = Object.values(LEGAL_PATHS);

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

const noopSubscribe = () => () => {};

/** Заставка между страницами закрывает экран целиком — баннера под ней не видно. */
function isCurtainUp() {
  return document.querySelector("[data-preload-curtain]")?.getAttribute("aria-hidden") === "false";
}

function describeState(consent: CookieConsent) {
  // Intl дописывает «г.» — в конце фразы оно дало бы две точки подряд.
  const date = dateFormat.format(new Date(consent.decidedAt * 1000)).replace(/\s*г\.$/, "");
  if (consent.choice === "granted") {
    return `Сейчас аналитика включена: вы нажали «Принять» ${date}.`;
  }
  if (consent.choice === "implied") {
    return `Сейчас аналитика включена: вы продолжили пользоваться сайтом после уведомления ${date}.`;
  }
  return `Сейчас аналитика выключена: вы отказались ${date}.`;
}

export function CookieBanner({ initialConsent }: CookieBannerProps) {
  const pathname = usePathname();
  const consent = useCookieConsent(initialConsent);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Страница, на которой согласие дано действием: до ухода с неё баннер ненадолго остаётся. */
  const [lingerPath, setLingerPath] = useState<string | null>(null);
  const bannerRef = useRef<HTMLElement | null>(null);
  // На сервере и при гидрации — false, в браузере после неё — true.
  const inBrowser = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const admin = pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
  const undecided = needsDecision(consent);
  const lingering = consent?.choice === "implied" && lingerPath !== null && lingerPath === pathname;
  const visible = inBrowser && !admin && (undecided || settingsOpen || lingering);
  // На страницах документов человек как раз читает условия — чтение согласием не считается.
  const watchActions = ANALYTICS_MODE === "implied" && visible && undecided && !LEGAL_PAGE_PATHS.includes(pathname ?? "");

  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener(CONSENT_SETTINGS_EVENT, open);
    return () => window.removeEventListener(CONSENT_SETTINGS_EVENT, open);
  }, []);

  // Согласие действием: человек увидел баннер и продолжил пользоваться сайтом.
  useEffect(() => {
    if (!watchActions) {
      return;
    }

    /** С какого момента баннер виден без заставки; null — заставка ещё закрывает экран. */
    let seenSince: number | null = null;
    let scrollStart = 0;

    const syncWithCurtain = () => {
      if (isCurtainUp()) {
        seenSince = null;
      } else if (seenSince === null) {
        seenSince = performance.now();
        scrollStart = window.scrollY;
      }
    };
    syncWithCurtain();

    // Заставка сообщает о себе атрибутом: отсчёт идёт с момента, когда она ушла с экрана,
    // а не с первого действия человека — иначе первое нажатие пропадало бы впустую.
    const curtain = document.querySelector("[data-preload-curtain]");
    const curtainObserver = curtain ? new MutationObserver(syncWithCurtain) : null;
    if (curtain && curtainObserver) {
      curtainObserver.observe(curtain, { attributes: true, attributeFilter: ["aria-hidden"] });
    }

    /** true — баннер уже достаточно пробыл на виду, действие можно засчитать. */
    const seenLongEnough = () => {
      syncWithCurtain();
      return seenSince !== null && performance.now() - seenSince >= SEEN_BEFORE_ACTION_MS;
    };

    const accept = () => {
      setLingerPath(pathname);
      saveCookieConsent("implied");
    };

    const onInput = (event: Event) => {
      // Действия внутри баннера — это выбор кнопкой, а не продолжение работы с сайтом.
      if (event.target instanceof Node && bannerRef.current?.contains(event.target)) {
        return;
      }
      if (event instanceof KeyboardEvent && !ACTION_KEYS.has(event.key)) {
        return;
      }
      if (seenLongEnough()) {
        accept();
      }
    };

    const onScroll = () => {
      if (seenLongEnough() && Math.abs(window.scrollY - scrollStart) >= SCROLL_DISTANCE_PX) {
        accept();
      }
    };

    const options = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onInput, options);
    window.addEventListener("keydown", onInput, options);
    window.addEventListener("wheel", onInput, options);
    window.addEventListener("touchmove", onInput, options);
    window.addEventListener("scroll", onScroll, options);

    return () => {
      curtainObserver?.disconnect();
      window.removeEventListener("pointerdown", onInput, options);
      window.removeEventListener("keydown", onInput, options);
      window.removeEventListener("wheel", onInput, options);
      window.removeEventListener("touchmove", onInput, options);
      window.removeEventListener("scroll", onScroll, options);
    };
  }, [watchActions, pathname]);

  useEffect(() => {
    if (!lingering) {
      return;
    }
    const timer = window.setTimeout(() => setLingerPath(null), LINGER_AFTER_IMPLIED_MS);
    return () => window.clearTimeout(timer);
  }, [lingering]);

  if (!visible) {
    return null;
  }

  function choose(choice: CookieConsentChoice) {
    const analyticsWasRunning = isAnalyticsAllowed(consent);
    saveCookieConsent(choice);
    setSettingsOpen(false);
    setLingerPath(null);

    if (choice === "denied" && analyticsWasRunning) {
      // Счётчик уже загружен в память страницы, выгрузить его можно только перезагрузкой.
      clearAnalyticsTraces();
      window.location.reload();
    }
  }

  const consentLink = (
    <Link href={`${LEGAL_PATHS.cookies}#soglasie`}>обработку данных о посещении</Link>
  );

  return (
    <aside className={styles.banner} role="region" aria-label="Файлы куки" ref={bannerRef} data-nosnippet="">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Файлы куки (cookie)</p>
          {ANALYTICS_MODE === "implied" ? (
            <p className={styles.text}>
              Сайт использует файлы куки и сервис «Яндекс Метрика» — для статистики посещений и оценки рекламы.
              Продолжая пользоваться сайтом или нажав «Принять», вы соглашаетесь на {consentLink}.{" "}
              <Link href={LEGAL_PATHS.cookies}>Подробнее</Link>
            </p>
          ) : (
            <p className={styles.text}>
              Обязательные файлы куки нужны для работы сайта. С вашего согласия подключим сервис «Яндекс Метрика» —
              для статистики посещений и оценки рекламы. Нажав «Принять», вы соглашаетесь на {consentLink}.{" "}
              <Link href={LEGAL_PATHS.cookies}>Подробнее</Link>
            </p>
          )}
          {consent && !undecided ? <p className={styles.state}>{describeState(consent)}</p> : null}
        </div>
        <div className={styles.actions}>
          <button className={`${styles.button} ${styles.accept}`} type="button" onClick={() => choose("granted")}>
            Принять
          </button>
          <button className={`${styles.button} ${styles.decline}`} type="button" onClick={() => choose("denied")}>
            {ANALYTICS_MODE === "implied" ? "Отказаться" : "Только обязательные"}
          </button>
        </div>
      </div>
    </aside>
  );
}
