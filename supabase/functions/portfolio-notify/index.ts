/**
 * Отправка сообщения в Telegram текущему пользователю (по profiles.telegram_chat_id).
 * Имя функции без «telegram» в URL — иначе часть блокировщиков режет fetch из браузера.
 *
 * Безопасность: verify_jwt выключен на шлюзе (см. config.toml) — проверка через getUser().
 * Опционально: PORTFOLIO_NOTIFY_CORS_ORIGINS, лимит частоты (in-memory, см. ниже).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const TG_MAX = 3900

const BASE_CORS = {
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

/** Если задано (через запятую), браузерный Origin должен быть в списке. Без Origin (curl) — ок. */
function corsHeadersFor(req: Request): Record<string, string> | null {
  const listRaw = Deno.env.get('PORTFOLIO_NOTIFY_CORS_ORIGINS')?.trim()
  const origin = req.headers.get('Origin')
  if (!listRaw) {
    return { ...BASE_CORS, 'Access-Control-Allow-Origin': '*' }
  }
  const allowed = listRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!origin) {
    return { ...BASE_CORS, 'Access-Control-Allow-Origin': '*' }
  }
  if (!allowed.includes(origin)) {
    return null
  }
  return {
    ...BASE_CORS,
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  }
}

function json(
  req: Request,
  data: unknown,
  status: number,
): Response {
  const cors = corsHeadersFor(req)
  if (!cors) {
    return new Response(JSON.stringify({ error: 'cors' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

/** In-memory лимит на инстанс Edge Function: снижает спам в Telegram при утечке JWT. На другом инстансе счётчик сбрасывается. */
type RateBucket = { count: number; resetAt: number }
const rateByUser = new Map<string, RateBucket>()

function pruneRateMap(): void {
  if (rateByUser.size < 2000) return
  const now = Date.now()
  for (const [k, v] of rateByUser) {
    if (now >= v.resetAt) rateByUser.delete(k)
  }
}

function allowNotifyRate(userId: string): boolean {
  pruneRateMap()
  const max = Math.max(
    1,
    Number(Deno.env.get('PORTFOLIO_NOTIFY_MAX_PER_WINDOW') ?? '25') || 25,
  )
  const windowMs = Math.max(
    30_000,
    Number(Deno.env.get('PORTFOLIO_NOTIFY_WINDOW_MS') ?? '300000') || 300_000,
  )
  const now = Date.now()
  let b = rateByUser.get(userId)
  if (!b || now >= b.resetAt) {
    rateByUser.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= max) return false
  b.count += 1
  return true
}

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req)
  if (req.method === 'OPTIONS') {
    if (!cors) {
      return new Response('forbidden', { status: 403 })
    }
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return json(req, { error: 'method' }, 405)
  }

  if (!cors) {
    return new Response(JSON.stringify({ error: 'cors' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json(req, { error: 'unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SERVICE_ROLE_KEY')?.trim()
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim()

  if (!supabaseUrl || !anonKey || !serviceKey || !botToken) {
    console.error('portfolio-notify: missing env')
    return json(req, { error: 'server_misconfigured' }, 500)
  }

  let body: { text?: string }
  try {
    body = (await req.json()) as { text?: string }
  } catch {
    return json(req, { error: 'bad_json' }, 400)
  }

  const raw = typeof body.text === 'string' ? body.text.trim() : ''
  if (!raw) {
    return json(req, { error: 'empty_text' }, 400)
  }

  const text = raw.length > TG_MAX ? `${raw.slice(0, TG_MAX - 1)}…` : raw

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(req, { error: 'unauthorized' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('telegram_chat_id, telegram_notify_creates_enabled')
    .eq('id', user.id)
    .maybeSingle()

  if (pErr) {
    console.error('profile', pErr.message)
    return json(req, { error: 'profile' }, 500)
  }

  const chatId = profile?.telegram_chat_id
  const enabled = profile?.telegram_notify_creates_enabled !== false
  if (!enabled) {
    return json(req, { ok: true, skipped: true, reason: 'creates_disabled' }, 200)
  }
  if (chatId == null) {
    return json(req, { ok: true, skipped: true, reason: 'no_chat' }, 200)
  }

  const chat =
    typeof chatId === 'string' ? Number(chatId.trim()) : Number(chatId)
  if (!Number.isFinite(chat)) {
    return json(req, { ok: true, skipped: true, reason: 'invalid_chat' }, 200)
  }

  if (!allowNotifyRate(user.id)) {
    return json(req, { error: 'rate_limited' }, 429)
  }

  const tgRes = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text }),
    },
  )

  if (!tgRes.ok) {
    const errText = await tgRes.text()
    console.error('[portfolio-notify]', tgRes.status, errText)
    return json(req, { error: 'telegram_api' }, 502)
  }

  return json(req, { ok: true }, 200)
})
