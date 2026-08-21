// Шкала стоимости проектирования: чем больше дом, тем ниже цена за квадратный метр.
// Значения заданы заказчиком 14.08.2026 и правятся здесь вручную — раньше квиз считал
// по единой ставке из блока «Стоимость проектирования» в админке, дифференцированную
// сетку та структура выразить не может.
//
//   площадь        полный комплект   базовый комплект
//   100–200 м²        5000 ₽/м²          4100 ₽/м²
//   200–300 м²        4600 ₽/м²          3700 ₽/м²
//   300–400 м²        4300 ₽/м²          3400 ₽/м²
//   более 400 м²      4000 ₽/м²          3200 ₽/м²
//
// Базовый комплект — эскизный проект, архитектурные и конструктивные решения.
// Полный — то же плюс инженерные разделы (отопление, водоснабжение, электроснабжение).

export type PricingTier = {
  /** Подпись варианта в квизе — она же ключ ответа. */
  label: string;
  /** Границы площади для расчёта вилки. */
  minArea: number;
  maxArea: number | null;
  /** ₽/м² за базовый комплект. */
  base: number;
  /** ₽/м² вместе с инженерными разделами. */
  full: number;
};

export const PRICING_TIERS: PricingTier[] = [
  { label: "100–200 м²", minArea: 100, maxArea: 200, base: 4100, full: 5000 },
  { label: "200–300 м²", minArea: 200, maxArea: 300, base: 3700, full: 4600 },
  { label: "300–400 м²", minArea: 300, maxArea: 400, base: 3400, full: 4300 },
  { label: "более 400 м²", minArea: 400, maxArea: null, base: 3200, full: 4000 },
];

/** Реконструкция сложнее в проектировании, поэтому к расчёту применяется надбавка. */
export const RECONSTRUCTION_LABEL = "Реконструкция существующего дома";
export const RECONSTRUCTION_FACTOR = 1.2;

/** Самая низкая ставка на шкале — её показываем в тексте «от … ₽/м²». */
export const MIN_RATE = Math.min(...PRICING_TIERS.map((tier) => tier.base));

/** Ставки для дома средней площади — на них опирается пример в ответах на вопросы. */
export const REFERENCE_TIER = PRICING_TIERS[0];

export function findTier(label: string | undefined): PricingTier | undefined {
  return PRICING_TIERS.find((tier) => tier.label === label);
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

export function formatRate(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export type Estimate = { from: number; to: number | null; reconstruction: boolean };

/**
 * Вилка стоимости: нижняя граница — базовый комплект по меньшей площади диапазона,
 * верхняя — вместе с инженерией по большей. Для реконструкции обе границы с надбавкой.
 */
export function calculateEstimate(areaLabel: string | undefined, isReconstruction: boolean): Estimate | null {
  const tier = findTier(areaLabel);
  if (!tier) {
    return null;
  }
  const factor = isReconstruction ? RECONSTRUCTION_FACTOR : 1;
  return {
    from: roundTo(tier.base * tier.minArea * factor, 10000),
    to: tier.maxArea ? roundTo(tier.full * tier.maxArea * factor, 10000) : null,
    reconstruction: isReconstruction,
  };
}
