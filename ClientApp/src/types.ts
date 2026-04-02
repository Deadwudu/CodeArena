export type Screen = 'tasks' | 'solve' | 'attempts' | 'admin' | 'auth' | 'tournaments';

export type TournamentStatus = 'pending' | 'live' | 'finished';

export interface TournamentListItem {
  id: string;
  name: string;
  status: TournamentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  taskCount: number;
}

export interface TournamentTaskPayload {
  id: string;
  sortOrder?: number;
  title: string;
  description: string;
}

export interface TournamentDetail {
  id: string;
  name: string;
  status: TournamentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  taskCount: number;
  tasks: TournamentTaskPayload[];
  tasksHiddenUntilLive?: boolean;
}

export type AuthMode = 'login' | 'register';

export type Difficulty = 'easy' | 'medium' | 'hard' | string;

export interface ApiTask {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  category?: string | null;
}

export type AttemptResult = 'PASS' | 'FAIL' | 'ERROR' | string;

export interface ApiAttempt {
  id: number;
  taskId: string;
  code: string;
  result: AttemptResult;
  createdAt: string;
  userId?: number | string | null;
}

export type Role = 'admin' | 'user' | string;

export interface ApiUser {
  id: number | string;
  username: string;
  role: Role;
}

export interface AdminUserStat {
  id: string | null;
  username: string;
  role: string;
  createdAt: string | null;
  attemptCount: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  distinctTaskCount: number;
}

export interface ApiAttemptWithUser extends ApiAttempt {
  username?: string;
}

/** По всем задачам каталога; по каждой задаче — только последняя попытка пользователя. */
export interface UserStatsSummary {
  pass: number;
  failed: number;
  unsolved: number;
  totalTasks: number;
  totalSubmissions: number;
}

