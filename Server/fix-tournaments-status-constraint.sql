-- Исправление ошибки: new row for relation "tournaments" violates check constraint "tournaments_status_check"
-- Приложение использует status: pending | live | finished (см. server.js и supabase-schema.sql).
-- Выполните один раз в Supabase → SQL Editor, если constraint в БД расходится с этим набором.

alter table public.tournaments drop constraint if exists tournaments_status_check;

-- Приведите существующие строки к допустимым значениям (при необходимости расширьте маппинг под ваши старые коды).
update public.tournaments
set status = 'pending'
where status is null or status not in ('pending', 'live', 'finished');

alter table public.tournaments
  add constraint tournaments_status_check
  check (status in ('pending', 'live', 'finished'));
