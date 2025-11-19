"use client";

import { useReveal } from "@/lib/use-reveal";
import { SafeImage } from "@/components/safe-image";
import type { FounderBiographyBlock } from "@/lib/site-settings";
import styles from "./founder-section.module.css";

type FounderSectionProps = {
  biography: FounderBiographyBlock[];
};

export function FounderSection({ biography }: FounderSectionProps) {
  const sectionRef = useReveal<HTMLElement>({ threshold: 0.2 });

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
            <SafeImage
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
            Архитектурно Строительную Академию в г. Казани.
          </p>

          <div className={styles.timeline}>
            {biography.map((block) => (
              <div
                key={block.year}
                className={styles.yearBlock}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

