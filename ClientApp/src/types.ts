export type Screen = 'home' | 'tasks' | 'solve' | 'attempts' | 'admin' | 'auth' | 'tournaments' | 'quiz';

export type TournamentStatus = 'pending' | 'live' | 'finished';

export interface TournamentListItem {
  id: string;
  name: string;
  status: TournamentStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** ISO: авто-финиш активного тура (если задан при старте) */
  endsAt?: string | null;
  createdAt: string;
  taskCount: number;
  /** Участие текущего пользователя (нужен query userId в GET /api/tournaments) */
  joined: boolean;
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
  endsAt?: string | null;
  createdAt: string;
  taskCount: number;
  tasks: TournamentTaskPayload[];
  tasksHiddenUntilLive?: boolean;
}

export type TournamentPlayResponse =
  | {phase: 'waiting'; tournamentName: string; message: string; endsAt?: string | null}
  | {
      phase: 'task';
      tournamentName: string;
      taskIndex: number;
      taskCount: number;
      endsAt?: string | null;
      task: {id: string; title: string; description: string};
    }
  | {phase: 'await_complete'; tournamentName: string; taskCount: number; endsAt?: string | null}
  | {phase: 'done'; tournamentName: string; completedAt: string; endsAt?: string | null}
  | {phase: 'finished'; tournamentName: string; message: string; endsAt?: string | null};

export interface NotificationItem {
  id: number;
  title: string;
  body: string | null;
  linkKind: string | null;
  linkId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TournamentLeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  passCount: number;
  taskCount: number;
}

export interface TournamentLeaderboardResponse {
  tournamentId: string;
  tournamentName: string;
  taskCount: number;
  rows: TournamentLeaderboardRow[];
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

export interface QuizQuestionPublic {
  id: number;
  text: string;
  options: string[];
}

export interface QuizResultItem {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number;
  isCorrect: boolean;
}

export interface QuizAdminQuestionRow {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface QuizAdminAttemptRow {
  id: number;
  userId: string;
  username: string;
  createdAt: string;
  completedAt: string | null;
  questionCount: number;
  score: number | null;
}

export interface QuizAdminAttemptDetail {
  attemptId: number;
  userId: string;
  username: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  score?: number;
  total?: number;
  items: QuizResultItem[];
}

