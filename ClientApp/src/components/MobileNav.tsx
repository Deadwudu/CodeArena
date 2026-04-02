import React from 'react';
import {BarChart3, LogIn, Medal, Shield, Terminal, Trophy} from 'lucide-react';
import type {ApiUser, Screen} from '../types';
import {cn} from '../lib/utils';

interface MobileNavProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
  user: ApiUser | null;
}

export const MobileNav: React.FC<MobileNavProps> = ({currentScreen, onScreenChange, user}) => {
  const items: Array<{id: Screen; icon: React.ComponentType<{className?: string}>; label: string; hidden?: boolean}> = [
    {id: 'tasks', icon: Trophy, label: 'Задачи'},
    {id: 'tournaments', icon: Medal, label: 'Турниры'},
    {id: 'solve', icon: Terminal, label: 'Код'},
    {id: 'attempts', icon: BarChart3, label: 'Попытки'},
    {id: 'admin', icon: Shield, label: 'Админ', hidden: user?.role !== 'admin'},
    {id: 'auth', icon: LogIn, label: user ? 'Профиль' : 'Вход'},
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-low border-t border-outline-variant/10 z-50">
      <div className="flex justify-around py-2">
        {items
          .filter((i) => !i.hidden)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onScreenChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all',
                currentScreen === item.id ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-bold mt-1">{item.label}</span>
            </button>
          ))}
      </div>
    </nav>
  );
};
