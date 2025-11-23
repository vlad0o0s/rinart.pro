'use client';

import { useReveal } from "@/lib/use-reveal";
import styles from "./second-stage-section.module.css";

export function ThirdStageSection() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className={styles.section} id="stage-3" data-visible="false">
      <div className={styles.left}>
        <p className={styles.number}>3</p>
      </div>
      <div className={styles.right}>
        <h2 className={styles.title}>Следующий этап - разработка рабочего проекта.</h2>
        <div className={styles.bodyRow}>
          <p className={styles.body}>
            На этом этапе прорабатываются технические решения дома. Это включает в
            себя разработку чертежей, конструктивные и инженерные расчеты, разработку
            узлов крепления различных материалов, составление спецификаций
            материалов и решение вопросов отопления, водоснабжения и вентиляции.
          </p>
          <p className={styles.body}>
            Формируется комплект рабочей документации, позволяющий строительной
            бригаде реализовать проект в соответствии с изначальной идеей и учетом
            технических и конструктивных требований.
          </p>
        </div>
      </div>
    </section>
  );
}
