import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {ChevronRight, Loader2, Terminal} from 'lucide-react';
import type {ApiTask} from '../types';
import {getTasks} from '../api';
import {cn} from '../lib/utils';

const difficultyStyle: Record<string, string> = {
  easy: 'bg-secondary-container text-on-secondary-container',
  medium: 'bg-tertiary-container text-on-primary-container',
  hard: 'bg-error/20 text-error border border-error/30',
};

export const TasksScreen: React.FC<{
  search: string;
  onOpenTask: (taskId: string) => void;
}> = ({search, onOpenTask}) => {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await getTasks();
        if (!cancelled) setTasks(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => (t.title + ' ' + t.description + ' ' + t.difficulty).toLowerCase().includes(q));
  }, [tasks, search]);

  return (
    <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="p-8 max-w-7xl mx-auto w-full">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] -mr-32 -mt-32 rounded-full" />
        <div className="relative z-10 flex items-start justify-between gap-6 flex-col lg:flex-row">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded-full">Arena</span>
              <div className="flex items-center gap-2 text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                Live API
              </div>
            </div>
            <h2 className="text-4xl font-black font-headline text-on-surface mb-2 tracking-tight">
              CodeArena: <span className="text-primary">Практика</span>
            </h2>
            <p className="text-on-surface-variant max-w-2xl leading-relaxed">
              Выбирай задачу, пиши решение и запускай проверки через серверный эндпоинт <code className="text-primary">/api/run</code>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (filtered[0] ? onOpenTask(filtered[0].id) : null)}
              className="px-6 py-3 bg-primary text-on-primary-container font-bold rounded-lg hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
              disabled={!filtered.length}
            >
              <Terminal className="w-4 h-4" />
              Открыть первую
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">Список задач</h3>
            <p className="text-sm text-on-surface-variant">
              Данные приходят из Supabase через бэкенд: <code className="text-primary">GET /api/tasks</code>
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
        ) : (
          <div className="space-y-3">
            {filtered.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="w-full text-left group flex items-center gap-4 p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-all border border-outline-variant/5 hover:border-primary/20"
              >
                <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary">
                  <Terminal className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-on-surface truncate">{task.title}</h4>
                    <span
                      className={cn(
                        'shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider',
                        difficultyStyle[task.difficulty] ?? 'bg-surface-container-highest text-on-surface-variant',
                      )}
                    >
                      {task.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">{task.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  );
};
