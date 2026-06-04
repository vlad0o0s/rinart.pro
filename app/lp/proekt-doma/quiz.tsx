"use client";

import { useMemo, useState } from "react";
import { LeadForm } from "@/components/lead-form";
import styles from "./landing.module.css";

type Step = {
  id: string;
  question: string;
  options: string[];
};

const STEPS: Step[] = [
  {
    id: "Материал",
    question: "Какой дом планируете?",
    options: ["Каменный (газобетон, кирпич)", "Деревянный (брус, клееный брус)", "Каркасный", "Ещё не решил"],
  },
  {
    id: "Этажность",
    question: "Сколько этажей?",
    options: ["Одноэтажный", "Двухэтажный", "С мансардой", "Пока не определился"],
  },
  {
    id: "Площадь",
    question: "Ориентировочная площадь дома",
    options: ["до 100 м²", "100–150 м²", "150–250 м²", "более 250 м²"],
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

  const summary = useMemo(
    () =>
      STEPS.map((s) => `${s.id}: ${answers[s.id] ?? "—"}`).join("; "),
    [answers],
  );

  function choose(stepId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [stepId]: value }));
    setStep((prev) => prev + 1);
  }

  function goBack() {
    setStep((prev) => Math.max(0, prev - 1));
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
          <h3 className={styles.quizQuestion}>Ваш запрос готов</h3>
          <ul className={styles.summaryList}>
            {STEPS.map((s) => (
              <li key={s.id} className={styles.summaryRow}>
                <span className={styles.summaryKey}>{s.id}</span>
                <span className={styles.summaryVal}>{answers[s.id] ?? "—"}</span>
              </li>
            ))}
          </ul>
          <p className={styles.summaryNote}>
            Оставьте контакты — пришлём ориентир по стоимости и примеры похожих проектов.
          </p>
          <div className={styles.summaryCta}>
            <LeadForm
              source={`Лендинг квиз · ${summary}`}
              title="Расчёт стоимости проекта"
              subtitle="Оставьте имя и телефон — отправим расчёт и подходящие решения."
              placement="default"
            />
            <button type="button" className={styles.navBtn} onClick={() => setStep(0)}>
              Пройти заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
