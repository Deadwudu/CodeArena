# CodeArena

Монорепозиторий в **корне**: `ClientApp` (UI), `Server` (API).

## Фронтенд (Vercel)

1. Импорт репозитория в [Vercel](https://vercel.com).
2. **Root Directory** — корень (`.`). Сборка задаётся **`vercel.json`**.
3. **Обязательно:** переменная **`VITE_API_ORIGIN`** — полный URL бэкенда **без** слэша в конце (например `https://codearena-api.onrender.com`). Без неё запросы к `/api` не доходят до Node и вы увидите ошибку про JSON / HTML. После сохранения переменной сделайте **Redeploy**.

## Бэкенд

Каталог **`Server`**: `node server.js`, переменные в **`pass.env`** (в репо не попадает): Supabase URL и ключи.

## Локально

```bash
cd Server && npm install && node server.js
```

В другом терминале:

```bash
cd ClientApp && npm install && npm run dev
```

Vite проксирует `/api` на `http://localhost:3000` (см. `vite.config.ts`).

Откройте в IDE **корень репозитория** (`Diplom`), а не вложенную папку. Если после переноса осталась старая `CodeArena/` (файл занят процессом), закройте сервер/IDE и удалите её вручную.

## Турниры: таймер, комментарии проверки, уведомления

Выполните в Supabase SQL Editor скрипт [`Server/supabase-tournament-notifications.sql`](Server/supabase-tournament-notifications.sql) (колонки `ends_at`, `admin_comment`, таблица `user_notifications`). Без этого таймер и уведомления на бэкенде не заработают.

## Турниры: ошибка `tournaments_status_check`

Если при создании турнира в логах Postgres или в ответе API приходит нарушение **`tournaments_status_check`**, в базе задан другой набор допустимых значений `status`, чем в текущем коде (**`pending`**, **`live`**, **`finished`**). Выполните в Supabase → SQL Editor скрипт [`Server/fix-tournaments-status-constraint.sql`](Server/fix-tournaments-status-constraint.sql) (один раз).
