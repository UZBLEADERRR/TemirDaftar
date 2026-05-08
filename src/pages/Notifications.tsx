import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

export const Notifications = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      try {
        const data = await apiCall('/api/notifications');
        setNotifications(data);
        // Mark all as read
        await apiCall('/api/notifications/read-all', { method: 'PATCH' });
      } catch {}
    };
    fetchNotifs();
  }, [user]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6 mt-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Bell size={24} /> {t('notifications', 'Bildirishnomalar')}
        </h1>
      </div>

      <div className="flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="text-center text-zinc-400 py-10">{t('no_records_found')}</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{n.title}</h4>
                <span className="text-[10px] text-zinc-400 font-medium shrink-0 ml-2">{timeAgo(n.created_at)}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{n.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
