-- CodeArena schema for Supabase (PostgreSQL)
-- Target: third normal form (3NF) with categories preserved.

create extension if not exists pgcrypto;

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.difficulties (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  role_id uuid not null references public.app_roles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null,
  difficulty_code text not null references public.difficulties(code),
  category_id uuid not null references public.categories(id),
  created_by uuid references public.users(id),
  validation jsonb,
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists validation jsonb;

create table if not exists public.attempt_statuses (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id),
  source_code text not null,
  status_code text not null references public.attempt_statuses(code),
  created_at timestamptz not null default now()
);

create index if not exists idx_attempts_task_created_at
  on public.attempts(task_id, created_at desc);

create index if not exists idx_attempts_user_created_at
  on public.attempts(user_id, created_at desc);

insert into public.app_roles(code, name)
values ('admin', 'Administrator'), ('user', 'User')
on conflict (code) do nothing;

insert into public.difficulties(code, name)
values ('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')
on conflict (code) do nothing;

insert into public.attempt_statuses(code, name)
values ('PASS', 'Passed'), ('FAIL', 'Failed'), ('ERROR', 'Runtime Error')
on conflict (code) do nothing;

insert into public.categories(name)
values ('base')
on conflict (name) do nothing;

-- Администратор по умолчанию: логин admin, пароль 123. В продакшене смените пароль после первого входа.
insert into public.users (username, password, role_id)
select 'admin', '123', r.id
from public.app_roles r
where r.code = 'admin'
on conflict (username) do update set
  role_id = excluded.role_id;

-- Задачи + автопроверки (validation JSON). Категория: base
insert into public.tasks (id, title, description, difficulty_code, category_id, validation)
select v.id, v.title, v.description, v.difficulty_code, c.id, v.validation::jsonb
from public.categories c
cross join (
    values
        (
            'sum',
            'Сумма двух чисел',
            'Реализуйте функцию sum(a, b), возвращающую сумму.',
            'easy',
            '{"version":1,"export":"sum","cases":[{"args":[2,3],"expect":5},{"args":[10,5],"expect":15}]}'
        ),
        (
            'double',
            'Удвоить число',
            'Реализуйте функцию double(x), возвращающую x * 2.',
            'easy',
            '{"version":1,"export":"double","cases":[{"args":[4],"expect":8},{"args":[0],"expect":0}]}'
        ),
        (
            'max',
            'Максимум из двух',
            'Реализуйте функцию max(a, b), возвращающую большее число.',
            'easy',
            '{"version":1,"export":"max","cases":[{"args":[3,7],"expect":7},{"args":[-1,-5],"expect":-1}]}'
        ),
        (
            'abs',
            'Модуль числа',
            'Реализуйте функцию abs(x) — абсолютное значение.',
            'easy',
            '{"version":1,"export":"abs","cases":[{"args":[-5],"expect":5},{"args":[3],"expect":3}]}'
        ),
        (
            'isEven',
            'Чётное число',
            'Реализуйте isEven(n): true, если n чётное.',
            'easy',
            '{"version":1,"export":"isEven","cases":[{"args":[4],"expect":true},{"args":[7],"expect":false}]}'
        ),
        (
            'minArr',
            'Минимум в массиве',
            'Реализуйте minArr(arr) — минимальный элемент.',
            'easy',
            '{"version":1,"export":"minArr","cases":[{"args":[[3,1,4]],"expect":1},{"args":[[-2,0,5]],"expect":-2}]}'
        ),
        (
            'countVowels',
            'Гласные в строке',
            'Реализуйте countVowels(s) — число гласных латинских букв (a,e,i,o,u).',
            'easy',
            '{"version":1,"export":"countVowels","cases":[{"args":["hello"],"expect":2},{"args":["sky"],"expect":0}]}'
        ),
        (
            'reverse',
            'Разворот строки',
            'Реализуйте reverse(str).',
            'medium',
            '{"version":1,"export":"reverse","cases":[{"args":["abc"],"expect":"cba"}]}'
        ),
        (
            'isPalindrome',
            'Палиндром',
            'Реализуйте isPalindrome(s).',
            'medium',
            '{"version":1,"export":"isPalindrome","cases":[{"args":["racecar"],"expect":true},{"args":["hello"],"expect":false}]}'
        ),
        (
            'factorial',
            'Факториал',
            'Реализуйте factorial(n) для n >= 0.',
            'medium',
            '{"version":1,"export":"factorial","cases":[{"args":[5],"expect":120},{"args":[0],"expect":1}]}'
        ),
        (
            'unique',
            'Уникальный элемент',
            'Реализуйте unique(arr): число, встречающееся один раз.',
            'hard',
            '{"version":1,"export":"unique","cases":[{"args":[[1,2,3,2,1]],"expect":3}]}'
        )
) as v(id, title, description, difficulty_code, validation)
where c.name = 'base'
on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    difficulty_code = excluded.difficulty_code,
    category_id = excluded.category_id,
    validation = excluded.validation;

