import portfolioSchemaSql from '../../supabase/migrations/001_portfolio_schema.sql?raw'
import profilesConnectionSql from '../../supabase/migrations/002_profiles_supabase_connection.sql?raw'
import profileUiTimerSql from '../../supabase/migrations/003_profile_ui_and_timer_log.sql?raw'

/** SQL миграций подряд: схема + подключение + UI/журнал таймера. */
export const PORTFOLIO_SCHEMA_SQL: string =
  `${portfolioSchemaSql.trim()}\n\n${profilesConnectionSql.trim()}\n\n${profileUiTimerSql.trim()}\n`

export const SUPABASE_SQL_INSTRUCTION = [
  'Откройте Supabase → SQL Editor, вставьте скрипт и выполните (Run).',
  'Нужен включённый Auth: строки привязаны к auth.users; триггер создаёт строку в profiles при регистрации.',
  'Anon key используйте только на клиенте; service_role не храните во фронтенде.',
].join(' ')
