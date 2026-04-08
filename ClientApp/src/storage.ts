import type {ApiUser} from './types';

const KEY = 'codearena:user';
const THEME_KEY = 'codearena:theme';

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

