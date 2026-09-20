import Link from "next/link";
import { SafeImage as Image } from "@/components/safe-image";
import { portfolioImageAlt } from "@/lib/portfolio-categories";
import styles from "./cases-section.module.css";

type CaseProject = {
  slug: string;
  title: string;
  heroImageUrl?: string;
  categories: string[];
};

/**
 * Первая группа кейсов из плана: дом, резиденция, дом на рельефе, реконструкция, баня,
 * интерьер. Если какого-то проекта в базе нет, список просто дополняется по порядку
 * портфолио — страница не должна ломаться из-за переименованного адреса.
 */
const FEATURED_SLUGS = ["idalgo", "rezidentsiya-alif", "hill", "reconstruction", "mironcevo", "voronovo"];
const MAX_CASES = 6;

function selectCases(projects: CaseProject[]): CaseProject[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const chosen: CaseProject[] = [];

  for (const slug of FEATURED_SLUGS) {
    const project = bySlug.get(slug);
    if (project) {
      chosen.push(project);
    }
  }

  for (const project of projects) {
    if (chosen.length >= MAX_CASES) {
      break;
    }
    if (!chosen.some((item) => item.slug === project.slug)) {
      chosen.push(project);
    }
  }

  return chosen.slice(0, MAX_CASES);
}

export function CasesSection({ projects }: { projects: CaseProject[] }) {
  const cases = selectCases(projects);
  if (!cases.length) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="cases-heading">
      <h2 id="cases-heading" className={styles.heading}>
        Примеры проектов
      </h2>
      <p className={styles.subheading}>Дома, бани и интерьеры, которые мастерская довела от эскиза до чертежей.</p>
      <div className={styles.grid}>
        {cases.map((project) => (
          <Link key={project.slug} href={`/${project.slug}`} className={styles.card}>
            <span className={styles.imageWrap}>
              {project.heroImageUrl ? (
                <Image
                  src={project.heroImageUrl}
                  alt={portfolioImageAlt(project.title, project.categories)}
                  className={styles.image}
                  fill
                  sizes="(max-width: 560px) 92vw, (max-width: 900px) 46vw, 31vw"
                  quality={75}
                  loading="lazy"
                />
              ) : (
                <span className={styles.imageFallback} aria-hidden />
              )}
            </span>
            <span className={styles.title}>{project.title}</span>
          </Link>
        ))}
      </div>
      <Link href="/#portfolio" className={styles.all}>
        Все проекты →
      </Link>
    </section>
  );
}
