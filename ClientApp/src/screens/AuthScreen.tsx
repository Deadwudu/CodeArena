import React, {useState} from 'react';
import {motion} from 'motion/react';
import {Loader2, UserPlus} from 'lucide-react';
import type {ApiUser, AuthMode} from '../types';
import {login, register} from '../api';
import {cn} from '../lib/utils';

export const AuthScreen: React.FC<{
  user: ApiUser | null;
  onUser: (user: ApiUser | null) => void;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}> = ({user, onUser, mode, onModeChange}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async () => {
    try {
      setError(null);
      setLoading(true);
      const u = await login({username, password});
      onUser(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    try {
      setError(null);
      setLoading(true);
      await register({username, password});
      const u = await login({username, password});
      onUser(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="p-8 max-w-3xl mx-auto w-full">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">{user ? 'Аккаунт' : 'Вход и регистрация'}</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Эндпоинты <code className="text-primary">/api/login</code> и <code className="text-primary">/api/register</code>.
            </p>
          </div>
          {user ? (
            <button
              type="button"
              onClick={() => onUser(null)}
              className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-bold hover:brightness-110 transition-all"
            >
              Выйти
            </button>
          ) : null}
        </div>

        {user ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Username</div>
              <div className="text-on-surface font-bold mt-1">{user.username}</div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Role</div>
              <div className="text-primary font-bold mt-1">{user.role}</div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">User ID</div>
              <div className="text-on-surface font-bold mt-1">{String(user.id)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-surface-container border border-outline-variant/10">
              <button
                type="button"
                onClick={() => {
                  onModeChange('login');
                  setError(null);
                }}
                className={cn(
                  'py-3 px-4 rounded-lg text-sm font-headline font-bold transition-all',
                  mode === 'login' ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary-container shadow-lg shadow-primary/10' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => {
                  onModeChange('register');
                  setError(null);
                }}
                className={cn(
                  'py-3 px-4 rounded-lg text-sm font-headline font-bold transition-all inline-flex items-center justify-center gap-2',
                  mode === 'register'
                    ? 'bg-gradient-to-r from-secondary-container to-secondary text-on-secondary-container shadow-lg shadow-secondary/10'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                <UserPlus className="w-4 h-4" />
                Регистрация
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Логин</div>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                />
              </label>
              <label className="block">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Пароль</div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                />
              </label>
            </div>

            {error ? <div className="text-error text-sm whitespace-pre-wrap">{error}</div> : null}

            {mode === 'login' ? (
              <button
                type="button"
                onClick={submitLogin}
                disabled={loading || !username || !password}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold shadow-lg shadow-primary/10 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Войти
              </button>
            ) : (
              <button
                type="button"
                onClick={submitRegister}
                disabled={loading || !username || !password}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-secondary-container to-secondary text-on-secondary-container font-bold shadow-lg shadow-secondary/10 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Зарегистрироваться
              </button>
            )}
          </div>
        )}
      </section>
    </motion.div>
  );
};
