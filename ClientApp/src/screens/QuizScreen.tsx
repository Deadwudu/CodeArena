import React, {useCallback, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {CheckCircle2, CircleHelp, Loader2, RotateCcw, XCircle} from 'lucide-react';
import type {ApiUser, QuizQuestionPublic, QuizResultItem} from '../types';
import {getQuizResults, startQuizSession, submitQuizAttempt} from '../api';

const LABELS = ['A', 'B', 'C', 'D'];

type Phase = 'intro' | 'quiz' | 'submitting' | 'results';

export const QuizScreen: React.FC<{user: ApiUser | null}> = ({user}) => {
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [score, setScore] = useState({right: 0, total: 0});

  const answeredCount = useMemo(() => questions.filter((q) => answers[q.id] !== undefined).length, [questions, answers]);
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const start = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const {attemptId: aid, questions: qs} = await startQuizSession(user.id);
      setAttemptId(aid);
      setQuestions(qs);
      setAnswers({});
      setResults([]);
      setPhase('quiz');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user]);

  const submit = useCallback(async () => {
    if (!user || attemptId == null || !allAnswered) return;
    setError(null);
    setPhase('submitting');
    try {
      const payload = questions.map((q) => ({
        questionId: q.id,
        chosenIndex: answers[q.id]!,
      }));
      await submitQuizAttempt({attemptId, userId: user.id, answers: payload});
      const r = await getQuizResults(attemptId, user.id);
      setResults(r.items);
      setScore({right: r.score, total: r.total});
      setPhase('results');
    } catch (e) {
      setPhase('quiz');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [user, attemptId, allAnswered, questions, answers]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <CircleHelp className="w-12 h-12 text-on-surface-variant mx-auto mb-4 opacity-60" />
        <p className="text-on-surface-variant">Войдите в аккаунт, чтобы пройти теоретический тест.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{opacity: 0, y: 8}} animate={{opacity: 1, y: 0}} className="max-w-3xl mx-auto px-6 py-8 pb-24 md:pb-10">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
          <CircleHelp className="w-7 h-7 text-on-secondary-container" />
        </div>
        <div>
          <h1 className="text-2xl font-black font-headline text-on-surface">Теоретический тест</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Случайные 20 вопросов из банка. После отправки — разбор: верные ответы зелёным, неверные выбранные — красным.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</div>
      ) : null}

      {phase === 'intro' ? (
        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-8 text-center space-y-6">
          <p className="text-on-surface-variant text-sm">
            Начать новую сессию. Если у вас была незавершённая попытка, она будет сброшена.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-on-primary-container font-bold shadow-md shadow-primary/20 hover:brightness-110 transition-all"
          >
            Начать тест (20 вопросов)
          </button>
        </div>
      ) : null}

      {phase === 'quiz' && questions.length ? (
        <div className="space-y-8">
          <div className="sticky top-16 z-10 -mx-2 px-2 py-3 bg-background/90 backdrop-blur border-b border-outline-variant/10 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-on-surface-variant">
              Отвечено: <strong className="text-primary">{answeredCount}</strong> / {questions.length}
            </span>
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => void submit()}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary-container text-sm font-bold disabled:opacity-40"
            >
              Отправить ответы
            </button>
          </div>

          {questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 md:p-6 scroll-mt-24"
            >
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Вопрос {i + 1}</p>
              <p className="text-on-surface font-medium leading-relaxed mb-4">{q.text}</p>
              <div className="grid gap-2">
                {q.options.map((opt, idx) => {
                  const picked = answers[q.id] === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAnswers((prev) => ({...prev, [q.id]: idx}))}
                      className={`text-left rounded-xl border px-4 py-3 text-sm transition-all ${
                        picked
                          ? 'border-primary bg-primary/15 text-on-surface font-bold'
                          : 'border-outline-variant/20 bg-surface-container hover:border-primary/40'
                      }`}
                    >
                      <span className="text-primary mr-2">{LABELS[idx]}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-center pb-8">
            <button
              type="button"
              disabled={!allAnswered}
              onClick={() => void submit()}
              className="px-8 py-3 rounded-xl bg-primary text-on-primary-container font-bold disabled:opacity-40"
            >
              Отправить все ответы
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'submitting' ? (
        <div className="flex items-center justify-center gap-3 py-20 text-on-surface-variant">
          <Loader2 className="w-6 h-6 animate-spin" />
          Проверка ответов…
        </div>
      ) : null}

      {phase === 'results' && results.length ? (
        <div className="space-y-8">
          <div
            className={`rounded-2xl border p-6 text-center ${
              score.right >= score.total * 0.7
                ? 'border-primary/40 bg-primary/10'
                : 'border-outline-variant/20 bg-surface-container-low'
            }`}
          >
            <p className="text-sm text-on-surface-variant mb-1">Итог</p>
            <p className="text-3xl font-black font-headline text-on-surface">
              {score.right} <span className="text-on-surface-variant text-xl font-bold">/ {score.total}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase('intro');
                setAttemptId(null);
                setQuestions([]);
                setAnswers({});
                setResults([]);
              }}
              className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-container-highest border border-outline-variant/20 font-bold text-sm hover:border-primary/40"
            >
              <RotateCcw className="w-4 h-4" />
              Пройти снова
            </button>
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-bold font-headline text-on-surface">Разбор</h2>
            {results.map((item, i) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-5 md:p-6 ${
                  item.isCorrect ? 'border-primary/35 bg-primary/5' : 'border-error/30 bg-error/5'
                }`}
              >
                <div className="flex items-start gap-2 mb-3">
                  {item.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Вопрос {i + 1}
                  </span>
                </div>
                <p className="text-on-surface font-medium mb-4">{item.text}</p>
                <ul className="space-y-2">
                  {item.options.map((opt, idx) => {
                    const isCorrect = idx === item.correctIndex;
                    const isChosen = idx === item.chosenIndex;
                    let cls =
                      'border-outline-variant/20 bg-surface-container text-on-surface-variant';
                    if (isCorrect) cls = 'border-primary bg-primary/15 text-on-surface font-semibold';
                    else if (isChosen && !item.isCorrect) cls = 'border-error bg-error/15 text-error font-semibold';
                    return (
                      <li key={idx} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="mr-2 opacity-70">{LABELS[idx]}.</span>
                        {opt}
                        {isCorrect ? <span className="ml-2 text-xs text-primary">верно</span> : null}
                        {isChosen && !isCorrect ? <span className="ml-2 text-xs">ваш ответ</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};
