import React, {useMemo} from 'react';
import {Bell, LogOut, Search, UserPlus} from 'lucide-react';
import type {ApiUser, Screen} from '../types';

interface TopBarProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  user: ApiUser | null;
  onSignOut: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onAuthLogin: () => void;
  onAuthRegister: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentScreen,
  onScreenChange,
  user,
  onSignOut,
  search,
  onSearchChange,
  onAuthLogin,
  onAuthRegister,
}) => {
  const showSearch = currentScreen === 'tasks' || currentScreen === 'attempts';

  const title = useMemo(() => {
    switch (currentScreen) {
      case 'home':
        return 'Главная';
      case 'tasks':
        return 'Задачи';
      case 'solve':
        return 'Решение';
      case 'attempts':
        return 'Попытки';
      case 'tournaments':
        return 'Турниры';
      case 'admin':
        return 'Админка';
      case 'auth':
        return user ? 'Профиль' : 'Вход';
      default:
        return 'CodeArena';
    }
  }, [currentScreen, user]);

  return (
    <header className="w-full h-16 sticky top-0 z-40 bg-background flex justify-between items-center px-8 border-b border-outline-variant/5">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className="text-sm font-headline font-bold text-on-surface shrink-0">{title}</div>
        {showSearch ? (
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Поиск по задачам..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary text-on-surface placeholder:text-on-surface-variant"
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all active:scale-95"
            aria-label="Уведомления"
          >
            <Bell className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-[1px] bg-outline-variant/30 mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-xs font-bold text-on-surface">{user?.username ?? 'Гость'}</span>
            <span className="text-[10px] text-primary uppercase font-bold tracking-tighter">{user?.role ?? 'guest'}</span>
          </div>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => onScreenChange('auth')}
                className="w-9 h-9 rounded-full bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 transition-colors"
                aria-label="Профиль"
              />
              <button
                type="button"
                onClick={onSignOut}
                className="text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors hidden sm:flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onAuthLogin}
                className="hidden sm:inline-flex px-4 py-2 rounded-lg border border-outline-variant/30 text-sm font-headline font-bold text-on-surface hover:bg-surface-container-highest transition-all"
              >
                Войти
              </button>
              <button
                type="button"
                onClick={onAuthRegister}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-secondary-container to-secondary text-on-secondary-container text-sm font-headline font-bold shadow-md hover:brightness-110 transition-all"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                Регистрация
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
