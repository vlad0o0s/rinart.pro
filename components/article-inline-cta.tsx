"use client";

import { ARTICLE_LEAD_EVENT } from "@/lib/article-lead-modal";
import styles from "./article-lead-modal.module.css";

/**
 * Блок с кнопкой в середине статьи. Сам форму не держит: просит окно заявки открыться,
 * а оно на странице одно — так заявка из блока, из ссылки и из самого окна идёт
 * через одну и ту же форму.
 */

type ArticleInlineCtaProps = {
  text: string;
  buttonLabel: string;
};

export function ArticleInlineCta({ text, buttonLabel }: ArticleInlineCtaProps) {
  return (
    <aside className={styles.inline} aria-label="Обсудить проект с архитектором">
      <p className={styles.inlineText}>{text}</p>
      <button
        className={styles.inlineButton}
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(ARTICLE_LEAD_EVENT))}
      >
        {buttonLabel}
      </button>
    </aside>
  );
}