-- ---------------------------------------------------------------------------
-- Row Level Security (для ключа anon с Node-сервера)
-- Без политик PostgREST возвращает 0 строк → в JS .single() падает с:
-- "Cannot coerce the result to a single JSON object"
-- Надёжнее на бэкенде: SUPABASE_SERVICE_ROLE_KEY в pass.env (не коммитить, не в браузер).
-- ---------------------------------------------------------------------------

alter table public.app_roles enable row level security;
alter table public.difficulties enable row level security;
alter table public.categories enable row level security;
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.attempt_statuses enable row level security;
alter table public.attempts enable row level security;

drop policy if exists codearena_api_app_roles on public.app_roles;
create policy codearena_api_app_roles on public.app_roles for all using (true) with check (true);

drop policy if exists codearena_api_difficulties on public.difficulties;
create policy codearena_api_difficulties on public.difficulties for all using (true) with check (true);

drop policy if exists codearena_api_categories on public.categories;
create policy codearena_api_categories on public.categories for all using (true) with check (true);

drop policy if exists codearena_api_users on public.users;
create policy codearena_api_users on public.users for all using (true) with check (true);

drop policy if exists codearena_api_tasks on public.tasks;
create policy codearena_api_tasks on public.tasks for all using (true) with check (true);

drop policy if exists codearena_api_attempt_statuses on public.attempt_statuses;
create policy codearena_api_attempt_statuses on public.attempt_statuses for all using (true) with check (true);

drop policy if exists codearena_api_attempts on public.attempts;
create policy codearena_api_attempts on public.attempts for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Турниры (задачи задаёт админ вручную, без автопроверки)
-- ---------------------------------------------------------------------------

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'live', 'finished')),
  created_by uuid not null references public.users(id),
  started_at timestamptz,
  finished_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_tasks (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  sort_order int not null,
  title text not null,
  description text not null,
  unique (tournament_id, sort_order)
);

create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  current_task_index int not null default 0,
  completed_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.tournament_submissions (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  tournament_task_id uuid not null references public.tournament_tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source_code text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'PASS', 'FAIL')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id),
  admin_comment text,
  unique (tournament_task_id, user_id)
);

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

create index if not exists idx_tournament_submissions_tournament_submitted
  on public.tournament_submissions(tournament_id, submitted_at desc);

alter table public.tournaments enable row level security;
alter table public.tournament_tasks enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_submissions enable row level security;

alter table public.user_notifications enable row level security;

drop policy if exists codearena_api_user_notifications on public.user_notifications;
create policy codearena_api_user_notifications on public.user_notifications for all using (true) with check (true);

drop policy if exists codearena_api_tournaments on public.tournaments;
create policy codearena_api_tournaments on public.tournaments for all using (true) with check (true);

drop policy if exists codearena_api_tournament_tasks on public.tournament_tasks;
create policy codearena_api_tournament_tasks on public.tournament_tasks for all using (true) with check (true);

drop policy if exists codearena_api_tournament_participants on public.tournament_participants;
create policy codearena_api_tournament_participants on public.tournament_participants for all using (true) with check (true);

drop policy if exists codearena_api_tournament_submissions on public.tournament_submissions;
create policy codearena_api_tournament_submissions on public.tournament_submissions for all using (true) with check (true);
