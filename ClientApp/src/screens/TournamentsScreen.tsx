import React, {useCallback, useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {
  ArrowLeft,
  ChevronRight,
  Loader2,
  Medal,
  Plus,
  Trash2,
} from 'lucide-react';
import type {ApiUser, TournamentListItem, TournamentPlayResponse} from '../types';
import {
  completeTournamentParticipant,
  createTournament,
  finishTournament,
  getTournamentPlay,
  getTournamentSummary,
  goLiveTournament,
  joinTournament,
  listTournamentSubmissions,
  listTournaments,
  patchTournamentSubmission,
  submitTournamentTask,
} from '../api';
import {CodeEditor} from '../components/CodeEditor';

type View = 'list' | 'play' | 'summary' | 'review';

export const TournamentsScreen: React.FC<{user: ApiUser | null}> = ({user}) => {
  const [ view, setView ] = useState<View>('list');
  const [ activeId, setActiveId ] = useState<string | null>(null);
  const [ tournaments, setTournaments ] = useState<TournamentListItem[]>([]);
  const [ loading, setLoading ] = useState(true);
  const [ error, setError ] = useState<string | null>(null);

  const [ showCreate, setShowCreate ] = useState(false);
  const [ createName, setCreateName ] = useState('');
  const [ createTasks, setCreateTasks ] = useState([ { title: '', description: '' } ]);
  const [ createBusy, setCreateBusy ] = useState(false);

  const [ play, setPlay ] = useState<TournamentPlayResponse | null>(null);
  const [ playLoading, setPlayLoading ] = useState(false);
  const [ code, setCode ] = useState('');
  const [ submitBusy, setSubmitBusy ] = useState(false);

  const [ summaryRows, setSummaryRows ] = useState<Awaited<ReturnType<typeof getTournamentSummary>>['tasks']>([]);
  const [ reviewRows, setReviewRows ] = useState<Awaited<ReturnType<typeof listTournamentSubmissions>>>([]);
  const [ reviewBusyId, setReviewBusyId ] = useState<number | null>(null);

  const isAdmin = user?.role === 'admin';

  const reloadList = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setTournaments(await listTournaments());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadList();
  }, [ reloadList ]);

  const loadPlay = useCallback(async () => {
    if (!user || !activeId) return;
    setPlayLoading(true);
    try {
      setPlay(await getTournamentPlay(activeId, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPlay(null);
    } finally {
      setPlayLoading(false);
    }
  }, [ user, activeId ]);

  useEffect(() => {
    if (view === 'play' && activeId && user) void loadPlay();
  }, [ view, activeId, user, loadPlay ]);

  const openPlay = (id: string) => {
    setActiveId(id);
    setView('play');
    setCode('');
    setPlay(null);
  };

  const openSummary = async (id: string) => {
    if (!user) return;
    setActiveId(id);
    setView('summary');
    try {
      const s = await getTournamentSummary(id, user.id);
      setSummaryRows(s.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSummaryRows([]);
    }
  };

  const openReview = async (id: string) => {
    if (!user) return;
    setActiveId(id);
    setView('review');
    try {
      setReviewRows(await listTournamentSubmissions(id, user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReviewRows([]);
    }
  };

  const onCreateTournament = async () => {
    if (!user) return;
    const name = createName.trim();
    const tasks = createTasks
      .map((t) => ({ title: t.title.trim(), description: t.description.trim() }))
      .filter((t) => t.title && t.description);
    if (!name || tasks.length === 0) {
      setError('Укажите название и хотя бы одну задачу с заголовком и текстом.');
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      await createTournament({ userId: user.id, name, tasks });
      setShowCreate(false);
      setCreateName('');
      setCreateTasks([ { title: '', description: '' } ]);
      await reloadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const statusRu = (s: string) =>
    s === 'pending' ? 'Набор' : s === 'live' ? 'Идёт' : 'Завершён';

  if (view === 'play' && activeId && user) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto w-full space-y-6">
        <button
          type="button"
          onClick={() => {
            setView('list');
            setActiveId(null);
          }}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-bold rounded-lg px-2 py-1 -ml-2 transition-colors duration-200 hover:bg-primary/10"
        >
          <ArrowLeft className="w-4 h-4" />
          К списку турниров
        </button>

        {playLoading || !play ? (
          <div className="flex items-center gap-2 text-on-surface-variant py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
            Загрузка…
          </div>
        ) : play.phase === 'waiting' ? (
          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
            <h3 className="text-xl font-bold text-on-surface">{play.tournamentName}</h3>
            <p className="text-on-surface-variant mt-2">{play.message}</p>
          </section>
        ) : play.phase === 'finished' ? (
          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
            <p className="text-on-surface-variant">{play.message}</p>
          </section>
        ) : play.phase === 'done' ? (
          <section className="space-y-4">
            <p className="text-on-surface">Турнир завершён с вашей стороны.</p>
            <button
              type="button"
              onClick={() => void openSummary(activeId)}
              className="px-6 py-3 rounded-xl bg-primary text-on-primary-container font-bold transition-all duration-200 hover:brightness-110 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              Смотреть итоги
            </button>
          </section>
        ) : play.phase === 'await_complete' ? (
          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5 space-y-4">
            <h3 className="text-xl font-bold text-on-surface">{play.tournamentName}</h3>
            <p className="text-on-surface-variant">
              Вы отправили решения по всем {play.taskCount} задачам. Нажмите «Завершить турнир», чтобы увидеть сводку с отметками проверки.
            </p>
            <button
              type="button"
              disabled={submitBusy}
              onClick={async () => {
                setSubmitBusy(true);
                setError(null);
                try {
                  await completeTournamentParticipant(activeId, user.id);
                  await openSummary(activeId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSubmitBusy(false);
                }
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold transition-all duration-200 hover:brightness-110 hover:shadow-md disabled:opacity-50 disabled:hover:brightness-100 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Завершить турнир
            </button>
          </section>
        ) : (
          <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5 space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-primary font-bold">
              Задача {play.taskIndex + 1} из {play.taskCount}
            </div>
            <h3 className="text-2xl font-bold font-headline text-on-surface">{play.task.title}</h3>
            <div className="text-sm text-on-surface-variant whitespace-pre-wrap border-l-2 border-primary/40 pl-4">{play.task.description}</div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Ваше решение (текст кода)</div>
              <CodeEditor
                value={code}
                onChange={setCode}
                language="javascript"
                height="320px"
                placeholder="// Любой язык или псевдокод — проверяет только администратор"
                className="w-full [&_.cm-editor]:text-sm"
              />
            </div>
            {error ? <div className="text-error text-sm">{error}</div> : null}
            <button
              type="button"
              disabled={submitBusy || !code.trim()}
              onClick={async () => {
                setSubmitBusy(true);
                setError(null);
                try {
                  await submitTournamentTask(activeId, user.id, code);
                  setCode('');
                  await loadPlay();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setSubmitBusy(false);
                }
              }}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-secondary-container to-secondary text-on-secondary-container font-bold transition-all duration-200 hover:brightness-110 hover:shadow-md disabled:opacity-40 disabled:hover:brightness-100 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            >
              {submitBusy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
              Отправить
            </button>
          </section>
        )}
      </motion.div>
    );
  }

  if (view === 'summary' && activeId) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto w-full space-y-6">
        <button
          type="button"
          onClick={() => {
            setView('list');
            setActiveId(null);
          }}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-bold rounded-lg px-2 py-1 -ml-2 transition-colors duration-200 hover:bg-primary/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <h3 className="text-xl font-bold text-on-surface">Итоги турнира</h3>
        <div className="space-y-6">
          {summaryRows.map((row) => (
            <div key={row.taskId} className="rounded-xl bg-surface-container-low border border-outline-variant/5 p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-on-surface">{row.title}</h4>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    row.reviewStatus === 'PASS'
                      ? 'bg-primary/20 text-primary'
                      : row.reviewStatus === 'FAIL'
                        ? 'bg-error/15 text-error'
                        : 'bg-surface-container-highest text-on-surface-variant'
                  }`}
                >
                  {row.labelRu}
                </span>
              </div>
              <pre className="text-xs font-mono text-on-surface-variant bg-black/20 rounded-lg p-3 max-h-48 overflow-auto custom-scrollbar whitespace-pre-wrap">
                {row.code || '—'}
              </pre>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (view === 'review' && activeId && user && isAdmin) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-5xl mx-auto w-full space-y-6">
        <button
          type="button"
          onClick={() => {
            setView('list');
            setActiveId(null);
          }}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary font-bold rounded-lg px-2 py-1 -ml-2 transition-colors duration-200 hover:bg-primary/10"
        >
          <ArrowLeft className="w-4 h-4" />
          К списку
        </button>
        <h3 className="text-xl font-bold text-on-surface">Проверка отправлений (новые сверху по времени)</h3>
        <div className="space-y-4">
          {reviewRows.map((r) => (
            <div key={r.id} className="rounded-xl bg-surface-container border border-outline-variant/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold text-on-surface">{r.taskTitle}</span>
                <span className="text-on-surface-variant">{r.username}</span>
                <span className="text-xs text-on-surface-variant">{new Date(r.submittedAt).toLocaleString()}</span>
                <span className="text-xs font-bold">{r.reviewStatus}</span>
              </div>
              <pre className="text-xs font-mono bg-black/20 rounded-lg p-3 max-h-40 overflow-auto custom-scrollbar whitespace-pre-wrap">{r.code}</pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={reviewBusyId === r.id}
                  onClick={async () => {
                    setReviewBusyId(r.id);
                    try {
                      await patchTournamentSubmission({ submissionId: r.id, status: 'PASS', adminUserId: user.id });
                      setReviewRows(await listTournamentSubmissions(activeId, user.id));
                    } finally {
                      setReviewBusyId(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold transition-all duration-200 hover:bg-primary/35 hover:ring-2 hover:ring-primary/30 disabled:opacity-50 disabled:hover:bg-primary/20 disabled:hover:ring-0"
                >
                  PASS
                </button>
                <button
                  type="button"
                  disabled={reviewBusyId === r.id}
                  onClick={async () => {
                    setReviewBusyId(r.id);
                    try {
                      await patchTournamentSubmission({ submissionId: r.id, status: 'FAIL', adminUserId: user.id });
                      setReviewRows(await listTournamentSubmissions(activeId, user.id));
                    } finally {
                      setReviewBusyId(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-error/15 text-error text-xs font-bold transition-all duration-200 hover:bg-error/30 hover:ring-2 hover:ring-error/35 disabled:opacity-50 disabled:hover:bg-error/15 disabled:hover:ring-0"
                >
                  FAIL
                </button>
              </div>
            </div>
          ))}
          {reviewRows.length === 0 ? <p className="text-on-surface-variant text-sm">Пока нет отправок.</p> : null}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Medal className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-headline text-on-surface">Турниры</h2>
              <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
                Админ создаёт турнир и сроки старта. После «Начать турнир» участники видят задачи по очереди. Решения не проверяются автоматически — только администратор выставляет PASS/FAIL.
              </p>
            </div>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-xl bg-surface-container-highest text-on-surface font-bold border border-outline-variant/20 transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:shadow-md hover:shadow-black/10"
            >
              Создать турнир
            </button>
          ) : null}
        </div>
      </section>

      {showCreate && isAdmin && user ? (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div
            className="bg-surface-container-low rounded-2xl border border-outline-variant/20 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-on-surface">Новый турнир</h3>
            <p className="text-xs text-on-surface-variant">
              После создания турнир в статусе «Набор». Участники могут присоединяться. Когда будете готовы, нажмите «Начать турнир» у карточки — участники увидят условия.
            </p>
            <label className="block">
              <span className="text-[10px] uppercase font-bold text-on-surface-variant">Название</span>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1 w-full bg-surface-container border rounded-lg px-3 py-2 text-sm text-on-surface"
              />
            </label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-on-surface-variant">Задачи</span>
                <button
                  type="button"
                  onClick={() => setCreateTasks((t) => [ ...t, { title: '', description: '' } ])}
                  className="text-xs inline-flex items-center gap-1 text-primary font-bold rounded-md px-2 py-1 transition-colors duration-200 hover:bg-primary/15"
                >
                  <Plus className="w-3 h-3" />
                  Добавить
                </button>
              </div>
              {createTasks.map((t, i) => (
                <div key={i} className="p-3 rounded-lg bg-surface-container border border-outline-variant/10 space-y-2">
                  <input
                    placeholder="Заголовок задачи"
                    value={t.title}
                    onChange={(e) =>
                      setCreateTasks((rows) => rows.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))
                    }
                    className="w-full text-sm bg-surface-container-low border rounded px-2 py-1.5 text-on-surface"
                  />
                  <textarea
                    placeholder="Текст условия"
                    value={t.description}
                    onChange={(e) =>
                      setCreateTasks((rows) => rows.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))
                    }
                    rows={3}
                    className="w-full text-sm bg-surface-container-low border rounded px-2 py-1.5 text-on-surface"
                  />
                  {createTasks.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setCreateTasks((rows) => rows.filter((_, j) => j !== i))}
                      className="text-error text-xs inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-200 hover:bg-error/15"
                    >
                      <Trash2 className="w-3 h-3" />
                      Удалить
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg font-bold text-on-surface-variant transition-colors duration-200 hover:bg-surface-container-highest hover:text-on-surface"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={createBusy}
                onClick={() => void onCreateTournament()}
                className="px-4 py-2 rounded-lg font-bold bg-primary text-on-primary-container transition-all duration-200 hover:brightness-110 hover:shadow-md disabled:opacity-50 disabled:hover:brightness-100"
              >
                {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error && view === 'list' ? <div className="text-error text-sm whitespace-pre-wrap">{error}</div> : null}

      {loading ? (
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface-container border border-outline-variant/5"
            >
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-on-surface">{t.name}</div>
                <div className="text-xs text-on-surface-variant">
                  {statusRu(t.status)} • Задач: {t.taskCount}
                  {t.status === 'pending' ? ' • условия скрыты до старта' : ''}
                </div>
              </div>
              {isAdmin && t.status === 'pending' ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    setError(null);
                    try {
                      await goLiveTournament(t.id, user.id);
                      await reloadList();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-xs font-bold transition-all duration-200 hover:bg-primary/35 hover:ring-2 hover:ring-primary/25"
                >
                  Начать турнир
                </button>
              ) : null}
              {isAdmin && (t.status === 'live' || t.status === 'pending') ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!user) return;
                    if (!confirm('Завершить турнир? Участники не смогут отправлять решения.')) return;
                    try {
                      await finishTournament(t.id, user.id);
                      await reloadList();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="px-3 py-2 rounded-lg bg-error/10 text-error text-xs font-bold transition-all duration-200 hover:bg-error/25 hover:ring-2 hover:ring-error/20"
                >
                  Завершить
                </button>
              ) : null}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => void openReview(t.id)}
                  className="px-3 py-2 rounded-lg bg-surface-container-highest text-xs font-bold text-on-surface border border-transparent transition-all duration-200 hover:border-primary/35 hover:bg-primary/10"
                >
                  Проверка работ
                </button>
              ) : null}
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      try {
                        await joinTournament(t.id, user.id);
                        await reloadList();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="px-3 py-2 rounded-lg border border-outline-variant/30 text-xs font-bold text-on-surface transition-all duration-200 hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                  >
                    Присоединиться
                  </button>
                  <button
                    type="button"
                    onClick={() => openPlay(t.id)}
                    className="px-3 py-2 rounded-lg bg-surface-container-highest text-xs font-bold inline-flex items-center gap-1 text-primary border border-transparent transition-all duration-200 hover:bg-primary/15 hover:border-primary/30 hover:shadow-sm"
                  >
                    Решать
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="text-xs text-on-surface-variant">Войдите, чтобы участвовать</span>
              )}
            </div>
          ))}
          {tournaments.length === 0 ? <p className="text-on-surface-variant text-sm">Турниров пока нет.</p> : null}
        </div>
      )}
    </motion.div>
  );
};
