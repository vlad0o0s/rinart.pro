'use client';

import { useReveal } from "@/lib/use-reveal";
import styles from "./stages-section.module.css";

export function StagesSection() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className={styles.section} id="etap" data-visible="false">
      <div className={styles.left}>
        <p className={styles.preheading}>
          <em>(II)</em> ЭТАПЫ ПРОЕКТИРОВАНИЯ
        </p>
      </div>
      <div className={styles.right}>
        <div className={styles.content}>
          <h2 className={styles.title}>
            Разработка проекта дома – это сложный, ответственный и многоуровневый
            процесс, который разделяется на несколько этапов:
          </h2>
          <div className={styles.descriptionsRow}>
            <p className={styles.body}>
              Этапы выполняются последовательно. Каждый из этапов является
              основанием для выполнения последующего. Все этапы обсуждаются и
              согласовываются с заказчиком.
            </p>
            <p className={styles.body}>
              На каждом этапе происходит фиксация принятых решений в проектной
              документации, согласовываются все необходимые корретировки.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

