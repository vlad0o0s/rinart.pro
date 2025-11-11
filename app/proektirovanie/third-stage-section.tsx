import styles from "./second-stage-section.module.css";

export function ThirdStageSection() {
  return (
    <section className={styles.section} id="stage-3">
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
            бригаде реализовать проект без потерь качества и соответствовать всем
            нормативным требованиям.
          </p>
        </div>
      </div>
    </section>
  );
}
