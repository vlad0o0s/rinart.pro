'use client';

import { useReveal } from "@/lib/use-reveal";
import styles from "./work-types-section.module.css";

const PROJECT_SECTIONS = [
  { label: "Эскизный проект", filled: 1 },
  { label: "Архитектурные решения", filled: 2 },
  { label: "Конструктивные решения", filled: 3 },
  { label: "Инженерные сети", filled: 4 },
  { label: "Дизайн проект интерьера", filled: 5 },
];

function ProgressSquares({ count }: { count: number }) {
  return (
    <div className={styles.progressSquares} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <span
          key={`progress-${count}-${index}`}
          className={`${styles.progressSquare} ${
            index < count ? styles.progressSquareFilled : styles.progressSquareEmpty
          }`}
        />
      ))}
    </div>
  );
}

export function WorkTypesSection() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className={styles.section} id="vidy" data-visible="false">
      <div className={styles.left}>
        <p className={styles.preheading}>
          <em>(I)</em> Виды работ
        </p>
      </div>
      <div className={styles.right}>
        <h2 className={styles.title}>
          Мастерская разрабатывает полный пакет чертежей, необходимых для
          строительства загородного дома, в соответствии с действующими нормативами.
        </h2>
        <p className={styles.body}>
          Творческий подход к работе позволяет создать индивидуальный, авторский
          проект дома. В своей работе мы учитываем современные технологии, уделяем
          внимание вопросам энергосбережения в доме.
        </p>
        <div className={styles.sectionsBlock}>
          <h3 className={styles.sectionsTitle}>Разделы проекта, которые мы выполняем:</h3>
          <ul className={styles.sectionsList}>
            {PROJECT_SECTIONS.map((section) => (
              <li key={section.label} className={styles.sectionItem}>
                <ProgressSquares count={section.filled} />
                <span>{section.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

