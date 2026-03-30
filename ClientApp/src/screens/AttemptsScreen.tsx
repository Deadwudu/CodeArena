import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {ChevronDown, ChevronRight, Loader2} from 'lucide-react';
import type {ApiAttempt, ApiTask, ApiUser} from '../types';
import {getAttempts, getTasks} from '../api';
import {cn} from '../lib/utils';

function AttemptCard(props: {attempt: ApiAttempt; taskTitle: string; onOpenTask: () => void}) {
  const {attempt: a, taskTitle, onOpenTask} = props;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-surface-container border border-outline-variant/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-4 flex items-center gap-2 hover:bg-surface-container-high/50 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 shrink-0 text-on-surface-variant" /> : <ChevronRight className="w-4 h-4 shrink-0 text-on-surface-variant" />}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-on-surface truncate">{taskTitle}</div>
          <div className="text-xs text-on-surface-variant">{a.createdAt}</div>
        </div>
        <div
          className={cn(
            'shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
            a.result === 'PASS' && 'bg-secondary-container text-on-secondary-container',
            a.result === 'FAIL' && 'bg-error/20 text-error border border-error/30',
            a.result === 'ERROR' && 'bg-tertiary-container text-on-primary-container',
          )}
        >
          {a.result}
        </div>
      </button>
      {open ? (
        <div className="px-4 pb-4 pt-0 border-t border-outline-variant/10">
          <pre className="mt-3 p-3 rounded-lg bg-surface-container-lowest text-on-surface-variant text-xs font-mono whitespace-pre-wrap overflow-auto max-h-48 custom-scrollbar">
            {a.code}
          </pre>
          <button type="button" onClick={onOpenTask} className="mt-3 text-xs font-bold text-primary hover:underline">
            Открыть задачу
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const AttemptsScreen: React.FC<{
  search: string;
  onOpenTask: (taskId: string) => void;
  user: ApiUser | null;
}> = ({search, onOpenTask, user}) => {
  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [a, t] = await Promise.all([
          user ? getAttempts(undefined, user.id) : Promise.resolve([] as ApiAttempt[]),
          getTasks(),
        ]);
        if (cancelled) return;
        setAttempts(a);
        setTasks(t);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter((a) => {
      const t = taskById.get(a.taskId);
      const hay = `${a.taskId} ${a.result} ${a.createdAt} ${t?.title ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [attempts, search, taskById]);

  return (
    <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="p-8 max-w-7xl mx-auto w-full">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">Мои попытки</h3>
            <p className="text-sm text-on-surface-variant">
              Показаны только ваши отправки (<code className="text-primary">?userId=…</code>).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка...
          </div>
        ) : error ? (
          <div className="text-error text-sm">{error}</div>
        ) : !user ? (
          <div className="text-on-surface-variant text-sm">Войдите в аккаунт, чтобы увидеть свои попытки.</div>
        ) : filtered.length === 0 ? (
          <div className="text-on-surface-variant text-sm">Пока нет попыток. Решите задачу на вкладке «Редактор».</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const t = taskById.get(a.taskId);
              return <AttemptCard key={a.id} attempt={a} taskTitle={t?.title ?? a.taskId} onOpenTask={() => onOpenTask(a.taskId)} />;
            })}
          </div>
        )}
      </section>
    </motion.div>
  );
};
