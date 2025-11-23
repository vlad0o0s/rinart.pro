'use client';

import { useReveal } from "@/lib/use-reveal";
import styles from "./second-stage-section.module.css";

export function SecondStageSection() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className={styles.section} id="stage-2" data-visible="false">
      <div className={styles.left}>
        <p className={styles.number}>2</p>
      </div>
      <div className={styles.right}>
        <h2 className={styles.title}>
          Следующий этап проектирования – это разработка эскизного проекта. Нужно обозначить
          критерии, которым должен удовлетворять будущий дом.
        </h2>
        <div className={styles.bodyRow}>
          <p className={styles.body}>
            Стадия эскизного проекта — самая творческая часть работы, и именно она
            решает, как будет выглядеть дом и насколько он будет удобен. На этой
            стадии проводится анализ участка, определяются возможные габариты
            строений и находится оптимальная посадка всех зданий. Выполняется
            предварительная схема генплана.
          </p>
          <p className={styles.body}>
            Идет поиск образа нового дома, разрабатываются планировочные решения,
            делаются эскизы объемного решения, рисуются фасады. Каждый дом — это
            новое изобретение, индивидуальный проект — это поиск нестандартных
            решений, в которых важно все продумать. На этой стадии с заказчиком
            подробно обсуждаются все детали и обосновываются принятые решения.
          </p>
        </div>
      </div>
    </section>
  );
}
