import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { LeadForm } from "@/components/lead-form";
import { SafeImage } from "@/components/safe-image";
import { getAllProjects } from "@/lib/projects";
import { HomeProjectsSection } from "@/app/_components/home-page-content";
import { LandingQuiz } from "./quiz";
import { Reveal } from "./reveal";
import styles from "./landing.module.css";

// Изолированная посадочная под рекламу: не индексируется, не в sitemap, без входящих ссылок.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PHONE_LABEL = "+7 903 147-44-30";
const PHONE_HREF = "tel:+79031474430";
const MAX_HREF = "https://max.ru/u/f9LHodD0cOJh_cKr5v3ZlDYwFYqPyrvQAHu9h_-XdifygXGo0tdja8HwEuk";
const TELEGRAM_HREF = "https://t.me/rinart_buro";
const HERO_IMAGE = "/img/01-ilichevka.jpg";

export const metadata: Metadata = {
  title: "Проект частного дома под ключ в Москве и области — RINART",
  description:
    "Индивидуальный архитектурный проект частного дома. Рабочая документация, авторский надзор. Рассчитайте стоимость проекта за 1 минуту.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://rinart.pro/lp/proekt-doma" },
};

type RawProject = {
  slug: string;
  title: string;
  tagline?: string | null;
  heroImageUrl?: string | null;
  categories?: string[];
};

const STAGES = [
  { n: "01", t: "Знакомство и бриф", d: "Обсуждаем участок, образ жизни, пожелания и бюджет. Формируем техническое задание." },
  { n: "02", t: "Эскизный проект", d: "Планировки, объём дома, фасады и 3D-визуализация. Согласуем концепцию до деталей." },
  { n: "03", t: "Рабочий проект", d: "Полный комплект чертежей для строительства: архитектура, конструктив, инженерия." },
  { n: "04", t: "Авторский надзор", d: "Сопровождаем стройку, чтобы дом построили точно по проекту." },
];

const INCLUDED = [
  "Планировочные решения всех этажей",
  "Фасады и 3D-визуализация дома",
  "Архитектурный раздел (АР)",
  "Конструктивные решения (КР)",
  "Инженерные разделы (по необходимости)",
  "Спецификации и ведомости для сметы",
];

const FAQ = [
  {
    q: "Сколько стоит проект дома?",
    a: "Стоимость зависит от площади, сложности и состава документации. После короткого расчёта и разговора мы называем точную цену — без скрытых доплат.",
  },
  {
    q: "Сколько времени занимает проектирование?",
    a: "Эскизный проект — в среднем 3–4 недели, полный рабочий проект — от 1,5 месяцев. Точные сроки фиксируем в договоре.",
  },
  {
    q: "Что я получаю на руки?",
    a: "Полный комплект документации для строительства: планировки, фасады, визуализацию, конструктивные и инженерные разделы.",
  },
  {
    q: "Можно по моему эскизу или референсу?",
    a: "Да. Мы работаем и от вашей идеи, и с нуля — предложим планировки и образ дома под ваш участок и бюджет.",
  },
  {
    q: "Вы работаете по всей Московской области?",
    a: "Да, проектируем для Москвы и всей области. Работа возможна онлайн, выезд на участок согласуем отдельно.",
  },
];

