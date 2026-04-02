import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {ChevronDown, Loader2, Plus, Trash2} from 'lucide-react';
import type {AdminUserStat, ApiAttempt, ApiAttemptWithUser, ApiTask, ApiUser} from '../types';
import {
  createTask,
  deleteTask,
  fillExpectFromReference,
  getAdminTaskAttempts,
  getAdminUserAttempts,
  getAdminUsersStats,
  getTasks,
  patchAdminAttemptStatus,
} from '../api';
import {CodeEditor} from '../components/CodeEditor';

type CaseRow = { args: string; expect: string };

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
  const [ taskSlug, setTaskSlug ] = useState('');
  const [ exportName, setExportName ] = useState('');
  const [ referenceCode, setReferenceCode ] = useState('');
  const [ caseRows, setCaseRows ] = useState<CaseRow[]>([ { args: '[2, 3]', expect: '' } ]);
  const [ fillingExpect, setFillingExpect ] = useState(false);
  const [ patchingId, setPatchingId ] = useState<number | null>(null);

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

  const buildValidationFromRows = (): { version: 1; export: string; cases: { args: unknown[]; expect: unknown }[] } | null => {
    const exp = exportName.trim();
    if (!exp) {
      setError('Укажите имя функции, которую студент должен реализовать (как в коде: function sum → введите sum).');
      return null;
    }
    if (!caseRows.length) {
      setError('Добавьте хотя бы один тест: массив аргументов и ожидаемый результат.');
      return null;
    }
    const cases: { args: unknown[]; expect: unknown }[] = [];
    for (let i = 0; i < caseRows.length; i++) {
      const row = caseRows[i];
      try {
        const args = JSON.parse(row.args.trim() || '[]');
        if (!Array.isArray(args)) throw new Error('args не массив');
        if (!row.expect.trim()) throw new Error('пустое ожидание');
        const expect = JSON.parse(row.expect);
        cases.push({ args, expect });
      } catch (e) {
        setError(
          `Кейс ${i + 1}: args — JSON-массив аргументов (например [2,3]), ожидание — валидный JSON. ${e instanceof Error ? e.message : ''}`.trim(),
        );
        return null;
      }
    }
    return { version: 1, export: exp, cases };
  };

  const onFillExpectsFromReference = async () => {
    if (!user) return;
    setError(null);
    const exp = exportName.trim();
    if (!exp) {
      setError('Сначала введите имя функции — оно должно совпадать с эталоном.');
      return;
    }
    if (!referenceCode.trim()) {
      setError('Вставьте эталонный код (ваш верный JS с функцией с этим именем).');
      return;
    }
    const parsedCases: { args: unknown[] }[] = [];
    for (let i = 0; i < caseRows.length; i++) {
      try {
        const args = JSON.parse(caseRows[i].args.trim() || '[]');
        if (!Array.isArray(args)) throw new Error('не массив');
        parsedCases.push({ args });
      } catch {
        setError(`Кейс ${i + 1}: поле «аргументы» должно быть JSON-массивом, напр. [2, 3] или ["abc"].`);
        return;
      }
    }
    setFillingExpect(true);
    try {
      const { cases: filled } = await fillExpectFromReference({
        userId: user.id,
        exportName: exp,
        referenceCode,
        cases: parsedCases,
      });
      setCaseRows(
        filled.map((c) => ({
          args: JSON.stringify(c.args),
          expect: JSON.stringify(c.expect),
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFillingExpect(false);
    }
  };

  const onCreate = async () => {
    if (!user) return;
    try {
      setError(null);
      const validation = buildValidationFromRows();
      if (!validation) return;
      const id = taskSlug.trim() || undefined;
      await createTask({
        title,
        difficulty,
        description,
        userId: user.id,
        ...(id ? { id } : {}),
        validation,
      });
      setTitle('');
      setDescription('');
      setTaskSlug('');
      setExportName('');
      setReferenceCode('');
      setCaseRows([ { args: '[2, 3]', expect: '' } ]);
      await reloadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const overrideAttemptStatus = async (attempt: ApiAttempt | ApiAttemptWithUser, status: 'PASS' | 'FAIL') => {
    if (!user) return;
    if (attempt.result === status) return;
    setError(null);
    setPatchingId(attempt.id);
    try {
      await patchAdminAttemptStatus({ attemptId: attempt.id, status, adminUserId: user.id });
      setUserAttempts((prev) => prev.map((a) => (a.id === attempt.id ? { ...a, result: status } : a)));
      setTaskAttemptsAll((prev) => prev.map((a) => (a.id === attempt.id ? { ...a, result: status } : a)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPatchingId(null);
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
            <p className="text-xs text-on-surface-variant mb-4">
              Столбцы PASS / FAIL / Ошибок / Задач считаются по <strong>последней попытке на каждую задачу</strong>. Колонка «Попыток» — всего отправок (все попытки),
              включая пересдачи.
            </p>

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
                          {(a.result === 'PASS' || a.result === 'FAIL' || a.result === 'ERROR') ? (
                            <div className="px-4 py-3 border-t border-outline-variant/10 flex flex-wrap items-center gap-2 bg-surface-container-high/20">
                              <span className="text-xs text-on-surface-variant">Ручная оценка (PASS / FAIL):</span>
                              <button
                                type="button"
                                disabled={patchingId === a.id || a.result === 'PASS'}
                                onClick={(e) => {
                                  e.preventDefault();
                                  void overrideAttemptStatus(a, 'PASS');
                                }}
                                className="text-xs px-2 py-1 rounded-lg bg-primary/20 text-primary font-bold disabled:opacity-40"
                              >
                                Засчитать PASS
                              </button>
                              <button
                                type="button"
                                disabled={patchingId === a.id || a.result === 'FAIL'}
                                onClick={(e) => {
                                  e.preventDefault();
                                  void overrideAttemptStatus(a, 'FAIL');
                                }}
                                className="text-xs px-2 py-1 rounded-lg bg-error/15 text-error font-bold disabled:opacity-40"
                              >
                                Засчитать FAIL
                              </button>
                              {patchingId === a.id ? <Loader2 className="w-3 h-3 animate-spin text-on-surface-variant" /> : null}
                            </div>
                          ) : null}
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
                      {(a.result === 'PASS' || a.result === 'FAIL' || a.result === 'ERROR') ? (
                        <div className="px-4 py-3 border-t border-outline-variant/10 flex flex-wrap items-center gap-2 bg-surface-container-high/20">
                          <span className="text-xs text-on-surface-variant">Ручная оценка:</span>
                          <button
                            type="button"
                            disabled={patchingId === a.id || a.result === 'PASS'}
                            onClick={(e) => {
                              e.preventDefault();
                              void overrideAttemptStatus(a, 'PASS');
                            }}
                            className="text-xs px-2 py-1 rounded-lg bg-primary/20 text-primary font-bold disabled:opacity-40"
                          >
                            PASS
                          </button>
                          <button
                            type="button"
                            disabled={patchingId === a.id || a.result === 'FAIL'}
                            onClick={(e) => {
                              e.preventDefault();
                              void overrideAttemptStatus(a, 'FAIL');
                            }}
                            className="text-xs px-2 py-1 rounded-lg bg-error/15 text-error font-bold disabled:opacity-40"
                          >
                            FAIL
                          </button>
                          {patchingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        </div>
                      ) : null}
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
          <h4 className="text-lg font-bold text-on-surface mb-2">Новая задача и автопроверка</h4>
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 mb-6 text-sm text-on-surface-variant space-y-2">
            <p className="font-bold text-on-surface">Что нужно от администратора</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>
                В <strong>описании для студента</strong> явно напишите, как должна называться функция (например: «реализуйте функцию <code className="text-primary">sum(a, b)</code>»).
              </li>
              <li>
                <strong>Имя функции</strong> — тот же идентификатор, что и в коде (латиница, без пробелов). Студент и эталон должны завершать задачу функцией с этим именем.
              </li>
              <li>
                <strong>Тесты:</strong> в каждой строке в колонке «аргументы» укажите JSON-массив значений, которые передаются в функцию по порядку. Пример: для <code className="text-primary">sum(2, 3)</code> введите <code className="text-primary">[2, 3]</code>.
              </li>
              <li>
                <strong>Ожидаемый результат</strong> можно не считать вручную: вставьте <strong>эталонный код</strong> (ваше верное решение целиком) и нажмите «Заполнить ожидания из эталона» — сервер прогонит эталон в той же песочнице, что и у студентов, и подставит правильные ответы. При необходимости отредактируйте ячейки вручную.
              </li>
              <li>
                Не обязательно перечислять «все варианты решения» — только набор входов и ожидаемых выходов. Чем больше тестов, тем надёжнее проверка.
              </li>
            </ol>
          </div>

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
            <label className="block md:col-span-1">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                id задачи (необязательно)
              </div>
              <input
                value={taskSlug}
                onChange={(e) => setTaskSlug(e.target.value)}
                placeholder="напр. my-sum — иначе будет автогенерация"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <label className="block md:col-span-3">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Описание для студента</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-28 bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none custom-scrollbar"
              />
            </label>
            <label className="block md:col-span-1">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                Имя функции (export)
              </div>
              <input
                value={exportName}
                onChange={(e) => setExportName(e.target.value)}
                placeholder="sum"
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:ring-1 focus:ring-primary outline-none"
              />
            </label>
            <div className="md:col-span-2 flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={onFillExpectsFromReference}
                disabled={fillingExpect}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface font-bold border border-outline-variant/20 hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {fillingExpect ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Заполнить ожидания из эталона
              </button>
            </div>
            <label className="block md:col-span-3">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                Эталонный код (ваше решение, внутри QuickJS — без require, Node, DOM)
              </div>
              <CodeEditor
                value={referenceCode}
                onChange={setReferenceCode}
                language="javascript"
                height="192px"
                placeholder={`function sum(a, b) {\n  return a + b;\n}`}
                className="w-full text-xs [&_.cm-editor]:text-xs"
              />
            </label>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Тест-кейсы</div>
              <button
                type="button"
                onClick={() => setCaseRows((rows) => [ ...rows, { args: '[]', expect: '' } ])}
                className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-highest font-bold text-on-surface hover:brightness-110"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить кейс
              </button>
            </div>
            <div className="space-y-3">
              {caseRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start p-4 rounded-xl bg-surface-container border border-outline-variant/10"
                >
                  <label className="block min-w-0">
                    <div className="text-[10px] text-on-surface-variant mb-1">Аргументы (JSON-массив)</div>
                    <CodeEditor
                      value={row.args}
                      onChange={(v) => setCaseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, args: v } : r)))}
                      language="json"
                      height="88px"
                      className="w-full text-xs [&_.cm-editor]:text-xs [&_.cm-gutters]:min-w-[28px]"
                    />
                  </label>
                  <label className="block min-w-0">
                    <div className="text-[10px] text-on-surface-variant mb-1">Ожидаемый результат (JSON)</div>
                    <CodeEditor
                      value={row.expect}
                      onChange={(v) => setCaseRows((prev) => prev.map((r, i) => (i === idx ? { ...r, expect: v } : r)))}
                      language="json"
                      height="88px"
                      className="w-full text-xs [&_.cm-editor]:text-xs [&_.cm-gutters]:min-w-[28px]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={caseRows.length <= 1}
                    onClick={() => setCaseRows((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg text-error hover:bg-error/10 disabled:opacity-30 justify-self-start md:justify-self-center md:mt-6"
                    title="Удалить кейс"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={onCreate}
              disabled={!title.trim() || !description.trim()}
              className="w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold shadow-lg shadow-primary/10 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Создать задачу с этой автопроверкой
            </button>
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
