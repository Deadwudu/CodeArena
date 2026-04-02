import React, {useEffect, useState} from 'react';
import {Timer} from 'lucide-react';

type Props = {
  endsAt: string | null | undefined;
  status: string;
  className?: string;
};

export const TournamentCountdown: React.FC<Props> = ({endsAt, status, className}) => {
  const [leftMs, setLeftMs] = useState<number | null>(null);

  useEffect(() => {
    if (status !== 'live' || !endsAt) {
      setLeftMs(null);
      return;
    }
    const end = new Date(endsAt).getTime();
    const tick = () => {
      const ms = end - Date.now();
      setLeftMs(ms <= 0 ? 0 : ms);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt, status]);

  if (status !== 'live' || !endsAt || leftMs === null) return null;

  if (leftMs <= 0) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-bold text-error ${className ?? ''}`}>
        <Timer className="w-3.5 h-3.5 shrink-0" />
        Время вышло — турнир закрывается
      </div>
    );
  }

  const h = Math.floor(leftMs / 3600000);
  const m = Math.floor((leftMs % 3600000) / 60000);
  const s = Math.floor((leftMs % 60000) / 1000);

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold text-primary ${className ?? ''}`}>
      <Timer className="w-3.5 h-3.5 shrink-0" />
      До конца: {h > 0 ? `${h}ч ` : ''}
      {m}м {s}с
    </div>
  );
};
