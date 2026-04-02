import React from 'react';
import {BarChart3, Home, LogIn, Medal, Shield, Terminal, Trophy} from 'lucide-react';
import type {Screen} from '../types';
import {cn} from '../lib/utils';
import type {ApiUser} from '../types';

interface SidebarProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  user: ApiUser | null;
}

export const Sidebar: React.FC<SidebarProps> = ({currentScreen, onScreenChange, user}) => {
  const navItems: Array<{id: Screen; label: string; icon: React.ComponentType<{className?: string}>}> = [
    {id: 'home', label: 'Главная', icon: Home},
    {id: 'tasks', label: 'Задачи', icon: Trophy},
    {id: 'tournaments', label: 'Турниры', icon: Medal},
    {id: 'attempts', label: 'Мои попытки', icon: BarChart3},
    {id: 'solve', label: 'Решение', icon: Terminal},
    {id: 'admin', label: 'Админка', icon: Shield},
    {id: 'auth', label: user ? 'Профиль' : 'Вход', icon: LogIn},
  ];

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface-container-low py-6 px-4 z-50 border-r border-outline-variant/10">
      <button
        type="button"
        onClick={() => onScreenChange('home')}
        className="flex items-center gap-3 mb-10 px-2 w-full text-left rounded-xl py-1 -mx-1 hover:bg-surface-container-highest/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
          <Terminal className="text-on-primary-container w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary font-headline tracking-tighter">CodeArena</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-medium">Practice & Compete</p>
        </div>
      </button>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const disabled = item.id === 'admin' && user?.role !== 'admin';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => !disabled && onScreenChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 font-headline font-medium text-sm transition-all duration-200 rounded-lg group',
                currentScreen === item.id
                  ? 'text-primary bg-surface-container-highest border-r-4 border-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-highest/50 hover:text-on-surface',
                disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-on-surface-variant',
              )}
            >
              <item.icon className={cn('w-5 h-5', currentScreen === item.id && 'fill-primary/20')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
