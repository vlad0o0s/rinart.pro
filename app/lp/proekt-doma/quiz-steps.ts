// Импорт относительный, а не через «@/»: этот модуль запускается ещё и тестами обычным
// node, без резолвера путей Next — с алиасом тест падал бы на require.
import { RECONSTRUCTION_LABEL } from "../../../lib/pricing-tiers";

/**
 * Вопросы квиза и цели Метрики для ответов.
 *
 * Вынесено из компонента отдельным модулем без JSX, чтобы значения ответов можно было
 * проверить тестом: подпись площади обязана совпадать с подписью тарифа символ в символ,
 * а «–» и «-» на глаз не различаются.
 */

export const STEP_TYPE = "Тип работ";
export const STEP_FLOORS = "Этажность";
export const STEP_AREA = "Площадь";
export const STEP_TIMING = "Сроки";

export const AREA_UNKNOWN = "Пока не определился";
export const TIMING_RESEARCH = "Пока изучаю";

export type QuizOption = {
  /** Значение ответа. Для площади совпадает с подписью тарифа, иначе расчёт не найдёт ставку. */
  value: string;
  label: string;
  /** Цель Метрики для этого ответа — нужна, чтобы сегментировать аудиторию по качеству. */
  goal?: string;
};

export type QuizStep = {
  id: string;
  question: string;
  options: QuizOption[];
};

function plain(values: string[]): QuizOption[] {
  return values.map((value) => ({ value, label: value }));
}

/**
 * Площадь: рекламный оффер и бизнес-фильтр — дома от 200 м², поэтому вариант «100–200 м²»
 * из основного квалифицирующего сценария убран. Саму шкалу цен не трогаем: её текст
 * показывается в FAQ на этой же странице.
 */
export const AREA_OPTIONS: QuizOption[] = [
  { value: "200–300 м²", label: "200–300 м²", goal: "quiz_area_200_300" },
  { value: "300–400 м²", label: "300–400 м²", goal: "quiz_area_300_400" },
  { value: "более 400 м²", label: "Более 400 м²", goal: "quiz_area_400_plus" },
  { value: AREA_UNKNOWN, label: AREA_UNKNOWN, goal: "quiz_area_unknown" },
];

export const TIMING_OPTIONS: QuizOption[] = [
  { value: "В ближайшие 3 месяца", label: "В ближайшие 3 месяца", goal: "quiz_timing_3m" },
  { value: "В течение полугода", label: "В течение полугода", goal: "quiz_timing_6m" },
  { value: "В этом году", label: "В этом году", goal: "quiz_timing_year" },
  { value: TIMING_RESEARCH, label: TIMING_RESEARCH, goal: "quiz_timing_research" },
];

export const STEPS: QuizStep[] = [
  {
    id: STEP_TYPE,
    question: "Что планируете?",
    options: plain([
      "Каменный дом (газобетон, кирпич)",
      "Деревянный дом (брус, клееный брус)",
      RECONSTRUCTION_LABEL,
      "Ещё не решил",
    ]),
  },
  {
    id: STEP_FLOORS,
    question: "Сколько этажей?",
    options: plain(["Одноэтажный", "Двухэтажный", "С мансардой", "Пока не определился"]),
  },
  {
    id: STEP_AREA,
    question: "Ориентировочная площадь дома",
    options: AREA_OPTIONS,
  },
  {
    id: STEP_TIMING,
    question: "Когда планируете начать?",
    options: TIMING_OPTIONS,
  },
];

/** Площадь от 200 м² и срок не «Пока изучаю» — это тот самый лид, под который куплена реклама. */
export function isQualified(answers: Record<string, string>) {
  const area = answers[STEP_AREA];
  const timing = answers[STEP_TIMING];
  return Boolean(area) && area !== AREA_UNKNOWN && Boolean(timing) && timing !== TIMING_RESEARCH;
}
