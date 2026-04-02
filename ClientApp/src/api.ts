import type {AdminUserStat, ApiAttempt, ApiAttemptWithUser, ApiTask, ApiUser} from './types';

/** Продакшен: URL Node-сервера с /api (без слэша в конце), напр. https://codearena.onrender.com */
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';

function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !API_ORIGIN) return input;
  return `${API_ORIGIN}${input.startsWith('/') ? input : `/${input}`}`;
}

function looksLikeHtml(body: string) {
  const t = body.trimStart();
  return t.startsWith('<') || t.toLowerCase().startsWith('<!doctype');
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const url = resolveApiUrl(input);
  if (typeof input === 'string' && import.meta.env.PROD && !API_ORIGIN && input.startsWith('/api')) {
    console.warn(
      '[CodeArena] VITE_API_ORIGIN не задан: запросы /api уходят на тот же хост и не попадут на Node. Задайте переменную в Vercel и пересоберите проект.',
    );
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text().catch(() => '');

  if (looksLikeHtml(text)) {
    throw new Error(
      'Сервер вернул страницу (HTML), а не JSON. Для деплоя фронта на Vercel укажите в Environment Variables переменную VITE_API_ORIGIN — полный URL вашего бэкенда (Render/Railway/…), без слэша в конце, например https://my-api.onrender.com — затем Redeploy.',
    );
  }

  if (!res.ok) {
    let msg = text.trim() || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as {error?: string; message?: string};
      if (j?.error) msg = String(j.error);
      else if (j?.message) msg = String(j.message);
    } catch {
      /* not JSON */
    }
    throw new Error(msg);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Ожидался JSON, получено: ${text.slice(0, 160)}${text.length > 160 ? '…' : ''}`);
  }
}

export function getTasks() {
  return request<ApiTask[]>('/api/tasks');
}

export function getTask(id: string) {
  return request<ApiTask>(`/api/tasks/${encodeURIComponent(id)}`);
}

export function getAttempts(taskId?: string, userId?: number | string | null) {
  const params = new URLSearchParams();
  if (userId != null && userId !== '') {
    params.set('userId', String(userId));
  }
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';
  if (taskId) {
    return request<ApiAttempt[]>(`/api/attempts/${encodeURIComponent(taskId)}${suffix}`);
  }
  return request<ApiAttempt[]>(`/api/attempts${suffix}`);
}

export function runSolution(args: {
  taskId: string;
  code: string;
  userId?: number | string | null;
}) {
  return request<{result: string; error?: string}>('/api/run', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function login(args: {username: string; password: string}) {
  return request<ApiUser>('/api/login', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function register(args: {username: string; password: string}) {
  return request<{success: true}>('/api/register', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function createTask(args: {
  title: string;
  difficulty: string;
  description: string;
  userId: number | string;
  validation?: unknown;
}) {
  return request<{success: true}>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function deleteTask(args: {id: string; userId: number | string}) {
  return request<{success: true}>(`/api/tasks/${encodeURIComponent(args.id)}`, {
    method: 'DELETE',
    body: JSON.stringify({userId: args.userId}),
  });
}

export function getAdminUsersStats(adminUserId: number | string) {
  return request<{users: AdminUserStat[]}>(
    `/api/admin/users-stats?userId=${encodeURIComponent(String(adminUserId))}`,
  );
}

export function getAdminTaskAttempts(taskId: string, adminUserId: number | string) {
  return request<ApiAttemptWithUser[]>(
    `/api/admin/tasks/${encodeURIComponent(taskId)}/attempts?userId=${encodeURIComponent(String(adminUserId))}`,
  );
}

/** forUserId: id пользователя или `__guest__` для попыток без аккаунта */
export function getAdminUserAttempts(forUserId: string, adminUserId: number | string) {
  return request<ApiAttempt[]>(
    `/api/admin/user-attempts?userId=${encodeURIComponent(String(adminUserId))}&forUserId=${encodeURIComponent(forUserId)}`,
  );
}

