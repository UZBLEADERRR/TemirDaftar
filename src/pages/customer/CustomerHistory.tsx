import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { CheckCircle2 } from 'lucide-react';

export const CustomerHistory = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiCall('/api/customer/history')
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-6">To'lov tarixi</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="text-5xl">📋</span>
          <p className="text-sm text-zinc-500">To'lov tarixi hali yo'q</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map(d => (
            <div
              key={d.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {d.giver?.shop_name || d.giver?.name || 'Do\'kon'}
                  </p>
                  {d.note && <p className="text-xs text-zinc-500 mt-0.5">{d.note}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <p className="font-bold text-sm text-emerald-600">
                    {d.amount.toLocaleString()} {d.currency}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] text-zinc-400">Yaratilgan: {d.created_at?.split('T')[0]}</span>
                <span className="text-[10px] text-emerald-500 font-bold">To'langan: {d.updated_at?.split('T')[0]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
