"use client";

import { useReveal } from "@/lib/use-reveal";
import styles from "./publications-section.module.css";

const GROUPS: string[][] = [
  [
    "Финалист конкурса на лучший «Проект шоу-рума НЛК Домостроение на территории Центра дизайна ARTPLAY»",
  ],
  [
    "Финалист конкурса «Активный дом 2012»",
    "Шорт лист конкурса «Скамья для Николы»",
    "Публикация в журнале «Проект Россия» № 63",
  ],
  [
    "Участие в конкурсе «Дерево в архитектуре»",
    "Лонг лист конкурса «Николин Бельведер», проект «Вавилон.ru»",
    "1-e место «Архновация» — «Архитектурные произведения и проекты», в составе мастерской Н. В. Белоусова",
  ],
  ["Публикация в журнале «Татлин моно». Молодые архитекторы России"],
  ["Диплом 3 степени, конкурс «3d-дом для экопарка Ясное Поле»"],
];

export function PublicationsSection() {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });

  return (
    <section ref={sectionRef} className={styles.section} id="publish" data-visible="false">
      <div className={styles.wrapper}>
        <div className={styles.marker}>
          <p className={styles.markerLabel}>
            <em>(III)</em> ПУБЛИКАЦИИ И НАГРАДЫ
          </p>
        </div>
        <ul className={styles.list}>
          {GROUPS.flat().map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
      </div>
    </section>
  );
}

