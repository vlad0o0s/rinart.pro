"use client";

import { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/use-reveal";
import styles from "./founder-section.module.css";

const BIO_BLOCKS = [
  {
    year: "1977 г.",
    lines: [
      "Родился в Чимкенте, СССР",
      "художественное училище им.Кастеева, факультет дизайна. Чимкент",
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
    ],
  },
  {
    year: "1992-1996 гг.",
    lines: [
      "художественное училище им.Кастеева, факультет дизайна. Чимкент",
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
      "архитектор, ГУП « Татинвестгражданпроект» мастерская  №1,под рук-вом Бакулина Г.А. Казань",
    ],
  },
  {
    year: "1998-2004 гг.",
    lines: [
      "Казанская Государственная Архитектурно-Строительная Академия, Кафедра АП Казань",
      "архитектор, ГУП « Татинвестгражданпроект» мастерская  №1,под рук-вом Бакулина Г.А. Казань",
      "кафедра Архитектурного проектирования, КГАСА, Казань",
    ],
  },
  {
    year: "2004-2007 гг.",
    lines: [
      "архитектор, ГУП « Татинвестгражданпроект» мастерская  №1,под рук-вом  Бакулина Г.А. Казань",
      "кафедра Архитектурного проектирования, КГАСА, Казань",
      "архитектор, “Сергей Скуратов architects”, Москва",
    ],
  },
  {
    year: "2006-2007 гг.",
    lines: [
      "кафедра Архитектурного проектирования, КГАСА, Казань",
      "архитектор, “Сергей Скуратов architects”, Москва",
      "архитектор, мастерская Белоусова Н.В., Москва",
    ],
  },
  {
    year: "2007-2008 гг.",
    lines: [
      "архитектор, “Сергей Скуратов architects”, Москва",
      "архитектор, мастерская Белоусова Н.В., Москва",
      "Персональная творческая мастерская",
    ],
  },
  {
    year: "2020 г.",
    lines: ["Персональная творческая мастерская", "член Союза архитекторов России"],
  },
];

export function FounderSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });

  const advance = () => {
    setActiveIndex((previous) => (previous + 1) % BIO_BLOCKS.length);
  };

  return (
    <section ref={sectionRef} className={styles.section} id="biographia" data-visible="false">
      <div className={styles.wrapper}>
        <div className={styles.columnMarker}>
          <p className={styles.marker}>
            ОСНОВАТЕЛЬ
          </p>
        </div>

        <div className={styles.columnPhoto}>
          <div className={styles.imageWrapper}>
            <Image
              src="/img/founder.jpg"
              alt="Ринат Гильмутдинов в мастерской"
              fill
              priority
              className={styles.image}
              sizes="(max-width: 768px) 100vw, 700px"
            />
          </div>
        </div>

        <div className={styles.columnContent}>
          <p className={styles.lead}>
            Занимаюсь проектированием больше 20 лет. Мастерская создана в 2024 году. Окончил
            Архитектурно Строительную Академию в г. Казани.
          </p>

          <div className={styles.timeline}>
            {BIO_BLOCKS.map((block, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  type="button"
                  key={block.year}
                  className={`${styles.yearBlock} ${isActive ? styles.yearBlockActive : ""}`}
                  onClick={advance}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      advance();
                    }
                  }}
                  aria-pressed={isActive}
                >
                  <span className={styles.year}>{block.year}</span>
                  {block.lines.map((line, lineIndex) => (
                    <div key={line} className={styles.yearBlockRow}>
                      <span
                        className={`${styles.liner} ${lineIndex > 0 ? styles.linerMuted : ""}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`${styles.description} ${
                          lineIndex > 0 ? styles.descriptionMuted : ""
                        }`}
                      >
                        {line}
                      </span>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

