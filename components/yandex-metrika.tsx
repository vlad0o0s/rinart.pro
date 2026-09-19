"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { METRIKA_COUNTER_ID, trackPageview } from "@/lib/analytics";

/**
 * Счётчик Метрики и учёт переходов внутри сайта.
 *
 * Next.js меняет страницы без перезагрузки, а код счётчика отправляет просмотр только при
 * загрузке документа. Поэтому Метрика видела одну страницу входа на весь визит: глубина
 * всегда была 1, цель «Контакты» по адресу не срабатывала при переходе из меню, а обход
 * по счётчику не узнавал о внутренних страницах. Здесь каждый переход отправляет `hit`.
 *
 * Переходы отслеживаются по pathname: сайт нигде не меняет одни только query-параметры,
 * а метки вроде utm_* приходят только с первым документом — его просмотр отправляет `init`.
 */

/** Сколько ждём, пока Next обновит <title> новой страницы, прежде чем отправить просмотр. */
const TITLE_WAIT_MS = 1500;

function isAdminPath(pathname: string | null) {
  return pathname === "/admin" || Boolean(pathname?.startsWith("/admin/"));
}

export function YandexMetrika() {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  /** Счётчик уже запущен на одном из прошлых экранов этой вкладки. */
  const counterStartedRef = useRef(false);
  /** Последний адрес любого экрана — защита от повторного срабатывания эффекта на том же адресе. */
  const lastSeenUrlRef = useRef<string | null>(null);
  /** Последний публичный адрес — он уходит в Метрику как referer; адреса админки туда не попадают. */
  const lastPublicUrlRef = useRef<string | null>(null);
  const lastTitleRef = useRef<string | null>(null);

  useEffect(() => {
    const url = window.location.href;
    const repeated = lastSeenUrlRef.current === url;
    lastSeenUrlRef.current = url;

    if (admin) {
      // В админке просмотры не отправляем, а при прямом входе не загружаем и сам счётчик.
      return;
    }

    const referer = lastPublicUrlRef.current;
    lastPublicUrlRef.current = url;

    if (!counterStartedRef.current) {
      // Первый публичный экран вкладки: его просмотр отправляет `init`, второй был бы дублем.
      counterStartedRef.current = true;
      lastTitleRef.current = document.title;
      return;
    }

    if (repeated) {
      return;
    }

    // Заголовок новой страницы Next может обновить позже, чем сменится pathname.
    // Ждём изменения <title>, но не дольше TITLE_WAIT_MS: у двух страниц заголовок
    // может и совпадать.
    const previousTitle = lastTitleRef.current;
    let sent = false;
    let observer: MutationObserver | null = null;
    let timer: number | null = null;

    const send = () => {
      if (sent) {
        return;
      }
      sent = true;
      observer?.disconnect();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      lastTitleRef.current = document.title;
      // После возврата из админки на ту же страницу referer совпал бы с адресом — тогда он не нужен.
      trackPageview(url, { referer: referer && referer !== url ? referer : undefined, title: document.title });
    };

    if (document.title !== previousTitle) {
      send();
    } else {
      observer = new MutationObserver(() => {
        if (document.title !== previousTitle) {
          send();
        }
      });
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
      timer = window.setTimeout(send, TITLE_WAIT_MS);
    }

    // Следующий переход или размонтирование: просмотр этой страницы не теряем.
    return send;
  }, [pathname, admin]);

  if (admin) {
    return null;
  }

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`
        (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          for (var j = 0; j < document.scripts.length; j++) {
            if (document.scripts[j].src === r) {
              return;
            }
          }
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_COUNTER_ID}', 'ym');

        ym(${METRIKA_COUNTER_ID}, 'init', {
          ssr: true,
          webvisor: true,
          clickmap: true,
          ecommerce: "dataLayer",
          referrer: document.referrer,
          url: location.href,
          accurateTrackBounce: true,
          trackLinks: true,
        });
      `}
    </Script>
  );
}
