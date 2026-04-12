# Telegram-уведомления для портфеля

**Один бот на всех пользователей:** в `profiles` у каждого свой `telegram_chat_id`.

## Чеклист: не приходят уведомления о проектах / этапах / задачах

1. **Привязка чата** — в приложении Настройки → Telegram статус **«привязан»**, в боте было **«Бот привязан»** после `/link` или Start.
2. **Галочка** — включено **«Уведомлять в Telegram о новых…»**; после смены подождите ~1 с (запись в `profiles`).
3. **Edge Function `portfolio-notify`** — выполнена миграция **`007_telegram_notify_creates.sql`**, функция задеплоена: `supabase functions deploy portfolio-notify`.
4. **Секреты** у функции: `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (и при необходимости уже подставляемые `SUPABASE_URL` / `SUPABASE_ANON_KEY`).
5. В приложении нажмите **«Проверить уведомление»** (Настройки → Telegram) — там показывается текстовая подсказка по ошибке; в консоли (F12) смотрите `[portfolio-notify]`.

**Ошибка `FunctionsFetchError` / «Failed to send a request»** — чаще всего блокировщик рекламы (uBlock и т.п.) режет URL с `telegram` в пути; приложение вызывает **`portfolio-notify`** именно поэтому. Отключите блокировщик для вашего домена с приложением или задеплойте `portfolio-notify`. Если у вас в облаке осталась только старая функция **`telegram-send`**, приложение само сделает второй запрос к ней (после 404 на `portfolio-notify`).

**Напоминания о дедлайнах** шлются **отдельно** — только процессом `telegram-notify-bot` (cron), не через Edge Function уведомлений о создании.

---

## Почему бот «молчит» на команды /link

Пока **нет сервера**, который принимает запросы от Telegram, сообщения никуда не уходят: ни `/start`, ни `/link` не обработаются.

**Рекомендуется:** поднять **webhook через Supabase Edge Function** (ниже) — не нужно держать `npm start` на своём компьютере.

Альтернатива: круглосуточный процесс `npm start` на VPS / Railway / Fly.io (long polling).

---

## Вариант A — Webhook на Supabase (проще для старта)

1. Миграция **`006_telegram_notifications.sql`** уже должна быть выполнена в SQL Editor.

2. Установите [Supabase CLI](https://supabase.com/docs/guides/cli), войдите и привяжите проект:
   ```bash
   supabase login
   supabase link --project-ref ВАШ_PROJECT_REF
   ```

3. Сгенерируйте секрет для webhook (любая длинная строка):
   ```bash
   openssl rand -hex 24
   ```

4. Задайте секреты функции (токен бота и **service_role** из Dashboard → Settings → API, **не** anon):
   ```bash
   supabase secrets set \
     TELEGRAM_BOT_TOKEN="ВАШ_ТОКЕН_ОТ_BOTFATHER" \
     SUPABASE_SERVICE_ROLE_KEY="ВАШ_SERVICE_ROLE" \
     TELEGRAM_WEBHOOK_SECRET="СТРОКА_ИЗ_OPENSSL"
   ```

5. Деплой функции из **корня репозитория** (где лежит `supabase/`):
   ```bash
   supabase functions deploy telegram-webhook
   ```

6. Повесьте webhook (подставьте `PROJECT_REF`, токен бота и тот же `TELEGRAM_WEBHOOK_SECRET`):
   ```bash
   curl -sS -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -d "url=https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

7. Проверка:
   ```bash
   curl -sS "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
   ```
   В ответе должны быть `url` на `.../telegram-webhook` и `has_custom_certificate: false`.

8. **Уведомления о создании** (проекты, этапы, клиенты, задачи): выполните миграцию **`007_telegram_notify_creates.sql`**, затем задеплойте функцию (подхватится `supabase/config.toml` с `verify_jwt = false` для `portfolio-notify`, иначе шлюз иногда отвечает 401 Invalid JWT при нормальной сессии):
   ```bash
   supabase functions deploy portfolio-notify
   ```
   Нужны те же секреты, что для webhook (`TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` и т.д.); `SUPABASE_URL` и `SUPABASE_ANON_KEY` подставляются при деплое. В приложении в Настройках включите «Уведомлять в Telegram о новых…». (Раньше функция называлась `telegram-send` — можно оставить только её в Supabase: клиент попробует `portfolio-notify`, при 404 вызовет `telegram-send`.)

