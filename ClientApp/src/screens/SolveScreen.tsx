import React, {useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {ArrowRight, ChevronDown, ChevronRight, CloudUpload, FileCode, Loader2, Play, Trash2} from 'lucide-react';
import type {ApiAttempt, ApiTask, ApiUser} from '../types';
import {getAttempts, getTask, getTasks, runSolution} from '../api';
import {cn} from '../lib/utils';

const starterByTaskId: Record<string, string> = {
  sum: `function sum(a, b) {\n  return a + b;\n}\n`,
  double: `function double(x) {\n  return x * 2;\n}\n`,
  max: `function max(a, b) {\n  return a > b ? a : b;\n}\n`,
  abs: `function abs(x) {\n  return x < 0 ? -x : x;\n}\n`,
  isEven: `function isEven(n) {\n  return n % 2 === 0;\n}\n`,
  minArr: `function minArr(arr) {\n  return Math.min(...arr);\n}\n`,
  countVowels: `function countVowels(s) {\n  const v = 'aeiouAEIOU';\n  return [...s].filter((c) => v.includes(c)).length;\n}\n`,
  reverse: `function reverse(str) {\n  return str.split('').reverse().join('');\n}\n`,
  isPalindrome: `function isPalindrome(s) {\n  return s === s.split('').reverse().join('');\n}\n`,
  factorial: `function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n`,
  unique: `function unique(arr) {\n  // верните число, что встречается один раз\n}\n`,
};

export const SolveScreen: React.FC<{
  taskId: string | null;
  user: ApiUser | null;
  /** Переход к другой задаче из каталога (тот же порядок, что GET /api/tasks) */
  onGoToTask?: (taskId: string) => void;
}> = ({taskId, user, onGoToTask}) => {
  const [task, setTask] = useState<ApiTask | null>(null);
  const [catalogTasks, setCatalogTasks] = useState<ApiTask[]>([]);
  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);
  const [code, setCode] = useState('');
  const [runState, setRunState] = useState<{status: 'idle' | 'running' | 'done'; result?: string; error?: string}>({
    status: 'idle',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'console' | 'attempts'>('console');
  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const loadedTaskIdRef = useRef<string | null>(null);

  const canRun = Boolean(user && taskId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!taskId) {
        loadedTaskIdRef.current = null;
        setTask(null);
        setAttempts([]);
        setCode('');
        setRunState({status: 'idle'});
        return;
      }
      const taskSwitched = loadedTaskIdRef.current !== taskId;
      loadedTaskIdRef.current = taskId;
      if (taskSwitched) {
        setCode(starterByTaskId[taskId] ?? '// напишите решение');
      }
      try {
        setError(null);
        setLoading(true);
        setRunState({status: 'idle'});
        const [t, a, catalog] = await Promise.all([
          getTask(taskId),
          user ? getAttempts(taskId, user.id) : Promise.resolve([] as ApiAttempt[]),
          getTasks(),
        ]);
        if (cancelled) return;
        setTask(t);
        setAttempts(a);
        setCatalogTasks(catalog);
        if (!taskSwitched) {
          setCode((prev) => prev || starterByTaskId[taskId] || '// напишите решение');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [taskId, user?.id]);

  const nextTask = useMemo(() => {
    if (!taskId || !catalogTasks.length) return null;
    const idx = catalogTasks.findIndex((x) => x.id === taskId);
    if (idx < 0 || idx >= catalogTasks.length - 1) return null;
    return catalogTasks[idx + 1];
  }, [taskId, catalogTasks]);

  const badge = useMemo(() => {
    const d = task?.difficulty ?? '';
    if (d === 'easy') return {label: 'Easy', cls: 'bg-secondary-container text-on-secondary-container'};
    if (d === 'medium') return {label: 'Medium', cls: 'bg-tertiary-container text-on-primary-container'};
    if (d === 'hard') return {label: 'Hard', cls: 'bg-error/20 text-error border border-error/30'};
    return {label: d || '—', cls: 'bg-surface-container-highest text-on-surface-variant'};
  }, [task?.difficulty]);

  const run = async () => {
    if (!taskId) return;
    if (!user) {
      setRunState({status: 'done', result: 'ERROR', error: 'Сначала войдите в аккаунт'});
      return;
    }
    try {
      setRunState({status: 'running'});
      const out = await runSolution({taskId, code, userId: user.id});
      setRunState({status: 'done', result: out.result, error: out.error});
      const a = await getAttempts(taskId, user.id);
      setAttempts(a);
    } catch (e) {
      setRunState({status: 'done', result: 'ERROR', error: e instanceof Error ? e.message : String(e)});
    }
  };

  const clearConsole = () => setRunState({status: 'idle'});

  return (
    <motion.div initial={{opacity: 0}} animate={{opacity: 1}} className="flex h-[calc(100vh-64px)] overflow-hidden">
      <section className="w-1/2 h-full flex flex-col bg-surface border-r border-outline-variant/10 overflow-y-auto custom-scrollbar">
        <div className="p-8 max-w-2xl mx-auto w-full">
          {!taskId ? (
            <div className="text-on-surface-variant">
              Выберите задачу на вкладке <span className="text-primary font-bold">Задачи</span>.
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка задачи...
            </div>
          ) : error ? (
            <div className="text-error text-sm">{error}</div>
          ) : task ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider', badge.cls)}>{badge.label}</span>
                <span className="text-on-surface-variant text-xs">Task: {task.id}</span>
              </div>
              <h1 className="text-3xl font-headline font-bold text-on-surface mb-6">{task.title}</h1>
              <div className="space-y-6">
                <p className="text-on-surface-variant leading-relaxed whitespace-pre-wrap">{task.description}</p>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <p className="text-sm text-on-surface-variant">
                    <span className="text-primary font-bold">Важно:</span> проверка решения выполняется в песочнице{' '}
                    <span className="font-mono text-primary">QuickJS</span> (WASM), без доступа к Node.js и файловой системе.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="w-1/2 h-full flex flex-col bg-surface-container-lowest relative">
        <div className="h-12 flex items-center justify-between px-6 bg-surface-container-low border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <FileCode className="text-tertiary w-4 h-4" />
            <span className="text-xs font-mono text-on-surface-variant">solution.js</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCode(starterByTaskId[taskId ?? ''] || '// напишите решение')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-on-surface-variant hover:bg-surface-container-highest transition-colors"
              disabled={!taskId}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden font-mono text-sm relative">
          <div className="w-12 bg-surface-container-lowest flex flex-col items-end pr-3 py-4 text-on-surface-variant/30 select-none border-r border-outline-variant/5">
            {Array.from({length: Math.max(16, code.split('\n').length)}).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <textarea
            className="flex-1 py-4 px-4 bg-transparent border-none focus:ring-0 text-on-surface-variant leading-relaxed resize-none custom-scrollbar"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            placeholder="// напишите решение"
          />
        </div>

        <div className="absolute right-6 bottom-[35%] flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={run}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-container-highest text-primary font-bold transition-all hover:brightness-110 active:scale-95 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!canRun || runState.status === 'running'}
            title={!user ? 'Сначала войдите' : undefined}
          >
            {runState.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            Run
          </button>
          <button
            type="button"
            onClick={run}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary-container font-bold shadow-lg shadow-primary/10 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!canRun || runState.status === 'running'}
          >
            <CloudUpload className="w-4 h-4" />
            Submit
          </button>
        </div>

        <div className="h-[30%] bg-surface-container-lowest border-t border-outline-variant/20 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-surface-container-low/50">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setBottomTab('console')}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest pb-1',
                  bottomTab === 'console' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                Console
              </button>
              <button
                type="button"
                onClick={() => setBottomTab('attempts')}
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest pb-1',
                  bottomTab === 'attempts' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                Мои попытки ({attempts.length})
              </button>
            </div>
            {bottomTab === 'console' ? (
              <button type="button" onClick={clearConsole} className="text-on-surface-variant hover:text-error transition-colors" aria-label="Clear console">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <span className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 p-4 font-mono text-xs overflow-auto custom-scrollbar">
            {bottomTab === 'attempts' ? (
              !user ? (
                <div className="text-on-surface-variant font-body text-sm">Войдите в аккаунт, чтобы видеть свои попытки по этой задаче.</div>
              ) : attempts.length === 0 ? (
                <div className="text-on-surface-variant font-body text-sm">Пока нет ваших отправок.</div>
              ) : (
                <div className="space-y-2">
                  {attempts.map((a) => {
                    const open = expandedAttemptId === a.id;
                    return (
                      <div key={a.id} className="rounded-lg border border-outline-variant/10 bg-surface-container-low/30">
                        <button
                          type="button"
                          onClick={() => setExpandedAttemptId(open ? null : a.id)}
                          className="w-full flex items-center gap-2 p-2 text-left hover:bg-surface-container-high/30 transition-colors"
                        >
                          {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                          <span className="text-on-surface-variant flex-1 truncate">{a.createdAt}</span>
                          <span
                            className={cn(
                              'shrink-0 font-bold',
                              a.result === 'PASS' && 'text-secondary',
                              a.result === 'FAIL' && 'text-error',
                              a.result === 'ERROR' && 'text-tertiary',
                            )}
                          >
                            {a.result}
                          </span>
                        </button>
                        {open ? (
                          <pre className="px-2 pb-2 pl-9 text-on-surface-variant whitespace-pre-wrap max-h-32 overflow-auto custom-scrollbar">{a.code}</pre>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )
            ) : runState.status === 'idle' ? (
              <div className="text-on-surface-variant">Запусти код, чтобы увидеть результат проверки.</div>
            ) : runState.status === 'running' ? (
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin" />
                Выполнение...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-secondary">➜</span>
                  <span className="text-on-surface-variant">POST /api/run</span>
                </div>
                <div className="text-on-surface">
                  Result:{' '}
                  <span
                    className={cn(
                      'font-bold',
                      runState.result === 'PASS' && 'text-secondary',
                      runState.result === 'FAIL' && 'text-error',
                      runState.result === 'ERROR' && 'text-tertiary',
                    )}
                  >
                    {runState.result}
                  </span>
                </div>
                {runState.error ? <div className="text-error whitespace-pre-wrap">{runState.error}</div> : null}
                {runState.result === 'PASS' && onGoToTask ? (
                  nextTask ? (
                    <button
                      type="button"
                      onClick={() => onGoToTask(nextTask.id)}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold hover:brightness-110 transition-all"
                    >
                      Следующая задача
                      <span className="truncate font-medium opacity-90 max-w-[12rem]">{nextTask.title}</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </button>
                  ) : (
                    <p className="mt-3 text-on-surface-variant text-xs font-body">Это последняя задача в каталоге.</p>
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
};
