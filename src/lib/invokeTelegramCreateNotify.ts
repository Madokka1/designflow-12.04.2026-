import type { SupabaseClient } from '@supabase/supabase-js'

/** Имя Edge Function в URL без «telegram» — иначе часть блокировщиков режет запрос из браузера. */
const EDGE_NOTIFY_FUNCTION =
  (import.meta.env.VITE_SUPABASE_EDGE_NOTIFY_NAME as string | undefined)?.trim() ||
  'portfolio-notify'

export type TelegramCreateNotifyResult =
  | { ok: true; sent: true }
  | {
      ok: true
      skipped: true
      reason: 'no_chat' | 'creates_disabled' | 'invalid_chat'
    }
  | { ok: false; error: string }

type TelegramSendResponse = {
  ok?: boolean
  skipped?: boolean
  reason?: string
  error?: string
}

function formatInvokeError(err: unknown): string {
  if (err == null) return 'Неизвестная ошибка'
  if (typeof err !== 'object') return String(err)
  const e = err as {
    name?: string
    message?: string
    context?: unknown
  }
  const base = e.message ?? 'Ошибка вызова функции'
  if (e.name === 'FunctionsFetchError' && e.context != null) {
    const c = e.context
    if (c instanceof Error) {
      return `${base} (${c.message})`
    }
    if (typeof c === 'object' && c !== null && 'message' in c) {
      return `${base} (${String((c as { message: unknown }).message)})`
    }
  }
  return base
}

/** Тело ответа Edge Function при 4xx/5xx (FunctionsHttpError.context — Response). */
async function explainFunctionsHttpError(err: unknown): Promise<string | null> {
  if (!err || typeof err !== 'object') return null
  const e = err as { name?: string; context?: unknown }
  if (e.name !== 'FunctionsHttpError') return null
  const res = e.context
  if (!(res instanceof Response)) return null
  const status = res.status
  let raw = ''
  try {
    raw = (await res.clone().text()).trim()
  } catch {
    return `HTTP ${status}`
  }
  if (!raw) return `HTTP ${status}`

  let code: string | undefined
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string }
    code = j.error ?? j.message
  } catch {
    /* не JSON */
  }

  if (code === 'server_misconfigured') {
    return `HTTP ${status}: не заданы секреты функции. В Supabase: Project Settings → Edge Functions → Secrets: TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY. Затем снова deploy portfolio-notify.`
  }
  if (code === 'unauthorized') {
    return `HTTP ${status}: сессия недействительна — выйдите и войдите снова.`
  }
  if (code === 'telegram_api') {
    return `HTTP ${status}: Telegram API отклонил сообщение — проверьте токен бота и привязку чата (/link).`
  }
  if (code === 'profile') {
    return `HTTP ${status}: не удалось прочитать профиль в БД (RLS или миграции profiles).`
  }
  if (code) {
    return `HTTP ${status}: ${code}`
  }
  const short = raw.length > 280 ? `${raw.slice(0, 280)}…` : raw
  return `HTTP ${status}: ${short}`
}

function isEdgeFunctionNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; context?: unknown }
  if (e.name !== 'FunctionsHttpError') return false
  const res = e.context
  return (
    typeof Response !== 'undefined' &&
    res instanceof Response &&
    res.status === 404
  )
}

const FETCH_HINT =
  'Проверьте интернет и URL Supabase в настройках. Отключите блокировщик рекламы для этого сайта (он может резать запросы к Edge Functions). Задеплойте: supabase functions deploy portfolio-notify'

const LEGACY_NOTIFY_FUNCTION = 'telegram-send'

async function invokeNotifyOnce(
  client: SupabaseClient,
  fnName: string,
  text: string,
): Promise<{
  data: unknown
  error: unknown
}> {
  return client.functions.invoke(fnName, { body: { text } })
}

async function handleInvokeFailure(
  fnName: string,
  error: unknown,
): Promise<TelegramCreateNotifyResult> {
  let msg = formatInvokeError(error)
  const httpHint = await explainFunctionsHttpError(error)
  if (httpHint) {
    msg = `${msg} — ${httpHint}`
  }
  const isFetch =
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'FunctionsFetchError'
  console.warn(`[${fnName}]`, msg, error)
  return {
    ok: false,
    error: isFetch ? `${msg}. ${FETCH_HINT}` : msg,
  }
}

function parseNotifyResponse(data: unknown): TelegramCreateNotifyResult | null {
  const d = data as TelegramSendResponse | null
  if (d?.skipped) {
    const r = d.reason
    if (r === 'creates_disabled' || r === 'no_chat' || r === 'invalid_chat') {
      return { ok: true, skipped: true, reason: r }
    }
    return { ok: true, skipped: true, reason: 'no_chat' }
  }
  if (d?.ok) {
    return { ok: true, sent: true }
  }
  return null
}

/** Уведомление о создании сущности (Edge Function portfolio-notify, fallback: telegram-send). */
export async function invokeTelegramCreateNotify(
  client: SupabaseClient,
  text: string,
): Promise<TelegramCreateNotifyResult> {
  const t = text.trim()
  if (!t) return { ok: false, error: 'Пустой текст' }
  try {
    let fn = EDGE_NOTIFY_FUNCTION
    let { data, error } = await invokeNotifyOnce(client, fn, t)

    if (
      error &&
      fn === EDGE_NOTIFY_FUNCTION &&
      EDGE_NOTIFY_FUNCTION !== LEGACY_NOTIFY_FUNCTION &&
      isEdgeFunctionNotFound(error)
    ) {
      fn = LEGACY_NOTIFY_FUNCTION
      ;({ data, error } = await invokeNotifyOnce(client, fn, t))
    }

    if (error) {
      return await handleInvokeFailure(fn, error)
    }

    const parsed = parseNotifyResponse(data)
    if (parsed) {
      if (parsed.ok && 'skipped' in parsed && parsed.skipped) {
        console.info(`[${fn}] пропуск:`, parsed.reason)
      }
      return parsed
    }
    return { ok: false, error: 'Неожиданный ответ сервера' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[${EDGE_NOTIFY_FUNCTION}]`, e)
    return { ok: false, error: msg }
  }
}
