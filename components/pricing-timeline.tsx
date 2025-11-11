import styles from "./pricing-timeline.module.css";

type PricingItem = {
  label: string;
  price: string;
  filledSquares: number;
};

const TOP_ITEMS: PricingItem[] = [
  {
    label: "Эскизный проект \nдома:",
    price: "1500 р/м2",
    filledSquares: 1,
  },
  {
    label: "Конструктивные \nрешения:",
    price: "1000 р/м2",
    filledSquares: 3,
  },
  {
    label: "Проект отопления:",
    price: "300 р/м2",
    filledSquares: 5,
  },
  {
    label: "Дизайн проект интерьера:",
    price: "4000 р/м2",
    filledSquares: 7,
  },
];

const BOTTOM_ITEMS: PricingItem[] = [
  {
    label: "Архитектурные \nрешения:",
    price: "1500 р/м2",
    filledSquares: 2,
  },
  {
    label: "Проект водоснабжения \nи канализации:",
    price: "300 р/м2",
    filledSquares: 4,
  },
  {
    label: "Проект электроснабжения:",
    price: "300 р/м2",
    filledSquares: 6,
  },
];

const MOBILE_ITEMS = [...TOP_ITEMS, ...BOTTOM_ITEMS];

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

function DesktopPricingItem({ item, variant }: { item: PricingItem; variant: "top" | "bottom" }) {
  const blockClass =
    variant === "top"
      ? `${styles.indicatorBlock} ${styles.indicatorBlockTop}`
      : `${styles.indicatorBlock} ${styles.indicatorBlockBottom}`;

  return (
    <div className={`${styles.item} ${variant === "top" ? styles.itemTop : styles.itemBottom}`}>
      <div className={blockClass}>
        <IndicatorSquares filled={item.filledSquares} />
        <span className={styles.connectorSegment} aria-hidden="true" />
      </div>
      <p className={styles.itemTitle}>{item.label}</p>
      <p className={styles.itemPrice}>{item.price}</p>
    </div>
  );
}

export function PricingTimeline() {
  return (
    <section className={styles.section} id="price">
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
      <div className={styles.mobileList}>
        {MOBILE_ITEMS.map((item) => (
          <div key={`mobile-${item.label}`} className={styles.mobileItem}>
            <IndicatorSquares filled={item.filledSquares} />
            <div className={styles.mobileCopy}>
              <p className={styles.itemTitle}>{item.label}</p>
              <p className={styles.itemPrice}>{item.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
