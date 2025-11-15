'use client';

import Image from "next/image";
import type { CSSProperties } from "react";
import { useReveal } from "@/lib/use-reveal";
import styles from "./project-diagram.module.css";

type LabelVariant = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

type LabelConfig = {
  text: string;
  variant: LabelVariant;
  filled: number;
  offsetX?: number | `${number}%`;
  offsetY?: number | `${number}%`;
};

const TOP_LABELS: LabelConfig[] = [
  { text: "Состав жилых и технических помещений", variant: "topLeft", filled: 1, offsetX: "4%", offsetY: "-4%" },
  { text: "Ориентировочные площади помещений", variant: "topRight", filled: 2, offsetX: "-30%", offsetY: 0 },
];

const BOTTOM_LABELS: LabelConfig[] = [
  { text: "Этажность дома", variant: "bottomLeft", filled: 3, offsetX: "30%", offsetY: 12 },
  { text: "Материал строительства", variant: "bottomRight", filled: 4, offsetX: "-15%", offsetY: 0 },
];

export function ProjectDiagram() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.1 });

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="project-diagram-title"
      data-visible="false"
    >
      <h2 id="project-diagram-title" className="sr-only">
        Основные параметры и габариты проекта дома
      </h2>
      <div className={styles.diagramWrapper}>
        <div className={`${styles.labelsRow} ${styles.labelsRowTop}`}>
          {TOP_LABELS.map((label) => {
            const offsetX = typeof label.offsetX === "number" ? `${label.offsetX}px` : label.offsetX ?? "0px";
            const offsetY = typeof label.offsetY === "number" ? `${label.offsetY}px` : label.offsetY ?? "0px";

            return (
              <div
                key={label.text}
                className={`${styles.label} ${styles[`label_${label.variant}`]}`}
                style={{ "--offset-x": offsetX, "--offset-y": offsetY } as CSSProperties}
              >
                <div className={styles.labelSquares} aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, squareIndex) => (
                    <span
                      key={`${label.text}-square-${squareIndex}`}
                      className={`${styles.labelSquare} ${
                        squareIndex < label.filled ? styles.labelSquareFilled : ""
                      }`}
                    />
                  ))}
                </div>
                <span className={styles.labelText}>{label.text}</span>
              </div>
            );
          })}
        </div>
        <Image
          src="/img/aksonoometrija-1-1.webp"
          alt="Аксоноометрия проекта дома"
          width={1189}
          height={768}
          className={styles.image}
          style={{ height: "auto" }}
          priority
        />
        <div className={`${styles.labelsRow} ${styles.labelsRowBottom}`}>
          {BOTTOM_LABELS.map((label) => {
            const offsetX = typeof label.offsetX === "number" ? `${label.offsetX}px` : label.offsetX ?? "0px";
            const offsetY = typeof label.offsetY === "number" ? `${label.offsetY}px` : label.offsetY ?? "0px";

            return (
              <div
                key={label.text}
                className={`${styles.label} ${styles[`label_${label.variant}`]}`}
                style={{ "--offset-x": offsetX, "--offset-y": offsetY } as CSSProperties}
              >
                <div className={styles.labelSquares} aria-hidden="true">
                  {Array.from({ length: 4 }).map((_, squareIndex) => (
                    <span
                      key={`${label.text}-square-${squareIndex}`}
                      className={`${styles.labelSquare} ${
                        squareIndex < label.filled ? styles.labelSquareFilled : ""
                      }`}
                    />
                  ))}
                </div>
                <span className={styles.labelText}>{label.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
