import Image from "next/image";
import styles from "./project-diagram.module.css";

const LABELS = [
  { text: "Состав жилых и технических помещений", variant: "topLeft" },
  { text: "Ориентировочные площади помещений", variant: "topRight" },
  { text: "Этажность дома", variant: "bottomLeft" },
  { text: "Материал строительства", variant: "bottomRight" },
];

export function ProjectDiagram() {
  return (
    <section className={styles.section} aria-labelledby="project-diagram-title">
      <h2 id="project-diagram-title" className="sr-only">
        Основные параметры и габариты проекта дома
      </h2>
      <div className={styles.diagramWrapper}>
        <Image
          src="/img/aksonoometrija-1-1.webp"
          alt="Аксоноометрия проекта дома"
          width={1189}
          height={768}
          className={styles.image}
          priority
        />
        {LABELS.map((label, index) => (
          <div
            key={label.text}
            className={`${styles.label} ${styles[`label_${label.variant}`]}`}
          >
            <div className={styles.labelSquares} aria-hidden="true">
              {Array.from({ length: 4 }).map((_, squareIndex) => (
                <span
                  key={`${label.text}-square-${squareIndex}`}
                  className={`${styles.labelSquare} ${
                    squareIndex < index + 1 ? styles.labelSquareFilled : ""
                  }`}
                />
              ))}
            </div>
            <span className={styles.labelText}>{label.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
