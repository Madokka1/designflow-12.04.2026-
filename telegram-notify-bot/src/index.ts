import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { Telegraf, type Context } from 'telegraf'
import {
  calendarTodayInTimeZone,
  collectDeadlineCandidates,
  dayKeyFromYmd,
  fetchProfilesForTelegramNotify,
  fetchUserPortfolioSlice,
  tryMarkDeadlineSent,
} from './deadlines.js'

const BOT_TOKEN = process.env.BOT_TOKEN?.trim()
const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const NOTIFY_TZ = process.env.NOTIFY_TIMEZONE?.trim() || 'Europe/Moscow'
const POLL_MS = Math.max(
  60_000,
  Number(process.env.DEADLINE_POLL_MS) || 3_600_000,
)

if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Задайте BOT_TOKEN, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const bot = new Telegraf(BOT_TOKEN)

/** Привязка чата к пользователю по одноразовому токену из приложения. */
async function processLinkToken(ctx: Context, tokenRaw: string): Promise<void> {
  const token = tokenRaw.trim()
  const from = ctx.from
  if (!from) {
    await ctx.reply('Не удалось определить пользователя Telegram.')
    return
  }
  if (!token) {
    await ctx.reply('Код пустой. Откройте приложение → Настройки и получите код или ссылку.')
    return
  }

  const { data: row, error: qErr } = await supabase
    .from('telegram_link_tokens')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (qErr || !row) {
    await ctx.reply(
      'Код недействителен или устарел. Создайте новый в веб-приложении: Настройки → привязка Telegram.',
    )
    return
  }

  const exp = new Date(String((row as { expires_at: string }).expires_at)).getTime()
  if (Number.isNaN(exp) || exp < Date.now()) {
    await supabase.from('telegram_link_tokens').delete().eq('token', token)
    await ctx.reply('Код истёк. Создайте новый в настройках приложения.')
    return
  }

  const userId = String((row as { user_id: string }).user_id)

  const { data: updated, error: uErr } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: from.id })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (uErr) {
    await ctx.reply(
      'Не удалось сохранить привязку. Проверьте миграции и ключ service_role у сервера бота.',
    )
    return
  }
  if (!updated) {
    await ctx.reply(
      'Профиль не найден. Один раз войдите в веб-приложение под этим аккаунтом, затем снова получите код в Настройках.',
    )
    return
  }

  await supabase.from('telegram_link_tokens').delete().eq('token', token)
  await ctx.reply('Бот привязан')
}

async function purgeExpiredLinkTokens(): Promise<void> {
  const { error } = await supabase
    .from('telegram_link_tokens')
    .delete()
    .lt('expires_at', new Date().toISOString())
  if (error) console.warn('[purge tokens]', error.message)
}

async function runDeadlineNotifications(): Promise<void> {
  const today = calendarTodayInTimeZone(NOTIFY_TZ)
  const dayKey = dayKeyFromYmd(today.y, today.m, today.d)

  let profiles: Awaited<ReturnType<typeof fetchProfilesForTelegramNotify>>
  try {
    profiles = await fetchProfilesForTelegramNotify(supabase)
  } catch (e) {
    console.error('[deadline] fetch profiles', e)
    return
  }

  for (const prof of profiles) {
    const chatId = prof.telegram_chat_id
    if (chatId == null) continue
    const chat = typeof chatId === 'string' ? Number(chatId) : chatId
    if (!Number.isFinite(chat)) continue

    const daysBefore = Math.min(
      14,
      Math.max(
        0,
        typeof prof.telegram_deadline_notify_days_before === 'number'
          ? prof.telegram_deadline_notify_days_before
          : 3,
      ),
    )

    let slice: Awaited<ReturnType<typeof fetchUserPortfolioSlice>>
    try {
      slice = await fetchUserPortfolioSlice(supabase, prof.id)
    } catch (e) {
      console.error('[deadline] portfolio', prof.id, e)
      continue
    }

    const candidates = collectDeadlineCandidates(
      slice.projects,
      slice.stagesByProject,
      slice.tasks,
      today,
      daysBefore,
    )

    for (const c of candidates) {
      const first = await tryMarkDeadlineSent(supabase, prof.id, c.dedupeKey, dayKey)
      if (!first) continue
      try {
        await bot.telegram.sendMessage(
          chat,
          `📌 Срок: ${c.whenLabel}\n${c.title}`,
        )
      } catch (e) {
        console.warn('[telegram send]', chat, e)
      }
    }
  }
}

bot.start(async (ctx) => {
  const payload = (ctx.startPayload ?? '').trim()
  const from = ctx.from
  if (!from) {
    await ctx.reply('Не удалось определить пользователя Telegram.')
    return
  }

  if (payload) {
    await processLinkToken(ctx, payload)
    return
  }

  await ctx.reply(
    [
      'Привет! Это общий бот уведомлений для всех пользователей приложения.',
      '',
      'Чтобы привязать свой профиль:',
      '• в веб-приложении: Настройки → «Получить код / открыть бота» → здесь нажмите Start,',
      '• или отправьте команду: /link и код из приложения (через пробел).',
      '',
      'Дальше сюда будут приходить напоминания о сроках, если включите их в настройках.',
      '',
      'Отвязать этот чат: /stop',
    ].join('\n'),
  )
})

bot.command('link', async (ctx) => {
  const text =
    ctx.message && 'text' in ctx.message ? ctx.message.text.trim() : ''
  const arg = text.replace(/^\/link(@[A-Za-z0-9_]+)?\s*/i, '').trim()
  if (!arg) {
    await ctx.reply(
      [
        'Укажите код из веб-приложения (Настройки → привязка Telegram), например:',
        '/link a1b2c3d4e5f6…',
      ].join('\n'),
    )
    return
  }
  await processLinkToken(ctx, arg)
})

bot.command('stop', async (ctx) => {
  const from = ctx.from
  if (!from) return
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('telegram_chat_id', from.id)
  if (error) {
    await ctx.reply('Не удалось отвязать. Попробуйте позже.')
    return
  }
  await ctx.reply('Чат отвязан. Уведомления сюда больше не придут.')
})

bot.catch((err) => console.error('[telegraf]', err))

async function main(): Promise<void> {
  await purgeExpiredLinkTokens()
  void runDeadlineNotifications().catch((e) => console.error('[deadline initial]', e))

  setInterval(() => {
    void purgeExpiredLinkTokens()
  }, 3_600_000)

  setInterval(() => {
    void runDeadlineNotifications().catch((e) => console.error('[deadline poll]', e))
  }, POLL_MS)

  // Иначе при установленном webhook long polling не получает апдейты — бот «молчит».
  await bot.telegram.deleteWebhook({ drop_pending_updates: false })
  const me = await bot.telegram.getMe()
  console.log('[telegram] polling как @%s (id %s)', me.username ?? '?', me.id)

  await bot.launch()
  console.log('Telegram-бот запущен (long polling). Дедлайны:', NOTIFY_TZ, 'каждые', POLL_MS, 'мс')
}

void main()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
