import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AREA_OPTIONS,
  AREA_UNKNOWN,
  STEPS,
  STEP_AREA,
  STEP_TIMING,
  TIMING_OPTIONS,
  isQualified,
} from "../app/lp/proekt-doma/quiz-steps";
import { PRICING_TIERS, findTier } from "../lib/pricing-tiers";

test("каждый вариант площади, кроме «не определился», находит свой тариф", () => {
  for (const option of AREA_OPTIONS) {
    if (option.value === AREA_UNKNOWN) {
      assert.equal(findTier(option.value), undefined);
      continue;
    }

    // Если подпись разойдётся с `PRICING_TIERS` хотя бы одним символом (например, дефис
    // вместо тире), расчёт молча перестанет показывать цену — ловим это здесь.
    assert.ok(findTier(option.value), `нет тарифа для варианта «${option.value}»`);
  }
});

test("рекламный сценарий не предлагает дома меньше 200 м²", () => {
  const areaValues = AREA_OPTIONS.map((option) => option.value);

  assert.ok(!areaValues.includes("100–200 м²"));

  for (const value of areaValues) {
    const tier = findTier(value);
    if (tier) {
      assert.ok(tier.minArea >= 200, `вариант «${value}» ниже рекламного порога 200 м²`);
    }
  }
});

test("шкала цен осталась нетронутой", () => {
  // Цены и формулу расчёта менять без отдельного согласования нельзя,
  // поэтому фиксируем их тестом.
  assert.deepEqual(
    PRICING_TIERS.map((tier) => [tier.label, tier.base, tier.full]),
    [
      ["100–200 м²", 4100, 5000],
      ["200–300 м²", 3700, 4600],
      ["300–400 м²", 3400, 4300],
      ["более 400 м²", 3200, 4000],
    ],
  );
});

test("цели ответов уникальны и названы как в ТЗ", () => {
  const goals = [...AREA_OPTIONS, ...TIMING_OPTIONS].map((option) => option.goal);

  assert.deepEqual(goals, [
    "quiz_area_200_300",
    "quiz_area_300_400",
    "quiz_area_400_plus",
    "quiz_area_unknown",
    "quiz_timing_3m",
    "quiz_timing_6m",
    "quiz_timing_year",
    "quiz_timing_research",
  ]);

  assert.equal(new Set(goals).size, goals.length);
});

test("квалифицированный лид — площадь от 200 м² и срок не «изучаю»", () => {
  assert.equal(
    isQualified({ [STEP_AREA]: "200–300 м²", [STEP_TIMING]: "В ближайшие 3 месяца" }),
    true,
  );
  assert.equal(isQualified({ [STEP_AREA]: "более 400 м²", [STEP_TIMING]: "В этом году" }), true);

  assert.equal(isQualified({ [STEP_AREA]: AREA_UNKNOWN, [STEP_TIMING]: "В этом году" }), false);
  assert.equal(isQualified({ [STEP_AREA]: "200–300 м²", [STEP_TIMING]: "Пока изучаю" }), false);
  assert.equal(isQualified({}), false);
});

test("квиз остаётся из четырёх вопросов с непустыми вариантами", () => {
  assert.equal(STEPS.length, 4);

  for (const step of STEPS) {
    assert.ok(step.options.length > 0, `у шага «${step.id}» нет вариантов`);
    for (const option of step.options) {
      assert.ok(option.value.trim().length > 0);
      assert.ok(option.label.trim().length > 0);
    }
  }
});
