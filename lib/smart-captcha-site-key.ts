/**
 * Клиентский ключ Yandex SmartCaptcha — один на форму заявки и на вход в админку.
 *
 * Ключ публичный: он виден в исходниках страницы, так и задумано. Секретный серверный
 * ключ в браузер не попадает — он читается из переменной окружения только на сервере,
 * в lib/yandex-smart-captcha.ts.
 */
export const SMARTCAPTCHA_SITE_KEY =
  process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_CLIENT_KEY ||
  "ysc1_kSspdc4CreezvRnhYrKOF8CfF79arnKlhequLaHL7fe55cea";
