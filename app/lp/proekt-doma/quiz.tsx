"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { InlineLeadForm } from "@/components/inline-lead-form";
import {
  GOAL_QUIZ_COMPLETE,
  GOAL_QUIZ_QUALIFIED,
  GOAL_QUIZ_START,
  reachGoal,
} from "@/lib/analytics";
import type { QuizContext } from "@/lib/lead-validation";
import {
  RECONSTRUCTION_FACTOR,
  RECONSTRUCTION_LABEL,
  calculateEstimate,
  formatMoney,
  formatRate,
  findTier,
} from "@/lib/pricing-tiers";
import {
  STEPS,
  STEP_AREA,
  STEP_FLOORS,
  STEP_TIMING,
  STEP_TYPE,
  isQualified,
  type QuizOption,
} from "./quiz-steps";
import styles from "./landing.module.css";

export function LandingQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = STEPS.length;
  const isFinished = step >= total;
  const progress = Math.round((Math.min(step, total) / total) * 100);

  const isReconstruction = answers[STEP_TYPE] === RECONSTRUCTION_LABEL;
  const tier = findTier(answers[STEP_AREA]);

  const estimate = useMemo(
    () => calculateEstimate(answers[STEP_AREA], isReconstruction),
    [answers, isReconstruction],
  );

  /** Цели за один проход квиза отправляются по одному разу. «Пройти заново» открывает новый проход. */
  const sentGoalsRef = useRef<Set<string>>(new Set());

  const sendGoalOnce = useCallback((goal: string, params?: Record<string, string>) => {
    if (sentGoalsRef.current.has(goal)) {
      return;
    }
    sentGoalsRef.current.add(goal);
    reachGoal(goal, params);
  }, []);

  const priceText = useMemo(() => {
    if (!estimate) {
      return "";
    }
    return estimate.to
      ? `${formatMoney(estimate.from)} — ${formatMoney(estimate.to)}`
      : `от ${formatMoney(estimate.from)}`;
  }, [estimate]);

  /** Контекст квиза уходит в заявку отдельными полями, а не строкой: так его видно в письме. */
  const quizContext: QuizContext = useMemo(
    () => ({
      houseType: answers[STEP_TYPE] ?? "",
      floors: answers[STEP_FLOORS] ?? "",
      area: answers[STEP_AREA] ?? "",
      timing: answers[STEP_TIMING] ?? "",
      estimate: priceText || "не рассчитан",
    }),
    [answers, priceText],
  );

  function choose(stepId: string, option: QuizOption) {
    const nextAnswers = { ...answers, [stepId]: option.value };
    setAnswers(nextAnswers);
    setStep((prev) => prev + 1);

    // Первый ответ — точка входа в воронку квиза.
    sendGoalOnce(GOAL_QUIZ_START);

    if (option.goal) {
      sendGoalOnce(option.goal);
    }

    // Результат показывается сразу после последнего ответа, поэтому цель показа расчёта
    // отправляем здесь же: отдельный эффект на смену шага делал это на один рендер позже
    // и путался при возврате «Назад».
    if (Object.keys(nextAnswers).length === total) {
      sendGoalOnce(GOAL_QUIZ_COMPLETE, {
        площадь: nextAnswers[STEP_AREA] ?? "не указана",
        тип: nextAnswers[STEP_TYPE] ?? "не указан",
        сроки: nextAnswers[STEP_TIMING] ?? "не указаны",
      });

      if (isQualified(nextAnswers)) {
        sendGoalOnce(GOAL_QUIZ_QUALIFIED);
      }
    }
  }

  function goBack() {
    setStep((prev) => Math.max(0, prev - 1));
  }

  function restart() {
    sentGoalsRef.current = new Set();
    setAnswers({});
    setStep(0);
  }

  return (
    <div className={styles.quiz}>
      <div className={styles.quizHead}>
        <span className={styles.quizStepLabel}>
          {isFinished ? "Готово" : `Шаг ${step + 1} из ${total}`}
        </span>
        <span className={styles.quizPercent}>{progress}%</span>
      </div>
      <div className={styles.progress}>
        <span className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>

      {!isFinished ? (
        <div className={styles.question}>
          <h3 className={styles.quizQuestion}>{STEPS[step].question}</h3>
          <div className={styles.options}>
            {STEPS[step].options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.option} ${answers[STEPS[step].id] === opt.value ? styles.optionActive : ""}`}
                onClick={() => choose(STEPS[step].id, opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {step > 0 ? (
            <button type="button" className={styles.navBtn} onClick={goBack}>
              ← Назад
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.summary}>
          <h3 className={styles.quizQuestion}>Ваш расчёт готов</h3>

          {estimate && tier ? (
            <div className={styles.estimate}>
              <span className={styles.estimateLabel}>Ориентировочная стоимость проекта</span>
              <span className={styles.estimateValue}>{priceText}</span>
              <span className={styles.estimateNote}>
                Для домов {tier.label.toLowerCase()}: {formatRate(tier.base)} ₽/м² за базовый комплект
                (эскизный проект, архитектурные и конструктивные решения) и {formatRate(tier.full)} ₽/м²
                вместе с инженерными разделами.
                {isReconstruction
                  ? ` Для реконструкции применён коэффициент ${RECONSTRUCTION_FACTOR.toLocaleString("ru-RU")} — она сложнее в проектировании.`
                  : ""}{" "}
                Точную цену фиксируем в договоре после разговора.
              </span>
            </div>
          ) : (
            <div className={styles.estimate}>
              <span className={styles.estimateLabel}>Стоимость проекта</span>
              <span className={styles.estimateValue}>Считаем по площади</span>
              <span className={styles.estimateNote}>
                Площадь пока не определена — ориентир по стоимости зависит именно от неё.
                Оставьте телефон: Ринат уточнит задачу и посчитает точную стоимость под ваш участок.
              </span>
            </div>
          )}

          <ul className={styles.summaryList}>
            {STEPS.map((s) => (
              <li key={s.id} className={styles.summaryRow}>
                <span className={styles.summaryKey}>{s.id}</span>
                <span className={styles.summaryVal}>{answers[s.id] ?? "—"}</span>
              </li>
            ))}
          </ul>

          {/* Форма стоит прямо здесь: раньше на этом месте была кнопка, открывавшая модалку,
              и почти вся воронка обрывалась именно на этом лишнем шаге. */}
          <div className={styles.summaryCta}>
            <InlineLeadForm source="Лендинг квиз" quiz={quizContext} />
            <button type="button" className={styles.navBtn} onClick={restart}>
              Пройти заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
