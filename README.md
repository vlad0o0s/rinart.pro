# RINART Frontend

## Запуск проекта

1. Установите зависимости:
   ```bash
   npm install
   ```
2. Создайте файл `.env.local` в корне проекта и добавьте настройки (символ `&` закодирован как `%26`):
   ```env
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY="ваш_site_key"
   RECAPTCHA_SECRET_KEY="ваш_secret_key"
   ```
3. Примените SQL-схему к базе данных (однократно):
   ```bash
   mysql -h <host> -u <user> -p <dbname> < sql/schema.sql
   ```
   Замените `<host>`, `<user>` и `<dbname>` на свои значения. Команда создаст таблицы `Project`, `ProjectMedia` и `ProjectScheme`.
4. Создайте администратора:
   ```bash
   npm run create-admin -- --login admin --password "сложный_пароль"
   ```
   Скрипт записывает пользователя в таблицу `AdminUser` и хеширует пароль через bcrypt.
5. (Опционально) заполните базу демонстрационными данными из JSON:
   ```bash
   npm run seed
   ```
   Скрипт использует `DATABASE_URL`, читает `public/data/projects.json` и `data/project-details.json` и переносит их в MySQL.
6. Запустите dev-сервер:
   ```bash
   npm run dev
   ```

Приложение доступно по адресу [http://localhost:3000](http://localhost:3000).

## Админка
- Страница: `/admin` (требует активной сессии).
- Страница входа: `/admin/login` — логин и пароль администратора.
- Возможности: быстрый поиск и сортировка проектов (drag&drop), улучшенные карточки редактирования, визуальная медиа-библиотека в духе WordPress, управление галереями и схемами, rich-text редактор описания.

## Технологии
- Next.js App Router
- MySQL (`mysql2/promise`)
- bcryptjs для хранения паролей
- DnD: `@dnd-kit`
- Styled components через CSS Modules
