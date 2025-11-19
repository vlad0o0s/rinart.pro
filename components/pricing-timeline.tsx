'use client';

import type { CSSProperties } from "react";
import { useReveal } from "@/lib/use-reveal";
import styles from "./pricing-timeline.module.css";
import type { PricingItem, PricingData } from "@/lib/global-blocks";

type PricingTimelineProps = {
  data: PricingData;
};

const MOBILE_TIMELINE_ORDER: Array<{ topIndex: number; bottomIndex: number | null }> = [
  { topIndex: 0, bottomIndex: 0 },
  { topIndex: 1, bottomIndex: 1 },
  { topIndex: 2, bottomIndex: 2 },
  { topIndex: 3, bottomIndex: null },
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

export function PricingTimeline({ data }: PricingTimelineProps) {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.1 });
  const { topItems, bottomItems } = data;

  const mobileTimeline = MOBILE_TIMELINE_ORDER.flatMap(({ topIndex, bottomIndex }) => {
    const items: Array<{ item: PricingItem; side: "left" | "right" }> = [];
    if (topItems[topIndex]) {
      items.push({ item: topItems[topIndex], side: "left" });
    }
    if (bottomIndex !== null && bottomItems[bottomIndex]) {
      items.push({ item: bottomItems[bottomIndex], side: "right" });
    }
    return items;
  });

  return (
    <section ref={sectionRef} className={styles.section} id="price" data-visible="false">
      <h2 className={styles.header}>
        <em>(III)</em> Стоимость проектирования
      </h2>
      <div className={styles.branch}>
        <div className={styles.topRow}>
          {topItems.map((item, index) => (
            <DesktopPricingItem key={`top-${index}-${item.label}`} item={item} variant="top" />
          ))}
        </div>
        <div className={styles.baseline} aria-hidden="true" />
        <div className={styles.bottomRow}>
          {bottomItems.map((item, index) => (
            <DesktopPricingItem key={`bottom-${index}-${item.label}`} item={item} variant="bottom" />
          ))}
        </div>
      </div>
      <div className={styles.mobileTimeline}>
        {mobileTimeline.map(({ item, side }, index) => {
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
              key={`mobile-${index}-${item.label}`}
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
