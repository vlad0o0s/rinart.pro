'use client';

import type { CSSProperties } from "react";
import { useReveal } from "@/lib/use-reveal";
import styles from "./pricing-timeline.module.css";

type PricingItem = {
  label: string;
  price: string;
  filledSquares: number;
  connectorHeight: number;
};

const TOP_ITEMS: PricingItem[] = [
  {
    label: "Эскизный проект \nдома:",
    price: "1500 р/м2",
    filledSquares: 1,
    connectorHeight: 45,
  },
  {
    label: "Конструктивные \nрешения:",
    price: "1000 р/м2",
    filledSquares: 3,
    connectorHeight: 185,
  },
  {
    label: "Проект отопления:",
    price: "300 р/м2",
    filledSquares: 5,
    connectorHeight: 95,
  },
  {
    label: "Дизайн проект интерьера:",
    price: "4000 р/м2",
    filledSquares: 7,
    connectorHeight: 265,
  },
];

const BOTTOM_ITEMS: PricingItem[] = [
  {
    label: "Архитектурные \nрешения:",
    price: "1500 р/м2",
    filledSquares: 2,
    connectorHeight: 60,
  },
  {
    label: "Проект водоснабжения \nи канализации:",
    price: "300 р/м2",
    filledSquares: 4,
    connectorHeight: 210,
  },
  {
    label: "Проект электроснабжения:",
    price: "300 р/м2",
    filledSquares: 6,
    connectorHeight: 105,
  },
];

const MOBILE_TIMELINE: Array<{ item: PricingItem; side: "left" | "right" }> = [
  { item: TOP_ITEMS[0], side: "left" },
  { item: BOTTOM_ITEMS[0], side: "right" },
  { item: TOP_ITEMS[1], side: "left" },
  { item: BOTTOM_ITEMS[1], side: "right" },
  { item: TOP_ITEMS[2], side: "left" },
  { item: BOTTOM_ITEMS[2], side: "right" },
  { item: TOP_ITEMS[3], side: "left" },
];

const TOTAL_SLOTS = 8;
const BLANK_SLOT_INDEX = 3;

function IndicatorSquares({ filled }: { filled: number }) {
  let filledCount = 0;

  return (
    <div className={styles.squareGrid} aria-hidden="true">
      {Array.from({ length: TOTAL_SLOTS }).map((_, index) => {
        if (index === BLANK_SLOT_INDEX) {
          return <span key={`square-${index}`} className={styles.squareBlank} />;
        }

        const isFilled = filledCount < filled;
        filledCount += 1;

        return (
          <span
            key={`square-${index}`}
            className={`${styles.square} ${isFilled ? styles.squareFilled : styles.squareEmpty}`}
          />
        );
      })}
    </div>
  );
}

function DesktopPricingItem({
  item,
  variant,
}: {
  item: PricingItem;
  variant: "top" | "bottom";
}) {
  const blockClass =
    variant === "top"
      ? `${styles.indicatorBlock} ${styles.indicatorBlockTop}`
      : `${styles.indicatorBlock} ${styles.indicatorBlockBottom}`;

  const indicatorStyle = {
    "--connector-length": `${item.connectorHeight}px`,
  } as CSSProperties;

  const copyBlock = (
    <div className={styles.copyBlock}>
      <p className={styles.itemTitle}>{item.label}</p>
      <p className={styles.itemPrice}>{item.price}</p>
    </div>
  );

  return (
    <div className={`${styles.item} ${variant === "top" ? styles.itemTop : styles.itemBottom}`}>
      {variant === "top" ? copyBlock : null}
      <div className={blockClass} style={indicatorStyle}>
        <IndicatorSquares filled={item.filledSquares} />
        <span className={styles.connectorSegment} aria-hidden="true" />
      </div>
      {variant === "bottom" ? copyBlock : null}
    </div>
  );
}

export function PricingTimeline() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section ref={sectionRef} className={styles.section} id="price" data-visible="false">
      <h2 className={styles.header}>
        <em>(III)</em> Стоимость проектирования
      </h2>
      <div className={styles.branch}>
        <div className={styles.topRow}>
          {TOP_ITEMS.map((item) => (
            <DesktopPricingItem key={`top-${item.label}`} item={item} variant="top" />
          ))}
        </div>
        <div className={styles.baseline} aria-hidden="true" />
        <div className={styles.bottomRow}>
          {BOTTOM_ITEMS.map((item) => (
            <DesktopPricingItem key={`bottom-${item.label}`} item={item} variant="bottom" />
          ))}
        </div>
      </div>
      <div className={styles.mobileTimeline}>
        {MOBILE_TIMELINE.map(({ item, side }) => {
          const isLeft = side === "left";
          const content = (
            <div className={styles.mobileContent}>
              <IndicatorSquares filled={item.filledSquares} />
              <div className={styles.mobileCopy}>
                <p className={styles.itemTitle}>{item.label}</p>
                <p className={styles.itemPrice}>{item.price}</p>
              </div>
            </div>
          );

          return (
            <div
              key={`mobile-${item.label}`}
              className={`${styles.mobileTimelineItem} ${isLeft ? styles.mobileTimelineItemLeft : styles.mobileTimelineItemRight}`}
            >
              {isLeft ? content : <div className={styles.mobileSpacer} aria-hidden="true" />}
              <div className={styles.mobileCenter}>
                <span
                  className={`${styles.mobileConnector} ${
                    isLeft ? styles.mobileConnectorLeft : styles.mobileConnectorRight
                  }`}
                />
              </div>
              {!isLeft ? content : <div className={styles.mobileSpacer} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
