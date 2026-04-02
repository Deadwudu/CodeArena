import type {
  AdminUserStat,
  ApiAttempt,
  ApiAttemptWithUser,
  ApiTask,
  ApiUser,
  NotificationItem,
  TournamentDetail,
  TournamentLeaderboardResponse,
  TournamentListItem,
  TournamentPlayResponse,
  UserStatsSummary,
} from './types';

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

export function getUserStats(userId: number | string) {
  return request<UserStatsSummary>(`/api/user/stats?userId=${encodeURIComponent(String(userId))}`);
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
  id?: string;
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

export function fillExpectFromReference(args: {
  userId: number | string;
  exportName: string;
  referenceCode: string;
  cases: { args: unknown[] }[];
}) {
  return request<{cases: {args: unknown[]; expect: unknown}[]}>('/api/admin/fill-expect-from-reference', {
    method: 'POST',
    body: JSON.stringify({
      userId: args.userId,
      export: args.exportName,
      referenceCode: args.referenceCode,
      cases: args.cases,
    }),
  });
}

export function patchAdminAttemptStatus(args: {
  attemptId: number;
  status: 'PASS' | 'FAIL';
  adminUserId: number | string;
}) {
  return request<{success: true; status: string}>(`/api/admin/attempts/${args.attemptId}`, {
    method: 'PATCH',
    body: JSON.stringify({userId: args.adminUserId, status: args.status}),
  });
}

export function listTournaments(userId?: number | string | null) {
  const q =
    userId != null && userId !== ''
      ? `?userId=${encodeURIComponent(String(userId))}`
      : '';
  return request<TournamentListItem[]>(`/api/tournaments${q}`);
}

export function getTournament(id: string, adminUserId?: number | string | null) {
  const q =
    adminUserId != null && adminUserId !== ''
      ? `?adminUserId=${encodeURIComponent(String(adminUserId))}`
      : '';
  return request<TournamentDetail>(`/api/tournaments/${encodeURIComponent(id)}${q}`);
}

export function createTournament(args: {
  userId: number | string;
  name: string;
  tasks: {title: string; description: string}[];
}) {
  return request<{success: boolean}>('/api/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify(args),
  });
}

export function goLiveTournament(
  tournamentId: string,
  userId: number | string,
  durationMinutes?: number | null,
) {
  return request<{success: boolean}>(
    `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/go-live`,
    {
      method: 'POST',
      body: JSON.stringify({
        userId,
        ...(durationMinutes != null && durationMinutes > 0 ? {durationMinutes} : {}),
      }),
    },
  );
}

export function finishTournament(tournamentId: string, userId: number | string) {
  return request<{success: boolean}>(
    `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/finish`,
    {method: 'POST', body: JSON.stringify({userId})},
  );
}

export function joinTournament(tournamentId: string, userId: number | string) {
  return request<{success: boolean}>(`/api/tournaments/${encodeURIComponent(tournamentId)}/join`, {
    method: 'POST',
    body: JSON.stringify({userId}),
  });
}

export function getTournamentLeaderboard(tournamentId: string) {
  return request<TournamentLeaderboardResponse>(
    `/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`,
  );
}

export function getTournamentPlay(tournamentId: string, userId: number | string) {
  return request<TournamentPlayResponse>(
    `/api/tournaments/${encodeURIComponent(tournamentId)}/play?userId=${encodeURIComponent(String(userId))}`,
  );
}

export function submitTournamentTask(tournamentId: string, userId: number | string, code: string) {
  return request<{success: boolean; nextTaskIndex: number; allTasksSubmitted: boolean}>(
    `/api/tournaments/${encodeURIComponent(tournamentId)}/submit`,
    {method: 'POST', body: JSON.stringify({userId, code})},
  );
}

export function completeTournamentParticipant(tournamentId: string, userId: number | string) {
  return request<{success: boolean}>(`/api/tournaments/${encodeURIComponent(tournamentId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({userId}),
  });
}

export function getTournamentSummary(tournamentId: string, userId: number | string) {
  return request<{
    tasks: Array<{
      taskId: string;
      title: string;
      code: string;
      reviewStatus: string;
      adminComment?: string | null;
      label: string;
      labelRu: string;
    }>;
  }>(`/api/tournaments/${encodeURIComponent(tournamentId)}/summary?userId=${encodeURIComponent(String(userId))}`);
}

export type TournamentSubmissionRow = {
  id: number;
  tournamentTaskId: string;
  taskTitle: string;
  userId: string;
  username: string;
  code: string;
  reviewStatus: string;
  submittedAt: string;
  adminComment?: string | null;
};

export function listTournamentSubmissions(tournamentId: string, adminUserId: number | string) {
  return request<TournamentSubmissionRow[]>(
    `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/submissions?userId=${encodeURIComponent(String(adminUserId))}`,
  );
}

export function patchTournamentSubmission(args: {
  submissionId: number;
  status: 'PASS' | 'FAIL';
  adminUserId: number | string;
  comment?: string;
}) {
  return request<{success: boolean}>(`/api/admin/tournament-submissions/${args.submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      userId: args.adminUserId,
      status: args.status,
      ...(args.comment != null && args.comment !== '' ? {comment: args.comment} : {}),
    }),
  });
}

export function listNotifications(userId: number | string) {
  return request<{unreadCount: number; items: NotificationItem[]}>(
    `/api/notifications?userId=${encodeURIComponent(String(userId))}`,
  );
}

export function markNotificationRead(notificationId: number, userId: number | string) {
  return request<{success: boolean}>(`/api/notifications/${encodeURIComponent(String(notificationId))}/read`, {
    method: 'POST',
    body: JSON.stringify({userId}),
  });
}

