/**
 * Webhook Telegram → Supabase Edge Function.
 * После деплоя: setWebhook на URL этой функции (см. telegram-notify-bot/README.md).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
}

type TgUser = { id: number; is_bot?: boolean }

type TgMessage = {
  message_id: number
  from?: TgUser
  chat: { id: number; type: string }
  text?: string
}

type TgUpdate = {
  update_id: number
  message?: TgMessage
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim()
  if (!token) return
  const r = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  )
  if (!r.ok) {
    const err = await r.text()
    console.error('[sendMessage]', r.status, err)
  }
}

function parseStartOrLink(text: string | undefined): {
  kind: 'start' | 'link'
  arg: string
} | null {
  if (!text) return null
  const t = text.trim()
  const startM = t.match(/^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/i)
  if (startM) {
    return { kind: 'start', arg: (startM[1] ?? '').trim() }
  }
  const linkM = t.match(/^\/link(?:@[A-Za-z0-9_]+)?\s+(\S+)/i)
  if (linkM) {
    return { kind: 'link', arg: linkM[1].trim() }
  }
  return null
}

async function processLinkToken(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  from: TgUser,
  tokenRaw: string,
): Promise<void> {
  const token = tokenRaw.trim()
  if (!token) {
    await sendTelegramMessage(
      chatId,
      'Код пустой. Откройте приложение → Настройки и получите код.',
    )
    return
  }

  const { data: row, error: qErr } = await supabase
    .from('telegram_link_tokens')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (qErr || !row) {
    await sendTelegramMessage(
      chatId,
      'Код недействителен или устарел. Создайте новый в веб-приложении (Настройки → Telegram).',
    )
    return
  }

  const exp = new Date(String(row.expires_at)).getTime()
  if (Number.isNaN(exp) || exp < Date.now()) {
    await supabase.from('telegram_link_tokens').delete().eq('token', token)
    await sendTelegramMessage(
      chatId,
      'Код истёк. Создайте новый в настройках приложения.',
    )
    return
  }

  const userId = String(row.user_id)

  const { data: updated, error: uErr } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: from.id })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (uErr) {
    await sendTelegramMessage(
      chatId,
      'Не удалось сохранить привязку. Проверьте миграцию 006 и service_role в секретах функции.',
    )
    return
  }
  if (!updated) {
    await sendTelegramMessage(
      chatId,
      'Профиль не найден. Войдите в веб-приложение под этим аккаунтом, затем снова получите код.',
    )
    return
  }

  await supabase.from('telegram_link_tokens').delete().eq('token', token)
  await sendTelegramMessage(chatId, 'Бот привязан')
}

async function handleStop(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
  from: TgUser,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('telegram_chat_id', from.id)
  if (error) {
    await sendTelegramMessage(chatId, 'Не удалось отвязать. Попробуйте позже.')
    return
  }
  await sendTelegramMessage(chatId, 'Чат отвязан.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ ok: true })
  }

  const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')?.trim()
  if (webhookSecret) {
    const got = req.headers.get('x-telegram-bot-api-secret-token') ?? ''
    if (got !== webhookSecret) {
      return new Response('forbidden', { status: 403, headers: corsHeaders })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return json({ ok: false, error: 'server_misconfigured' }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return json({ ok: false })
  }

  const msg = update.message
  if (!msg?.chat?.id) {
    return json({ ok: true })
  }

  const chatId = msg.chat.id
  const from = msg.from
  if (!from) {
    await sendTelegramMessage(chatId, 'Не удалось определить пользователя.')
    return json({ ok: true })
  }

  const text = msg.text?.trim() ?? ''

  if (/^\/link(?:@[A-Za-z0-9_]+)?$/i.test(text)) {
    await sendTelegramMessage(
      chatId,
      'Укажите код из приложения, например:\n/link ваш_код',
    )
    return json({ ok: true })
  }

  if (text.startsWith('/stop') || /^\/stop(@[A-Za-z0-9_]+)?$/i.test(text)) {
    await handleStop(supabase, chatId, from)
    return json({ ok: true })
  }

  const parsed = parseStartOrLink(msg.text)
  if (parsed?.kind === 'link') {
    await processLinkToken(supabase, chatId, from, parsed.arg)
    return json({ ok: true })
  }

  if (parsed?.kind === 'start') {
    if (parsed.arg) {
      await processLinkToken(supabase, chatId, from, parsed.arg)
    } else {
      await sendTelegramMessage(
        chatId,
        [
          'Привет! Общий бот уведомлений для приложения.',
          '',
          'Привязка: веб → Настройки → «Получить код и открыть бота» → Start,',
          'или отправьте: /link и код из приложения.',
          '',
          'Отвязать: /stop',
        ].join('\n'),
      )
    }
    return json({ ok: true })
  }

  return json({ ok: true })
})
