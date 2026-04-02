import React, {useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {Loader2, UserPlus} from 'lucide-react';
import type {ApiUser, AuthMode, UserStatsSummary} from '../types';
import {getUserStats, login, register} from '../api';
import {cn} from '../lib/utils';

const CHART_PASS = '#81ecff';
const CHART_FAIL = '#ff716c';
const CHART_ERR = '#fd8b00';

function ProfileStatsDonut({ stats }: { stats: UserStatsSummary }) {
  const { pass, fail, error: err } = stats;
  const total = pass + fail + err;
  if (total === 0) {
    return (
      <p className="text-sm text-on-surface-variant text-center py-6">
        Пока нет учтённых задач. Решите задачу и отправьте код — в статистику попадёт только <strong>последняя</strong> попытка по каждой задаче.
      </p>
    );
  }
  const degPass = (pass / total) * 360;
  const degFail = (fail / total) * 360;
  const degErr = (err / total) * 360;
  const p1 = degPass;
  const p2 = p1 + degFail;
  const bg = `conic-gradient(${CHART_PASS} 0deg ${p1}deg, ${CHART_FAIL} ${p1}deg ${p2}deg, ${CHART_ERR} ${p2}deg 360deg)`;

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-8">
      <div className="relative w-44 h-44 shrink-0 mx-auto md:mx-0">
        <div className="w-full h-full rounded-full" style={{ background: bg }} />
        <div className="absolute inset-[20%] rounded-full bg-surface-container-low border border-outline-variant/10 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-headline text-on-surface">{total}</span>
          <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">задач</span>
        </div>
      </div>
      <ul className="flex-1 space-y-3 text-sm">
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-on-surface">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CHART_PASS }} />
            Удачные (PASS)
          </span>
          <span className="font-mono font-bold text-on-surface">
            {pass} ({Math.round((pass / total) * 100)}%)
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-on-surface">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CHART_FAIL }} />
            Неудачные (FAIL)
          </span>
          <span className="font-mono font-bold text-on-surface">
            {fail} ({Math.round((fail / total) * 100)}%)
          </span>
        </li>
        <li className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-on-surface">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: CHART_ERR }} />
            Ошибки (ERROR)
          </span>
          <span className="font-mono font-bold text-on-surface">
            {err} ({Math.round((err / total) * 100)}%)
          </span>
        </li>
      </ul>
    </div>
  );
}

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
  const [ stats, setStats ] = useState<UserStatsSummary | null>(null);
  const [ statsLoading, setStatsLoading ] = useState(false);

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

  useEffect(() => {
    if (!user) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    getUserStats(user.id)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ user ]);

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
            <h3 className="text-xl font-bold font-headline text-on-surface">{user ? 'Профиль' : 'Вход и регистрация'}</h3>
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
          <div className="mt-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Логин</div>
                <div className="text-on-surface font-bold mt-1">{user.username}</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Роль</div>
                <div className="text-primary font-bold mt-1">{user.role}</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-container border border-outline-variant/5">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">ID</div>
                <div className="text-on-surface font-bold mt-1 break-all text-xs">{String(user.id)}</div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-surface-container border border-outline-variant/5">
              <h4 className="text-lg font-bold font-headline text-on-surface mb-1">Статистика решений</h4>
              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                Диаграмма строится по <strong>последней попытке на каждую задачу</strong>: если вы несколько раз отправляли код по одной задаче, в зачёт идёт только итог последней отправки.
                Всего отправок кода (все попытки):{' '}
                {statsLoading ? '…' : stats !== null ? <strong>{stats.totalSubmissions}</strong> : '—'}.
              </p>
              {statsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : stats ? (
                <ProfileStatsDonut stats={stats} />
              ) : null}
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
