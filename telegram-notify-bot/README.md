# Telegram-уведомления для портфеля

**Один бот на всех пользователей:** в `profiles` у каждого свой `telegram_chat_id`.

## Почему бот «молчит» в Telegram

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
- `TELEGRAM_WEBHOOK_SECRET` обязателен в проде: Telegram пришлёт его в заголовке, функция отклонит чужие POST.
