import type {ApiAttempt, ApiTask, ApiUser} from './types';

/** Продакшен: URL Node-сервера с /api (без слэша в конце), напр. https://codearena.onrender.com */
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? '';

function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input !== 'string' || !API_ORIGIN) return input;
  return `${API_ORIGIN}${input.startsWith('/') ? input : `/${input}`}`;
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveApiUrl(input), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
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

  return (await res.json()) as T;
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

