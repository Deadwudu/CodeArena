import type {ApiUser, AuthMode, Screen} from './types';

const KEY = 'codearena:user';
const THEME_KEY = 'codearena:theme';
const NAV_KEY = 'codearena:nav';

const VALID_SCREENS: Screen[] = [
  'home',
  'tasks',
  'solve',
  'attempts',
  'admin',
  'auth',
  'tournaments',
  'quiz',
];

export type PersistedNavigation = {
  screen: Screen;
  taskId: string | null;
  authMode: AuthMode;
};

export function loadPersistedNav(): PersistedNavigation | null {
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<PersistedNavigation>;
    if (typeof j.screen !== 'string' || !VALID_SCREENS.includes(j.screen as Screen)) return null;
    return {
      screen: j.screen as Screen,
      taskId: typeof j.taskId === 'string' && j.taskId ? j.taskId : null,
      authMode: j.authMode === 'register' ? 'register' : 'login',
    };
  } catch {
    return null;
  }
}

export function savePersistedNav(state: PersistedNavigation): void {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Стартовый экран после F5: из storage + простые проверки (без мигания «главной»). */
export function getInitialNavigation(): PersistedNavigation {
  const p = loadPersistedNav();
  const u = loadUser();
  if (!p) return {screen: 'home', taskId: null, authMode: 'login'};
  let {screen, taskId, authMode} = p;
  if (screen === 'solve' && !taskId) {
    screen = 'tasks';
    taskId = null;
  }
  if (screen === 'admin' && u?.role !== 'admin') screen = 'home';
  return {screen, taskId, authMode};
}

export type ThemeMode = 'light' | 'dark';

export function loadTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function saveTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function loadUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

export function saveUser(user: ApiUser | null) {
  if (!user) {
    localStorage.removeItem(KEY);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(user));
}

