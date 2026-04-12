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

function handleInvokeFailure(
  fnName: string,
  error: unknown,
): TelegramCreateNotifyResult {
  const msg = formatInvokeError(error)
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
      return handleInvokeFailure(fn, error)
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