После этого отправьте боту `/link` с кодом из приложения — должен прийти ответ **«Бот привязан»**.

**Важно:** если параллельно запущен локальный `npm start` (polling), отключите его и оставьте только webhook (или наоборот — снимите webhook командой `deleteWebhook`, если хотите только polling).

---

## Вариант B — Node-процесс (long polling)

```bash
cd telegram-notify-bot
cp .env.example .env
# BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

Перед первым запуском снимите webhook, иначе polling не получит апдейты:

```bash
curl -sS "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

## Напоминания о дедлайнах

Раз в час их шлёт **только** процесс `telegram-notify-bot` (Node). Edge Function пока обрабатывает **команды** (`/start`, `/link`, `/stop`). Чтобы напоминания работали в облаке без своего сервера, позже можно вынести cron в Supabase (scheduled Edge Function) или оставить один лёгкий воркер только под cron.

## Связка с веб-приложением

1. В `.env` фронта: **`VITE_TELEGRAM_BOT_USERNAME`** (имя без `@`).
2. Настройки → **«Получить код и открыть бота»** → в Telegram **Start** или **`/link` + код**.
3. Включите **«Напоминания в Telegram»** в настройках, если нужны дедлайны (после настройки cron/Node).

## Безопасность

- **Service role** только в секретах Edge Function или на сервере воркера, не во фронтенде.
- **`TELEGRAM_WEBHOOK_SECRET`** обязателен: без него `telegram-webhook` отвечает **403** (чужой POST не обработает). Для локального `supabase functions serve` можно задать секрет `ALLOW_INSECURE_TELEGRAM_WEBHOOK=1` (только отладка).
- В `setWebhook` передавайте тот же секрет в `secret_token` — Telegram шлёт его в заголовке `x-telegram-bot-api-secret-token`.
- **Привязка `/link` и `/stop`** обрабатываются только в **личном чате** с ботом (в группе игнорируются), чтобы не записать `telegram_chat_id` группы.
- Код привязки — **32 hex-символа** (как у `randomUUID` без дефисов); иной формат отклоняется без запроса к БД.
- **`portfolio-notify`**: `verify_jwt = false` на шлюзе; доступ контролируется **`getUser()`** по `Authorization` + чтение `profiles` через service role. Сообщение уходит только на `telegram_chat_id` владельца сессии.
- **Спам / rate limit**: в **`portfolio-notify`** перед вызовом Telegram API действует in-memory лимит **25 отправок на пользователя за 5 минут** на один инстанс (секреты `PORTFOLIO_NOTIFY_MAX_PER_WINDOW`, `PORTFOLIO_NOTIFY_WINDOW_MS`). Пропуски (`skipped`, нет чата) в лимит не входят.
- **CORS**: по умолчанию `*`. Чтобы сторонний сайт не дергал функцию с украденным токеном из браузера жертвы, задайте секрет **`PORTFOLIO_NOTIFY_CORS_ORIGINS`** (через запятую), например `https://madokkka.ru,https://www.madokkka.ru`. Запросы без заголовка `Origin` (curl, часть нативных клиентов) по-прежнему разрешены.
- **`verify_jwt = false`**: включать **`verify_jwt = true`** в `config.toml` имеет смысл только если шлюз перестал отдавать «Invalid JWT» при вашем хостинге; иначе оставьте выключенным — эквивалентная проверка уже есть в **`getUser()`**.

**TELEGRAM_BOT_TOKEN** и **SUPABASE_SERVICE_ROLE_KEY** не попадают в клиент.

После правок перезадеплойте **`telegram-webhook`** и при необходимости **`portfolio-notify`**.
