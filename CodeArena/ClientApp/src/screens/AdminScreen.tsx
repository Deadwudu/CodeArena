import React, {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {Loader2, Trash2} from 'lucide-react';
import type {ApiTask, ApiUser} from '../types';
import {createTask, deleteTask, getTasks} from '../api';

export const AdminScreen: React.FC<{user: ApiUser | null}> = ({user}) => {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [description, setDescription] = useState('');
  const [validationJson, setValidationJson] = useState("");

  const canAccess = user?.role === 'admin';

  const reload = async () => {
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
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => [...tasks].sort((a, b) => a.title.localeCompare(b.title)), [tasks]);

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
      await createTask({title, difficulty, description, userId: user.id, validation});
      setTitle('');
      setDescription('');
      setValidationJson('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async (id: string) => {
    if (!user) return;
    try {
      setError(null);
      await deleteTask({id, userId: user.id});
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <motion.div initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} className="p-8 max-w-5xl mx-auto w-full">
      <section className="bg-surface-container-low rounded-xl p-8 border border-outline-variant/5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold font-headline text-on-surface">Админка</h3>
            <p className="text-sm text-on-surface-variant">
              Задачи и автопроверки хранятся в Supabase. Для запуска кода укажите JSON <code className="text-primary">validation</code> (как в{' '}
              <code className="text-primary">supabase-schema.sql</code>), иначе <code className="text-primary">/api/run</code> вернёт ошибку.
            </p>
          </div>
          <button
            onClick={reload}
            className="px-4 py-2 rounded-lg bg-surface-container-highest text-on-surface font-bold hover:brightness-110 transition-all"
          >
            Обновить
          </button>
        </div>

        {!canAccess ? (
          <div className="mt-8 text-error text-sm">Нет доступа. Нужна роль admin.</div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
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
          </>
        )}

        {error ? <div className="mt-4 text-error text-sm whitespace-pre-wrap">{error}</div> : null}

        <div className="mt-10">
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Tasks</div>

          {loading ? (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка...
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container border border-outline-variant/5"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-on-surface truncate">{t.title}</div>
                    <div className="text-xs text-on-surface-variant">id: {t.id} • {t.difficulty}</div>
                  </div>
                  <button
                    onClick={() => onDelete(t.id)}
                    disabled={!canAccess}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-highest text-error font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
    </motion.div>
  );
};

