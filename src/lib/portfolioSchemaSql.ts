import portfolioSchemaSql from '../../supabase/migrations/001_portfolio_schema.sql?raw'
import profilesConnectionSql from '../../supabase/migrations/002_profiles_supabase_connection.sql?raw'
import profileUiTimerSql from '../../supabase/migrations/003_profile_ui_and_timer_log.sql?raw'
import readOnlyModeSql from '../../supabase/migrations/004_read_only_mode.sql?raw'
import workspaceExtrasSql from '../../supabase/migrations/005_workspace_extras.sql?raw'
import telegramNotificationsSql from '../../supabase/migrations/006_telegram_notifications.sql?raw'

/** SQL миграций подряд (001–006) для копирования в Supabase SQL Editor. */
export const PORTFOLIO_SCHEMA_SQL: string =
  `${portfolioSchemaSql.trim()}\n\n${profilesConnectionSql.trim()}\n\n${profileUiTimerSql.trim()}\n\n${readOnlyModeSql.trim()}\n\n${workspaceExtrasSql.trim()}\n\n${telegramNotificationsSql.trim()}\n`

export const SUPABASE_SQL_INSTRUCTION = [
  'Откройте Supabase → SQL Editor, вставьте скрипт и выполните (Run).',
  'Нужен включённый Auth: строки привязаны к auth.users; триггер создаёт строку в profiles при регистрации.',
  'Anon key используйте только на клиенте; service_role не храните во фронтенде.',
].join(' ')
