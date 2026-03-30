import type {ApiUser} from './types';

const KEY = 'codearena:user';

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

