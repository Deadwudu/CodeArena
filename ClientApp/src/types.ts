export type Screen = 'tasks' | 'solve' | 'attempts' | 'admin' | 'auth';

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

/** Соотношение результатов по последней попытке на каждую задачу. */
export interface UserStatsSummary {
  pass: number;
  fail: number;
  error: number;
  tasksConsidered: number;
  totalSubmissions: number;
}

