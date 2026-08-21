import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страница не найдена — RINART",
  description: "Запрошенная страница не найдена. Перейдите в портфолио, к описанию проектирования или к контактам мастерской RINART.",
  robots: { index: false, follow: true },
};

const LINK_STYLE = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#252525",
  textDecoration: "underline",
  textUnderlineOffset: "4px",
} as const;

// Раньше на 404 отдавалась стандартная страница Next без единой ссылки:
// посетитель и поисковый робот упирались в тупик.
export default function NotFound() {
  return (
    <main style={{ maxWidth: "760px", margin: "0 auto", padding: "96px 20px 120px" }}>
      <p
        style={{
          fontSize: "12px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#6f6f6f",
          margin: "0 0 16px",
        }}
      >
        Ошибка 404
      </p>
      <h1 style={{ fontSize: "26px", fontWeight: 700, margin: "0 0 16px" }}>Страница не найдена</h1>
      <p style={{ fontSize: "15px", lineHeight: 1.65, margin: "0 0 32px", color: "#4a4a4a" }}>
        Возможно, страница была перемещена или адрес указан с ошибкой. Вот куда можно перейти:
      </p>

      <ul style={{ listStyle: "none", margin: "0 0 40px", padding: 0, display: "grid", gap: "12px" }}>
        <li>
          <Link href="/" style={LINK_STYLE}>
            Главная — портфолио проектов
          </Link>
        </li>
        <li>
          <Link href="/proektirovanie" style={LINK_STYLE}>
            Проектирование: этапы, состав проекта и стоимость
          </Link>
        </li>
        <li>
          <Link href="/masterskaja" style={LINK_STYLE}>
            Мастерская: о команде и подходе к работе
          </Link>
        </li>
        <li>
          <Link href="/kontakty" style={LINK_STYLE}>
            Контакты
          </Link>
        </li>
      </ul>

      <p style={{ fontSize: "15px", lineHeight: 1.65, margin: 0, color: "#4a4a4a" }}>
        Или позвоните архитектору:{" "}
        <a href="tel:+79031474430" style={LINK_STYLE}>
          +7 903 147-44-30
        </a>
      </p>
    </main>
  );
}
