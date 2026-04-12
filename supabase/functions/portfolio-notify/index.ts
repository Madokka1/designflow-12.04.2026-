/**
 * Отправка сообщения в Telegram текущему пользователю (по profiles.telegram_chat_id).
 * Имя функции без «telegram» в URL — иначе часть блокировщиков режет fetch из браузера.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const TG_MAX = 3900

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SERVICE_ROLE_KEY')?.trim()
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')?.trim()

  if (!supabaseUrl || !anonKey || !serviceKey || !botToken) {
    console.error('portfolio-notify: missing env')
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { text?: string }
  try {
    body = (await req.json()) as { text?: string }
  } catch {
    return new Response(JSON.stringify({ error: 'bad_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const raw = typeof body.text === 'string' ? body.text.trim() : ''
  if (!raw) {
    return new Response(JSON.stringify({ error: 'empty_text' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
    return new Response(JSON.stringify({ error: 'profile' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const chatId = profile?.telegram_chat_id
  const enabled = profile?.telegram_notify_creates_enabled !== false
  if (!enabled) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'creates_disabled' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
  if (chatId == null) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'no_chat' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  const chat =
    typeof chatId === 'string' ? Number(chatId.trim()) : Number(chatId)
  if (!Number.isFinite(chat)) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'invalid_chat' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
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
    return new Response(JSON.stringify({ error: 'telegram_api' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
