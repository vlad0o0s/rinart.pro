import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика обработки персональных данных — RINART",
  description: "Политика обработки персональных данных сайта rinart.pro.",
  robots: { index: false },
};

const SECTION_STYLE = { margin: "0 0 28px" } as const;
const HEADING_STYLE = { fontSize: "18px", fontWeight: 600, margin: "0 0 12px" } as const;
const TEXT_STYLE = { fontSize: "15px", lineHeight: 1.65, margin: "0 0 10px" } as const;

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "48px 20px 80px" }}>
      <h1 style={{ fontSize: "26px", fontWeight: 700, margin: "0 0 32px" }}>
        Политика обработки персональных данных
      </h1>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>1. Общие положения</h2>
        <p style={TEXT_STYLE}>
          Настоящая политика определяет порядок обработки персональных данных посетителей сайта
          rinart.pro (далее — Сайт) в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ
          «О персональных данных». Оператор обработки — администрация архитектурной мастерской
          RINART (далее — Оператор).
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>2. Какие данные мы обрабатываем</h2>
        <p style={TEXT_STYLE}>
          Через формы Сайта Оператор получает: имя и номер телефона, указанные вами добровольно,
          а также технические данные (IP-адрес, сведения о посещении, передаваемые сервисом
          Яндекс Метрика в обезличенном виде).
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>3. Цели обработки</h2>
        <p style={TEXT_STYLE}>
          Данные используются исключительно для связи с вами по вашему обращению: консультации,
          расчёта стоимости проекта и обсуждения условий работы. Данные не передаются третьим
          лицам, за исключением случаев, предусмотренных законом.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>4. Правовое основание и согласие</h2>
        <p style={TEXT_STYLE}>
          Отправляя форму на Сайте, вы даёте согласие на обработку указанных вами персональных
          данных. Согласие действует до его отзыва.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>5. Хранение и защита</h2>
        <p style={TEXT_STYLE}>
          Данные хранятся на защищённом сервере на территории РФ. Доступ к ним имеет только
          Оператор. Срок хранения — не более 3 лет с момента последнего обращения либо до отзыва
          согласия.
        </p>
      </section>

      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>6. Ваши права</h2>
        <p style={TEXT_STYLE}>
          Вы вправе запросить сведения об обработке ваших данных, потребовать их уточнения или
          удаления, а также отозвать согласие, направив запрос через форму на Сайте или по
          телефону, указанному на Сайте.
        </p>
      </section>
    </main>
  );
}
