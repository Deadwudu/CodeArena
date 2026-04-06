-- Теоретический тест: банк вопросов и прохождения. Выполнить в Supabase SQL Editor после основной схемы.

create table if not exists public.quiz_questions (
  id bigint generated always as identity primary key,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_index smallint not null check (correct_index between 0 and 3),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  question_ids bigint[] not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_attempts_user_created on public.quiz_attempts(user_id, created_at desc);

create table if not exists public.quiz_attempt_answers (
  attempt_id bigint not null references public.quiz_attempts(id) on delete cascade,
  question_id bigint not null references public.quiz_questions(id) on delete cascade,
  chosen_index smallint not null check (chosen_index between 0 and 3),
  primary key (attempt_id, question_id)
);

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;

drop policy if exists codearena_api_quiz_questions on public.quiz_questions;
create policy codearena_api_quiz_questions on public.quiz_questions for all using (true) with check (true);

drop policy if exists codearena_api_quiz_attempts on public.quiz_attempts;
create policy codearena_api_quiz_attempts on public.quiz_attempts for all using (true) with check (true);

drop policy if exists codearena_api_quiz_attempt_answers on public.quiz_attempt_answers;
create policy codearena_api_quiz_attempt_answers on public.quiz_attempt_answers for all using (true) with check (true);

-- 100 строк: 20 базовых вопросов × 5 с разными номерами в тексте (один раз)
insert into public.quiz_questions (question_text, option_a, option_b, option_c, option_d, correct_index)
select
  q.q || ' [вопрос №' || s.n || ']',
  q.a,
  q.b,
  q.c,
  q.d,
  q.corr::smallint
from generate_series(1, 100) as s(n)
cross join lateral (
  select * from (values
    (0, 'Чему равен результат typeof null в JavaScript?', 'object', 'null', 'undefined', 'number', 0),
    (1, 'Что означает аббревиатура JSON?', 'JavaScript Object Notation', 'Java Standard Object Notation', 'Joint Script Object Network', 'JavaScript Online Network', 0),
    (2, 'Какой HTTP-статус обычно означает «ресурс не найден»?', '404', '200', '500', '301', 0),
    (3, 'Что делает команда git commit?', 'фиксирует снимок изменений в репозитории', 'отправляет код на сервер', 'создаёт новую ветку', 'удаляет файлы', 0),
    (4, 'Сложность поиска элемента в неотсортированном массиве из n элементов в худшем случае', 'O(n)', 'O(1)', 'O(log n)', 'O(n²)', 0),
    (5, 'Какой протокол чаще используют для защищённого веб-трафика?', 'HTTPS', 'FTP', 'SMTP', 'SSH (только для shell)', 0),
    (6, 'Что такое IP-адрес?', 'идентификатор узла в сети', 'имя домена', 'пароль маршрутизатора', 'тип кабеля', 0),
    (7, 'Для чего нужен индекс в реляционной БД?', 'ускорить выборку по полю', 'хранить пароли', 'удалять дубликаты автоматически', 'шифровать таблицу', 0),
    (8, 'Что из перечисленного — язык разметки?', 'HTML', 'Python', 'PostgreSQL', 'Docker', 0),
    (9, 'Что такое рекурсия?', 'функция вызывает сама себя', 'цикл for', 'сортировка пузырьком', 'тип переменной', 0),
    (10, 'Какой порт по умолчанию у HTTP (без шифрования)?', '80', '443', '22', '3306', 0),
    (11, 'Что означает принцип DRY в разработке?', 'Don''t Repeat Yourself', 'Do Repeat Yourself', 'Debug React Yield', 'Data Relay Yard', 0),
    (12, 'Что из перечисленного — СУБД?', 'PostgreSQL', 'Kubernetes', 'Webpack', 'Redux', 0),
    (13, 'Что такое CSS?', 'стили оформления веб-страниц', 'язык программирования сервера', 'формат данных', 'протокол передачи', 0),
    (14, 'Что делает оператор === в JavaScript по сравнению с ==?', 'сравнивает без приведения типов', 'всегда приводит к строке', 'сравнивает только объекты', 'это то же самое', 0),
    (15, 'Что такое API?', 'интерфейс для взаимодействия программ', 'тип процессора', 'база изображений', 'язык разметки', 0),
    (16, 'Для чего используют Docker-контейнер?', 'изолированное окружение приложения', 'только хранение файлов', 'редактирование видео', 'шифрование диска', 0),
    (17, 'Что из перечисленного описывает связь «один ко многим» в БД?', 'одна запись A — много записей B', 'строго одна к одной', 'только между таблицами с одинаковым именем', 'связь не используется в SQL', 0),
    (18, 'Что такое latency в сети?', 'задержка передачи данных', 'пропускная способность', 'размер пакета', 'число ядер CPU', 0),
    (19, 'Зачем нужны unit-тесты?', 'проверять отдельные части кода', 'только нагружать сервер', 'заменять документацию полностью', 'ускорять компиляцию', 0)
  ) as t(ord, q, a, b, c, d, corr)
  where t.ord = (s.n - 1) % 20
) as q
where not exists (select 1 from public.quiz_questions limit 1);
