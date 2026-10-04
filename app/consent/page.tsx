import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalPage, LegalSection, LegalSummary } from "@/components/legal-page";
import { CONSENT_EDITION, LEAD_RETENTION_YEARS, LEGAL_PATHS, OPERATOR, PROCESSORS } from "@/lib/legal";

export const dynamic = "force-dynamic";

const TITLE = "Согласие на обработку персональных данных — RINART";
const DESCRIPTION =
  "Текст согласия на обработку персональных данных, которое посетитель даёт в форме заявки на сайте rinart.pro.";
const CANONICAL = `${OPERATOR.siteUrl}${LEGAL_PATHS.consent}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  robots: { index: false, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: CANONICAL, siteName: "RINART", locale: "ru_RU", type: "website" },
};

/**
 * Согласие — отдельный документ, а не раздел политики: с 1 сентября 2025 года закон
 * требует оформлять его отдельно от иных документов, которые подтверждает человек.
 * Меняется текст — меняется CONSENT_EDITION: редакция сохраняется вместе с каждой заявкой.
 */
export default function ConsentPage() {
  /** Те, кто участвует в обработке заявки. Яндекс Метрика сюда не относится — у неё своё согласие. */
  const processors = [PROCESSORS.hosting, PROCESSORS.mail, PROCESSORS.yandexCloud];

  return (
    <LegalPage
      path={LEGAL_PATHS.consent}
      breadcrumb="Документы"
      title="Согласие на обработку персональных данных"
      edition={CONSENT_EDITION}
    >
      <LegalSummary>
        <p>
          Это текст согласия, которое вы даёте, когда ставите отметку «Даю согласие на обработку персональных данных»
          в форме заявки. Без отметки заявка не отправляется.
        </p>
      </LegalSummary>

      <LegalSection title="Текст согласия">
        <p>
          Я, субъект персональных данных, отмечая поле «Даю согласие на обработку персональных данных» и отправляя
          форму на сайте <a href={OPERATOR.siteUrl}>{OPERATOR.site}</a>, свободно, своей волей и в своём интересе даю
          согласие на обработку моих персональных данных на следующих условиях.
        </p>

        <Clause n="1.">
          <p>
            <strong>Оператор.</strong> {OPERATOR.fullNameCapitalized}, ОГРНИП {OPERATOR.ogrnip}, ИНН {OPERATOR.inn},
            адрес для обращений: {OPERATOR.address}.
          </p>
        </Clause>

        <Clause n="2.">
          <p>
            <strong>Цель обработки.</strong> Рассмотреть мою заявку: связаться со мной по указанному телефону — звонком
            или сообщением в мессенджере, — уточнить задачу, рассчитать стоимость проектирования, подготовить
            предложение и договор.
          </p>
        </Clause>

        <Clause n="3.">
          <p>
            <strong>Перечень данных.</strong>
          </p>
          <ul>
            <li>имя;</li>
            <li>номер телефона;</li>
            <li>
              ответы в форме расчёта стоимости, если заявка отправлена после расчёта: тип дома, этажность, площадь,
              срок начала работ, показанная сумма;
            </li>
            <li>
              сведения об обращении: дата и время, IP-адрес, сведения о браузере, адрес страницы, с которой
              отправлена заявка, первая страница посещения, источник перехода на сайт и рекламные метки ссылки.
            </li>
          </ul>
        </Clause>

        <Clause n="4.">
          <p>
            <strong>Действия с данными.</strong> Сбор, запись, систематизация, накопление, хранение, уточнение
            (обновление, изменение), извлечение, использование, передача (предоставление, доступ) лицам, указанным
            в пункте 5, блокирование, удаление, уничтожение. Обработка ведётся с использованием средств автоматизации
            и без них.
          </p>
        </Clause>

        <Clause n="5.">
          <p>
            <strong>Кому поручается обработка.</strong> Оператор вправе поручить обработку следующим лицам — только
            для цели из пункта 2:
          </p>
          <ul>
            {processors.map((processor) => (
              <li key={processor.ogrn}>
                {processor.name} (ОГРН {processor.ogrn}, {processor.address}) — {processor.role};
              </li>
            ))}
          </ul>
          <p>Другим лицам и для других целей данные не передаются. Распространение данных не допускается.</p>
        </Clause>

        <Clause n="6.">
          <p>
            <strong>Чего согласие не включает.</strong> Согласие не даёт Оператору права направлять мне рекламные
            рассылки и звонить с предложениями, не связанными с моей заявкой.
          </p>
        </Clause>

        <Clause n="7.">
          <p>
            <strong>Срок.</strong> Согласие действует {LEAD_RETENTION_YEARS} года со дня отправки формы либо до его
            отзыва — в зависимости от того, что наступит раньше.
          </p>
        </Clause>

        <Clause n="8.">
          <p>
            <strong>Отзыв согласия.</strong> Я могу отозвать согласие в любой момент, направив обращение на{" "}
            <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> или письмом по адресу Оператора. Оператор
            прекратит обработку и уничтожит данные в срок не более 30 дней, если у него нет иных законных оснований
            продолжать обработку — например, заключённого со мной договора.
          </p>
        </Clause>

        <Clause n="9.">
          <p>
            <strong>Мои права</strong> и порядок обработки данных описаны в{" "}
            <Link href={LEGAL_PATHS.privacy}>политике в отношении обработки персональных данных</Link>.
          </p>
        </Clause>
      </LegalSection>
    </LegalPage>
  );
}
