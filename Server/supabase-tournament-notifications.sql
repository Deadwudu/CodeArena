-- Одноразово в Supabase SQL Editor: таймер турниров, комментарий к проверке, уведомления.

alter table public.tournaments add column if not exists ends_at timestamptz;

alter table public.tournament_submissions add column if not exists admin_comment text;

create table if not exists public.user_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text,
  link_kind text,
  link_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists codearena_api_user_notifications on public.user_notifications;
create policy codearena_api_user_notifications on public.user_notifications for all using (true) with check (true);
