import styles from "./concept-section.module.css";

const QUESTIONS = [
  "Взгляды и представления заказчика о том, каким может быть его дом;",
  "Образ жизни будущих жильцов, который дом должен поддерживать;",
  "Количественный и возрастной состав жильцов дома, будет ли он со временем меняться (например, рождение детей), и как это может повлиять на структуру дома;",
  "Личные увлечения, которые могут потребовать дополнительные пространства: зимний сад, рабочий кабинет, творческая мастерская, бильярдная, бассейн, тренажерный зал и т. д.;",
  "Понадобятся ли дополнительные комнаты для размещения гостей;",
  "Какие особенности участка, взаимодействие с соседними постройками.",
];

export function ConceptSection() {
  return (
    <section className={styles.section} id="concept">
      <div className={styles.left}>
        <p className={styles.number}>
          <em>1</em>
        </p>
      </div>
      <div className={styles.right}>
        <h2 className={styles.title}>
          Определение концепции дома – это начальный этап проектирования, главная
          задача которого максимально полно обозначить критерии, которым должен
          удовлетворять будущий дом.
        </h2>
        <div className={styles.bodyRow}>
          <p className={styles.body}>
            На этом этапе большое значение приобретает взаимодействие заказчика и
            архитектора. От того, насколько плодотворным и качественным оно будет,
            зависит конечный результат проектирования дома.
          </p>
          <p className={styles.body}>
            Чем правильнее будут поставлены вопросы, на которые проект должен
            отвечать, тем точнее будет решение, а следовательно и гармоничней жизнь
            в этом доме.
          </p>
        </div>
        <p className={styles.listTitle}>
          Среди основных вопросов, которые необходимо обсудить архитектору с
          заказчиком, можно выделить следующие:
        </p>
        <ul className={styles.list}>
          {QUESTIONS.map((question, index) => (
            <li key={question} className={styles.item}>
              <span className={styles.itemSquares} aria-hidden="true">
                {Array.from({ length: 6 }).map((_, squareIndex) => (
                  <span
                    key={`${question}-square-${squareIndex}`}
                    className={`${styles.itemSquare} ${
                      squareIndex < Math.min(index + 1, 6)
                        ? styles.itemSquareFilled
                        : ""
                    }`}
                  />
                ))}
              </span>
              <span>{question}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
