import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Code2,
  Loader2,
  Medal,
  Newspaper,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import type {ApiUser, TournamentListItem} from '../types';
import {listTournaments} from '../api';
import {TournamentCountdown} from '../components/TournamentCountdown';

type HomeScreenProps = {
  user: ApiUser | null;
  onGoToTasks: () => void;
  onGoToTournaments: () => void;
  onGoToQuiz: () => void;
};

const NEWS = [
  {
    title: 'Сезон турниров на CodeArena',
    summary:
      'Соревнуйтесь с другими участниками в серии задач: сначала нажмите «Присоединиться», затем «Решать». Итоговая таблица открывается после завершения турнира администратором.',
    tag: 'Турниры',
  },
  {
    title: 'Редактор с подсветкой кода',
    summary:
      'В полях решения и в админке включена подсветка синтаксиса в стиле IDE — меньше ошибок и приятнее писать код.',
    tag: 'Обновление',
  },
  {
    title: 'Песочница QuickJS',
    summary:
      'Задачи каталога проверяются в изолированной среде: без Node, файловой системы и сети. Безопасный запуск ваших решений на JavaScript.',
    tag: 'Платформа',
  },
  {
    title: 'Совет участнику турнира',
    summary:
      'Пока турнир не начат, условия скрыты — это нормально. После старта открывайте задачи по очереди и ждите оценки PASS / FAIL от администратора.',
    tag: 'Справка',
  },
  {
    title: 'Practice & Compete',
    summary:
      'CodeArena — площадка для тренировки: каталог задач, история попыток и статистика. Регистрируйтесь и сохраняйте прогресс под своим аккаунтом.',
    tag: 'О проекте',
  },
];

function statusRu(s: string) {
  if (s === 'pending') return 'Набор';
  if (s === 'live') return 'Идёт';
  return 'Завершён';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({user, onGoToTasks, onGoToTournaments, onGoToQuiz}) => {
  const [slide, setSlide] = useState(0);
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [loadingT, setLoadingT] = useState(true);
  const [tError, setTError] = useState<string | null>(null);

  const loadT = useCallback(async () => {
    setLoadingT(true);
    setTError(null);
    try {
      const list = await listTournaments(user?.id);
      setTournaments(list.filter((t) => t.status === 'live'));
    } catch (e) {
      setTError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingT(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadT();
  }, [loadT]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((i) => (i + 1) % NEWS.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);

  const activeSlide = useMemo(() => NEWS[slide]!, [slide]);

  return (
    <div className="min-h-[calc(100vh-4rem)] pb-8">
      <section className="relative overflow-hidden border-b border-outline-variant/10 bg-gradient-to-br from-surface-container-low via-background to-primary/5">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_20%,var(--color-primary),transparent_45%),radial-gradient(circle_at_80%_60%,var(--color-secondary),transparent_40%)] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 md:px-10 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="space-y-4 max-w-xl">
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Добро пожаловать
              </p>
              <h1 className="text-3xl md:text-4xl font-black font-headline text-on-surface leading-tight">
                Тренируйте код, участвуйте в турнирах, отслеживайте прогресс
              </h1>
              <p className="text-on-surface-variant text-sm md:text-base leading-relaxed">
                Решайте задачи с автопроверкой, присоединяйтесь к турнирам с ручной оценкой и смотрите итоговые таблицы после финиша.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={onGoToTasks}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary-container font-bold text-sm shadow-md shadow-primary/20 hover:brightness-110 transition-all"
                >
                  <Trophy className="w-4 h-4" />
                  Каталог задач
                </button>
                <button
                  type="button"
                  onClick={onGoToTournaments}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-highest border border-outline-variant/20 text-on-surface font-bold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <Medal className="w-4 h-4 text-primary" />
                  Все турниры
                </button>
                <button
                  type="button"
                  onClick={onGoToQuiz}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-container-highest border border-outline-variant/20 text-on-surface font-bold text-sm hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <BookOpen className="w-4 h-4 text-secondary" />
                  Теоретический тест
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center w-36 h-36 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Code2 className="w-20 h-20 opacity-90" strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 space-y-12">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Newspaper className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-headline text-on-surface">Новости площадки</h2>
          </div>
          <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low overflow-hidden shadow-inner">
            <div className="relative min-h-[180px] md:min-h-[160px] p-6 md:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{opacity: 0, x: 16}}
                  animate={{opacity: 1, x: 0}}
                  exit={{opacity: 0, x: -16}}
                  transition={{duration: 0.25}}
                  className="space-y-3"
                >
                  <span className="inline-block text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/15 px-2 py-1 rounded-md">
                    {activeSlide.tag}
                  </span>
                  <h3 className="text-xl font-bold text-on-surface font-headline">{activeSlide.title}</h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">{activeSlide.summary}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-outline-variant/10 bg-surface-container-highest/30">
              <button
                type="button"
                aria-label="Предыдущая новость"
                onClick={() => setSlide((i) => (i - 1 + NEWS.length) % NEWS.length)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-1.5">
                {NEWS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Новость ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === slide ? 'w-8 bg-primary' : 'w-2 bg-outline-variant/40 hover:bg-outline-variant/70'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Следующая новость"
                onClick={() => setSlide((i) => (i + 1) % NEWS.length)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-secondary" />
              <h2 className="text-lg font-bold font-headline text-on-surface">Сейчас идут турниры</h2>
            </div>
            <button
              type="button"
              onClick={onGoToTournaments}
              className="text-sm font-bold text-primary inline-flex items-center gap-1 hover:underline"
            >
              Полный список
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {loadingT ? (
            <div className="flex items-center gap-2 text-on-surface-variant py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
              Загрузка…
            </div>
          ) : tError ? (
            <p className="text-error text-sm">{tError}</p>
          ) : tournaments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/50 px-6 py-10 text-center text-on-surface-variant text-sm">
              Сейчас нет турниров в статусе «Идёт». Загляните позже или откройте раздел турниров — возможно, идёт набор
              участников.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tournaments.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={onGoToTournaments}
                    className="w-full text-left rounded-xl border border-outline-variant/15 bg-surface-container-low p-5 hover:border-primary/35 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-on-surface group-hover:text-primary transition-colors">{t.name}</div>
                      <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-secondary/20 text-secondary">
                        {statusRu(t.status)}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-2">Задач в туре: {t.taskCount}</p>
                    <TournamentCountdown endsAt={t.endsAt ?? null} status={t.status} className="mt-2 block" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold font-headline text-on-surface mb-4">Возможности платформы</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-2">
              <Trophy className="w-8 h-8 text-primary mb-1" />
              <h3 className="font-bold text-on-surface">Каталог задач</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Сложность от easy до hard, мгновенный прогон кода и сохранение попыток в профиле.
              </p>
              <button
                type="button"
                onClick={onGoToTasks}
                className="text-xs font-bold text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              >
                Перейти <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-2">
              <Medal className="w-8 h-8 text-secondary mb-1" />
              <h3 className="font-bold text-on-surface">Турниры</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Условия по очереди, ручная проверка администратором и итоговая таблица после финала.
              </p>
              <button
                type="button"
                onClick={onGoToTournaments}
                className="text-xs font-bold text-primary mt-2 inline-flex items-center gap-1 hover:underline"
              >
                Перейти <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-2">
              <Sparkles className="w-8 h-8 text-tertiary mb-1" />
              <h3 className="font-bold text-on-surface">Прогресс</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {user
                  ? `Вы вошли как ${user.username} — попытки и турниры привязаны к аккаунту.`
                  : 'Войдите, чтобы сохранять решения и участвовать в турнирах под своим именем.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
