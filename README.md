# CodeArena

Монорепозиторий в **корне**: `ClientApp` (UI), `Server` (API), `client` (статический легаси-клиент).

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
