import styles from "./stages-section.module.css";

export function StagesSection() {
  return (
    <section className={styles.section} id="etap">
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
              документации, создание визуализаций и согласование корректировок.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

