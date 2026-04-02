import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Bell} from 'lucide-react';
import type {ApiUser, NotificationItem} from '../types';
import {listNotifications, markNotificationRead} from '../api';
import {cn} from '../lib/utils';

type Props = {
  user: ApiUser | null;
  onOpenTournaments: () => void;
};

export const NotificationBell: React.FC<Props> = ({user, onOpenTournaments}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listNotifications(user.id);
      setItems(data.items);
      setUnread(data.unreadCount);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    void load();
    const t = window.setInterval(() => void load(), 45000);
    return () => window.clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  if (!user) {
    return (
      <button
        type="button"
        className="w-10 h-10 flex items-center justify-center text-on-surface-variant/40 rounded-lg cursor-not-allowed"
        aria-label="Уведомления"
        disabled
      >
        <Bell className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-all active:scale-95"
        aria-label="Уведомления"
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full bg-error text-[9px] font-black text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-low shadow-xl z-[60] custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-outline-variant/10 text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
            Уведомления
            {loading ? <span className="ml-2 font-normal">…</span> : null}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-on-surface-variant text-center">Пока пусто</div>
          ) : (
            <ul className="py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm border-b border-outline-variant/5 last:border-0 transition-colors hover:bg-surface-container-highest/80',
                      !n.readAt && 'bg-primary/5',
                    )}
                    onClick={async () => {
                      if (!user) return;
                      if (!n.readAt) {
                        try {
                          await markNotificationRead(n.id, user.id);
                          await load();
                        } catch {
                          /* ignore */
                        }
                      }
                      if (n.linkKind === 'tournament' && n.linkId) {
                        onOpenTournaments();
                        setOpen(false);
                      }
                    }}
                  >
                    <div className="font-bold text-on-surface line-clamp-2">{n.title}</div>
                    {n.body ? <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-3">{n.body}</div> : null}
                    <div className="text-[10px] text-on-surface-variant/70 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
