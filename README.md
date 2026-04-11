# Portfolio / ASDAWD

SPA на **React 19**, **Vite 8**, **Tailwind CSS 4** и **Supabase** (Auth + Postgres): проекты, этапы, финансы, календарь, заметки, таймер, настройки профиля.

## Требования

- **Node.js** 22+ (как в GitHub Actions)
- Аккаунт **Supabase** и выполненные SQL-миграции из каталога `supabase/migrations/`

## Быстрый старт

```bash
npm ci
cp .env.example .env   # опционально
npm run dev
```

Откройте в браузере адрес, который выведет Vite (обычно `http://localhost:5173`).

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon (public) API key |

Если переменные не заданы, URL и ключ можно ввести при **регистрации** или в **Настройках** после входа (данные дублируются в `profiles`).

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Режим разработки |
| `npm run build` | Production-сборка в `dist/` |
| `npm run preview` | Локальный просмотр `dist/` |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (нужен `npx playwright install chromium`) |

## База данных

Выполните в Supabase **SQL Editor** файлы по порядку:

1. `supabase/migrations/001_portfolio_schema.sql`
2. `supabase/migrations/002_profiles_supabase_connection.sql`
3. `supabase/migrations/003_profile_ui_and_timer_log.sql`
4. `supabase/migrations/004_read_only_mode.sql`

Краткая инструкция по деплою статики и nginx — в [`deploy/README.md`](deploy/README.md).

## GitHub Actions

- **CI** (`.github/workflows/ci.yml`) — `lint` и `build` на push в ветки, кроме `main`/`master`, и в PR. Опционально задайте в репозитории **Variables** `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`, иначе сборка идёт без них (допустимо).
- **Deploy** (`.github/workflows/deploy.yml`) — на push в `main` или `master`: сборка и выкладка `dist/` на VPS через `rsync`. Нужны секреты: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VPS_SSH_PRIVATE_KEY`, `VPS_HOST`, `VPS_USER`, `VPS_DEPLOY_PATH`, опционально `VPS_PORT`.

## Публикация репозитория

1. Создайте пустой репозиторий на GitHub (без README, если уже есть локальный).
2. В корне проекта:

   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git branch -M main
   git push -u origin main
   ```

3. В **Settings → Secrets and variables → Actions** добавьте секреты для деплоя (если используете workflow).

Не коммитьте файлы `.env`, ключи и `service_role` Supabase.