export default async function LandingPage() {
  const projectsRaw = (await getAllProjects().catch(() => [])) as RawProject[];
  // Полный список проектов из той же базы, что и главная (управляется через админку),
  // чтобы портфолио на лендинге было синхронно с главной: фото, названия, порядок, категории.
  const projects = projectsRaw
    .filter((p) => p && p.slug)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      tagline: p.tagline ?? undefined,
      heroImageUrl: p.heroImageUrl ?? undefined,
      categories: p.categories ?? [],
    }));

  return (
    <>
      <SiteHeader showDesktopBrand />
      <main className={`${styles.page} min-h-screen bg-white text-neutral-900 antialiased`}>
        {/* HERO / ОФФЕР — текст слева */}
        <section className={styles.hero} aria-label="Проектирование частных домов">
          <div className={styles.heroMedia} aria-hidden="true">
            <SafeImage
              src={HERO_IMAGE}
              alt=""
              fill
              priority
              fetchPriority="high"
              loading="eager"
              sizes="100vw"
              className={styles.heroImg}
              unoptimized
            />
            <div className={styles.heroOverlay} />
          </div>

          <div className={styles.heroInner}>
            <div className={styles.heroCol}>
              <p className={styles.kicker}>Архитектурная мастерская RINART · Москва и область</p>
              <h1 className={styles.h1}>
                Проектируем частные дома,
                <br />
                в которых <em>хочется жить</em>
              </h1>
              <p className={styles.lead}>
                Индивидуальный проект под ваш участок, образ жизни и бюджет. Полная рабочая
                документация и авторский надзор — от идеи до готового дома.
              </p>

              <div className={styles.heroActions}>
                <LeadForm
                  source="Лендинг первый экран"
                  title="Оставить заявку"
                  subtitle="Оставьте имя и телефон — обсудим ваш будущий дом и стоимость проекта."
                  placement="project"
                  openButtonClassName={styles.maxBtn}
                  preserveOpenButtonStyle
                />
                <a className={styles.phone} href={PHONE_HREF}>
                  {PHONE_LABEL}
                </a>
              </div>

              <div className={styles.heroSecondary}>
                <a className={styles.ghostLink} href="#raschet">
                  Рассчитать стоимость
                </a>
                <a className={styles.ghostLink} href={MAX_HREF} target="_blank" rel="noopener noreferrer">
                  Написать в MAX
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ДОВЕРИЕ */}
        <Reveal>
          <section className={styles.trust} aria-label="О мастерской">
            <div className={styles.trustItem}>
              <span className={styles.num}>15+</span>
              <span className={styles.trustLabel}>реализованных проектов в портфолио</span>
            </div>
            <div className={styles.trustItem}>
              <span className={styles.num}>15 лет</span>
              <span className={styles.trustLabel}>опыта архитектора Рината Гильмутдинова</span>
            </div>
            <div className={styles.trustItem}>
              <span className={styles.num}>Под ключ</span>
              <span className={styles.trustLabel}>проект, документация и авторский надзор</span>
            </div>
          </section>
        </Reveal>

        {/* КВИЗ / КАЛЬКУЛЯТОР */}
        <section id="raschet" className={styles.section} aria-label="Расчёт стоимости проекта">
          <Reveal>
            <div className={styles.sectionHead}>
              <p className={styles.kickerDark}>Расчёт за 1 минуту</p>
              <h2 className={styles.h2}>Узнайте стоимость проекта вашего дома</h2>
              <p className={styles.sub}>
                Ответьте на 4 вопроса — подберём решение под ваш участок и пришлём ориентир по цене
                и примеры похожих проектов.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <LandingQuiz />
          </Reveal>
        </section>

        {/* ЭТАПЫ */}
        <section id="etapy" className={styles.section} aria-label="Этапы работы">
          <Reveal>
            <div className={styles.sectionHead}>
              <p className={styles.kickerDark}>Как мы работаем</p>
              <h2 className={styles.h2}>Четыре прозрачных этапа</h2>
            </div>
          </Reveal>
          <div className={styles.stages}>
            {STAGES.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className={styles.stage}>
                  <span className={styles.stageNum}>{s.n}</span>
                  <h3 className={styles.stageTitle}>{s.t}</h3>
                  <p className={styles.stageText}>{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ЧТО ВХОДИТ */}
        <section id="sostav" className={styles.section} aria-label="Что входит в проект">
          <Reveal>
            <div className={styles.sectionHead}>
              <p className={styles.kickerDark}>Состав проекта</p>
              <h2 className={styles.h2}>Что вы получаете</h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <ul className={styles.included}>
              {INCLUDED.map((item) => (
                <li key={item} className={styles.incItem}>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* ПОРТФОЛИО — синхронизировано с главной (общий источник данных через админку) */}
        {projects.length ? (
          <section className={styles.section} aria-label="Портфолио проектов">
            <Reveal>
              <div className={styles.sectionHead}>
                <p className={styles.kickerDark}>Портфолио</p>
                <h2 className={styles.h2}>Наши проекты</h2>
              </div>
            </Reveal>
            <Reveal>
              <HomeProjectsSection projects={projects} />
            </Reveal>
          </section>
        ) : null}

        {/* FAQ */}
        <section className={styles.section} aria-label="Вопросы и ответы">
          <Reveal>
            <div className={styles.sectionHead}>
              <p className={styles.kickerDark}>Частые вопросы</p>
              <h2 className={styles.h2}>Отвечаем на главное</h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className={styles.faq}>
              {FAQ.map((f) => (
                <details key={f.q} className={styles.faqItem}>
                  <summary className={styles.faqQ}>{f.q}</summary>
                  <p className={styles.faqA}>{f.a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ФИНАЛЬНЫЙ CTA */}
        <Reveal>
          <section className={styles.finalCta} aria-label="Оставить заявку">
            <h2 className={styles.finalTitle}>Обсудим ваш будущий дом?</h2>
            <p className={styles.finalSub}>
              Самый быстрый способ связаться — написать нам в MAX. Ответим, обсудим задачу
              и назовём стоимость проекта.
            </p>
            <div className={styles.finalActions}>
              <a className={styles.maxBtnLg} href={MAX_HREF} target="_blank" rel="noopener noreferrer">
                Написать в MAX
              </a>
              <a className={styles.phoneDark} href={PHONE_HREF}>
                {PHONE_LABEL}
              </a>
              <a className={styles.ghostLinkLight} href={TELEGRAM_HREF} target="_blank" rel="noopener noreferrer">
                Telegram
              </a>
            </div>
          </section>
        </Reveal>

        <Footer />
      </main>
    </>
  );
}
