import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {ChevronDown, Loader2, Trash2} from 'lucide-react';
import type {AdminUserStat, ApiAttempt, ApiAttemptWithUser, ApiTask, ApiUser} from '../types';
import {
  createTask,
  deleteTask,
  getAdminTaskAttempts,
  getAdminUserAttempts,
  getAdminUsersStats,
  getTasks,
} from '../api';

function userStatKey(u: AdminUserStat): string {
  if (u.id === null) return '__guest__';
  return String(u.id);
}

function resultBadgeClass(result: string) {
  if (result === 'PASS') return 'bg-primary/20 text-primary';
  if (result === 'FAIL') return 'bg-error/15 text-error';
  return 'bg-tertiary-container text-on-primary-container';
}

export const AdminScreen: React.FC<{user: ApiUser | null}> = ({user}) => {
  const [ tasks, setTasks ] = useState<ApiTask[]>([]);
  const [ loading, setLoading ] = useState(true);
  const [ error, setError ] = useState<string | null>(null);

  const [ title, setTitle ] = useState('');
  const [ difficulty, setDifficulty ] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [ description, setDescription ] = useState('');
  const [ validationJson, setValidationJson ] = useState('');

  const [ userStats, setUserStats ] = useState<AdminUserStat[]>([]);
  const [ loadingStats, setLoadingStats ] = useState(false);

  const [ selectedUserKey, setSelectedUserKey ] = useState<string>('');
  const [ userAttempts, setUserAttempts ] = useState<ApiAttempt[]>([]);
  const [ loadingUserAttempts, setLoadingUserAttempts ] = useState(false);
  const [ selectedTaskForUser, setSelectedTaskForUser ] = useState<string>('');

  const [ selectedTaskGlobal, setSelectedTaskGlobal ] = useState<string>('');
  const [ taskAttemptsAll, setTaskAttemptsAll ] = useState<ApiAttemptWithUser[]>([]);
  const [ loadingTaskAttempts, setLoadingTaskAttempts ] = useState(false);

  const canAccess = user?.role === 'admin';

  const reloadTasks = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await getTasks();
      setTasks(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadStats = useCallback(async () => {
    if (!user || !canAccess) return;
    setLoadingStats(true);
    try {
      const { users } = await getAdminUsersStats(user.id);
      setUserStats(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingStats(false);
    }
  }, [ user, canAccess ]);

  useEffect(() => {
    void reloadTasks();
  }, [ reloadTasks ]);

  useEffect(() => {
    if (canAccess && user) void reloadStats();
  }, [ canAccess, user, reloadStats ]);

  const sortedTasks = useMemo(() => [ ...tasks ].sort((a, b) => a.title.localeCompare(b.title)), [ tasks ]);

  const taskTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.title);
    return m;
  }, [ tasks ]);

  const tasksForSelectedUser = useMemo(() => {
    const ids = [ ...new Set(userAttempts.map((a) => a.taskId)) ];
    return ids
      .map((id) => ({ id, title: taskTitleById.get(id) ?? id }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [ userAttempts, taskTitleById ]);

  const filteredUserAttempts = useMemo(() => {
    if (!selectedTaskForUser) return userAttempts;
    return userAttempts.filter((a) => a.taskId === selectedTaskForUser);
  }, [ userAttempts, selectedTaskForUser ]);

  /** По задачам: заголовок задачи → попытки (новые сверху внутри группы) */
  const userAttemptsByTask = useMemo(() => {
    const map = new Map<string, ApiAttempt[]>();
    for (const a of filteredUserAttempts) {
      if (!map.has(a.taskId)) map.set(a.taskId, []);
      map.get(a.taskId)!.push(a);
    }
    for (const [, arr] of map) {
      arr.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
    }
    const keys = [ ...map.keys() ].sort((ta, tb) => {
      const na = taskTitleById.get(ta) ?? ta;
      const nb = taskTitleById.get(tb) ?? tb;
      return na.localeCompare(nb);
    });
    return keys.map((taskId) => ({ taskId, title: taskTitleById.get(taskId) ?? taskId, attempts: map.get(taskId)! }));
  }, [ filteredUserAttempts, taskTitleById ]);

  useEffect(() => {
    if (!canAccess || !user || !selectedUserKey) {
      setUserAttempts([]);
      return;
    }
    let cancelled = false;
    setLoadingUserAttempts(true);
    getAdminUserAttempts(selectedUserKey, user.id)
      .then((rows) => {
        if (!cancelled) setUserAttempts(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingUserAttempts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ canAccess, user, selectedUserKey ]);

  useEffect(() => {
    setSelectedTaskForUser('');
  }, [ selectedUserKey ]);

  useEffect(() => {
    if (!canAccess || !user || !selectedTaskGlobal) {
      setTaskAttemptsAll([]);
      return;
    }
    let cancelled = false;
    setLoadingTaskAttempts(true);
    getAdminTaskAttempts(selectedTaskGlobal, user.id)
      .then((rows) => {
        if (!cancelled) setTaskAttemptsAll(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingTaskAttempts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ canAccess, user, selectedTaskGlobal ]);

  const onCreate = async () => {
    if (!user) return;
    try {
      setError(null);
      let validation: unknown = undefined;
      const raw = validationJson.trim();
      if (raw) {
        try {
          validation = JSON.parse(raw);
        } catch {
          setError('validation: невалидный JSON');
          return;
        }
      }
      await createTask({ title, difficulty, description, userId: user.id, validation });
      setTitle('');
      setDescription('');
      setValidationJson('');
      await reloadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async (id: string) => {
    if (!user) return;
    try {
      setError(null);
      await deleteTask({ id, userId: user.id });
      await reloadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const refreshAll = () => {
    void reloadTasks();
    void reloadStats();
    if (selectedUserKey && user) {
      setLoadingUserAttempts(true);
      getAdminUserAttempts(selectedUserKey, user.id)
        .then(setUserAttempts)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingUserAttempts(false));
    }
    if (selectedTaskGlobal && user) {
      setLoadingTaskAttempts(true);
      getAdminTaskAttempts(selectedTaskGlobal, user.id)
        .then(setTaskAttemptsAll)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoadingTaskAttempts(false));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">Админка</h3>
            <p className="text-sm text-on-surface-variant">
              Статистика пользователей, просмотр попыток по пользователю и по задаче. Задачи и <code className="text-primary">validation</code> — в Supabase.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-bold hover:brightness-110 transition-all"
          >
            Обновить
          </button>
        </div>

        {!canAccess ? (
          <div className="mt-8 text-error text-sm">Нет доступа. Нужна роль admin.</div>
        ) : null}

        {error ? <div className="mt-4 text-error text-sm whitespace-pre-wrap">{error}</div> : null}
      </section>

      {canAccess ? (
        <>
          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
            <h4 className="text-lg font-bold text-on-surface mb-1">Статистика пользователей</h4>
            <p className="text-xs text-on-surface-variant mb-4">Попытки и результаты по каждому аккаунту (и без аккаунта).</p>

            {loadingStats ? (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка…
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-outline-variant/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-container text-left text-on-surface-variant text-[10px] uppercase tracking-wider">
                      <th className="p-3 font-bold">Пользователь</th>
                      <th className="p-3 font-bold">Роль</th>
                      <th className="p-3 font-bold text-right">Попыток</th>
                      <th className="p-3 font-bold text-right">PASS</th>
                      <th className="p-3 font-bold text-right">FAIL</th>
                      <th className="p-3 font-bold text-right">Ошибок</th>
                      <th className="p-3 font-bold text-right">Задач</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.map((row) => (
                      <tr key={userStatKey(row)} className="border-t border-outline-variant/10 text-on-surface">
                        <td className="p-3 font-medium">{row.username}</td>
                        <td className="p-3 text-on-surface-variant">{row.role}</td>
                        <td className="p-3 text-right tabular-nums">{row.attemptCount}</td>
                        <td className="p-3 text-right tabular-nums text-primary">{row.passCount}</td>
                        <td className="p-3 text-right tabular-nums">{row.failCount}</td>
                        <td className="p-3 text-right tabular-nums">{row.errorCount}</td>
                        <td className="p-3 text-right tabular-nums">{row.distinctTaskCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
            <h4 className="text-lg font-bold text-on-surface mb-1">По пользователю</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Выберите пользователя, затем задачу — отобразятся его попытки (новые сверху).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Пользователь</div>
                <div className="relative">
                  <select
                    value={selectedUserKey}
                    onChange={(e) => setSelectedUserKey(e.target.value)}
                    className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none pr-10"
                  >
                    <option value="">— выберите —</option>
                    {userStats.map((u) => (
                      <option key={userStatKey(u)} value={userStatKey(u)}>
                        {u.username} ({u.attemptCount} попыток)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                </div>
              </label>
              <label className="block">
                <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Задача</div>
                <div className="relative">
                  <select
                    value={selectedTaskForUser}
                    onChange={(e) => setSelectedTaskForUser(e.target.value)}
                    disabled={!selectedUserKey || tasksForSelectedUser.length === 0}
                    className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none pr-10 disabled:opacity-50"
                  >
                    <option value="">Все задачи с попытками</option>
                    {tasksForSelectedUser.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
                </div>
              </label>
            </div>

            <div className="mt-6 space-y-3">
              {loadingUserAttempts ? (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка попыток…
                </div>
              ) : selectedUserKey ? (
                filteredUserAttempts.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Нет попыток для выбранных фильтров.</p>
                ) : (
                  userAttemptsByTask.map(({ taskId, title, attempts }) => (
                    <div key={taskId} className="space-y-2">
                      {!selectedTaskForUser ? (
                        <div className="text-[10px] uppercase tracking-widest text-primary font-bold pt-2 border-t border-outline-variant/10 first:border-0 first:pt-0">
                          {title}
                          <span className="text-on-surface-variant font-normal normal-case tracking-normal"> — {attempts.length} попыток</span>
                        </div>
                      ) : null}
                      {attempts.map((a) => (
                        <details
                          key={a.id}
                          className="rounded-xl bg-surface-container border border-outline-variant/5 overflow-hidden group"
                        >
                          <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-container-high/50">
                            <span className="font-medium text-on-surface">{new Date(a.createdAt).toLocaleString()}</span>
                            <span className="flex items-center gap-2 text-xs">
                              <span className={`px-2 py-0.5 rounded-md font-bold ${resultBadgeClass(a.result)}`}>
                                {a.result}
                              </span>
                            </span>
                          </summary>
                          <pre className="px-4 pb-4 text-xs font-mono text-on-surface-variant bg-black/20 max-h-64 overflow-auto custom-scrollbar border-t border-outline-variant/10 pt-3">
                            {a.code}
                          </pre>
                        </details>
                      ))}
                    </div>
                  ))
                )
              ) : null}
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
            <h4 className="text-lg font-bold text-on-surface mb-1">По задаче</h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Все попытки решить выбранную задачу (все пользователи), с кодом.
            </p>

            <label className="block max-w-xl">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Задача</div>
              <div className="relative">
                <select
                  value={selectedTaskGlobal}
                  onChange={(e) => setSelectedTaskGlobal(e.target.value)}
                  className="w-full appearance-none bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2.5 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none pr-10"
                >
                  <option value="">— выберите задачу —</option>
                  {sortedTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
              </div>
            </label>

            <div className="mt-6 space-y-3">
              {loadingTaskAttempts ? (
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Загрузка…
                </div>
              ) : selectedTaskGlobal ? (
                taskAttemptsAll.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Пока никто не отправлял решений по этой задаче.</p>
                ) : (
                  taskAttemptsAll.map((a) => (
                    <details
                      key={a.id}
                      className="rounded-xl bg-surface-container border border-outline-variant/5 overflow-hidden"
                    >
                      <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-container-high/50">
                        <span className="font-medium text-on-surface">{a.username ?? '—'}</span>
                        <span className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${resultBadgeClass(a.result)}`}>{a.result}</span>
                          <span className="text-on-surface-variant">{new Date(a.createdAt).toLocaleString()}</span>
                        </span>
                      </summary>
                      <pre className="px-4 pb-4 text-xs font-mono text-on-surface-variant bg-black/20 max-h-64 overflow-auto custom-scrollbar border-t border-outline-variant/10 pt-3">
                        {a.code}
                      </pre>
                    </details>
                  ))
                )
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {canAccess ? (
        <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
          <h4 className="text-lg font-bold text-on-surface mb-4">Управление задачами</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block md:col-span-1">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Название</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <label className="block md:col-span-1">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Сложность</div>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={onCreate}
                disabled={!title || !description}
                className="w-full px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold shadow-lg shadow-primary/10 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Создать
              </button>
            </div>
            <label className="block md:col-span-3">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Описание</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-28 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none custom-scrollbar"
              />
            </label>
            <label className="block md:col-span-3">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                Проверки (validation JSON, опционально)
              </div>
              <textarea
                value={validationJson}
                onChange={(e) => setValidationJson(e.target.value)}
                placeholder={`{"version":1,"export":"double","cases":[{"args":[4],"expect":8},{"args":[0],"expect":0}]}`}
                className="w-full min-h-24 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-xs font-mono text-on-surface focus:ring-1 focus:ring-primary outline-none custom-scrollbar"
              />
            </label>
          </div>

          <div className="mt-10">
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Список задач</div>
            {loading ? (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка...
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container border border-outline-variant/5"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-on-surface truncate">{t.title}</div>
                      <div className="text-xs text-on-surface-variant">
                        id: {t.id} • {t.difficulty}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-highest text-error font-bold hover:brightness-110 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}
    </motion.div>
  );
};
