import type { AuthError } from '@supabase/supabase-js'

/** Человекочитаемое сообщение по ответу Supabase Auth. */
export function authErrorMessageRu(error: AuthError | Error | null): string {
  if (!error) return 'Произошла ошибка'
  const raw = error.message
  const m = raw.toLowerCase()

  if (m.includes('email not confirmed')) {
    return 'Подтвердите email по ссылке из письма, затем войдите снова'
  }
  if (m.includes('invalid login credentials') || m.includes('invalid_grant')) {
    return 'Неверный email или пароль'
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'Этот email уже зарегистрирован — войдите или восстановите пароль в Supabase'
  }
  if (m.includes('password should be at least') || m.includes('password is too short')) {
    return 'Пароль слишком короткий (задайте более длинный)'
  }
  if (m.includes('invalid email')) {
    return 'Некорректный email'
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Нет сети или сервер недоступен'
  }
  if (m.includes('signup_disabled')) {
    return 'Регистрация отключена в проекте Supabase'
  }

  return raw
}
