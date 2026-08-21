"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LeadForm } from "@/components/lead-form";
import {
  PRICING_TIERS,
  RECONSTRUCTION_FACTOR,
  RECONSTRUCTION_LABEL,
  calculateEstimate,
  formatMoney,
  formatRate,
  findTier,
} from "@/lib/pricing-tiers";
import styles from "./landing.module.css";

const METRIKA_COUNTER_ID = 105099236;


type Step = {
  id: string;
  question: string;
  options: string[];
};

const STEPS: Step[] = [
  {
    id: "Тип работ",
    question: "Что планируете?",
    options: [
      "Каменный дом (газобетон, кирпич)",
      "Деревянный дом (брус, клееный брус)",
      RECONSTRUCTION_LABEL,
      "Ещё не решил",
    ],
  },
  {
    id: "Этажность",
    question: "Сколько этажей?",
    options: ["Одноэтажный", "Двухэтажный", "С мансардой", "Пока не определился"],
  },
  {
    id: "Площадь",
    question: "Ориентировочная площадь дома",
    // Варианты берём из шкалы цен, чтобы список и расчёт не разошлись.
    options: PRICING_TIERS.map((tier) => tier.label),
  },
  {
    id: "Сроки",
    question: "Когда планируете начать?",
    options: ["В ближайшие 3 месяца", "В течение полугода", "В этом году", "Пока изучаю"],
  },
];

export function LandingQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const total = STEPS.length;
  const isFinished = step >= total;
  const progress = Math.round((Math.min(step, total) / total) * 100);

  const isReconstruction = answers["Тип работ"] === RECONSTRUCTION_LABEL;
  const tier = findTier(answers["Площадь"]);

  const estimate = useMemo(
    () => calculateEstimate(answers["Площадь"], isReconstruction),
    [answers, isReconstruction],
  );

  // Дошедший до расчёта человек увидел цену — это ключевая точка воронки: до неё
  // видно, сколько посетителей вообще доходят до цифр, а после — сколько из них
  // оставляют контакт. Отдельная цель нужна и для сегмента ретаргетинга:
  // «посмотрел стоимость, но не написал».
  const quizGoalSent = useRef(false);
  useEffect(() => {
    if (!isFinished || quizGoalSent.current) {
      return;
    }
    quizGoalSent.current = true;
    window.ym?.(METRIKA_COUNTER_ID, "reachGoal", "quiz_complete", {
      площадь: answers["Площадь"] ?? "не указана",
      тип: answers["Тип работ"] ?? "не указан",
      сроки: answers["Сроки"] ?? "не указаны",
    });
  }, [isFinished, answers]);

  const summary = useMemo(() => {
    const answered = STEPS.map((s) => `${s.id}: ${answers[s.id] ?? "—"}`).join("; ");
    if (!estimate) return answered;
    const price = estimate.to
      ? `${formatMoney(estimate.from)}–${formatMoney(estimate.to)}`
      : `от ${formatMoney(estimate.from)}`;
    return `${answered}; Расчёт: ${price}`;
  }, [answers, estimate]);

  function choose(stepId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
    setStep((prev) => prev + 1);
  }

  function goBack() {
    setStep((prev) => Math.max(0, prev - 1));
  }

  function restart() {
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
                key={opt}
                type="button"
                className={`${styles.option} ${answers[STEPS[step].id] === opt ? styles.optionActive : ""}`}
                onClick={() => choose(STEPS[step].id, opt)}
              >
                {opt}
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
              <span className={styles.estimateValue}>
                {estimate.to
                  ? `${formatMoney(estimate.from)} — ${formatMoney(estimate.to)}`
                  : `от ${formatMoney(estimate.from)}`}
              </span>
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
          ) : null}

          <ul className={styles.summaryList}>
            {STEPS.map((s) => (
              <li key={s.id} className={styles.summaryRow}>
                <span className={styles.summaryKey}>{s.id}</span>
                <span className={styles.summaryVal}>{answers[s.id] ?? "—"}</span>
              </li>
            ))}
          </ul>
          <p className={styles.summaryNote}>
            Оставьте контакты — обсудим ваш участок, пришлём точный расчёт и примеры похожих проектов.
          </p>
          <div className={styles.summaryCta}>
            <LeadForm
              source={`Лендинг квиз · ${summary}`}
              title="Обсудить проект"
              subtitle="Оставьте имя и телефон — обсудим задачу и посчитаем точную стоимость."
              placement="default"
            />
            <button type="button" className={styles.navBtn} onClick={restart}>
              Пройти заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
