import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Debt {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  note: string;
  status: string;
  created_at: string;
  giver: {
    name: string;
    shop_name: string;
  };
}

export const CustomerHome = () => {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiCall('/api/customer/debts')
      .then(setDebts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const activeDebts = debts.filter(d => ['active', 'pending', 'overdue'].includes(d.status));
  const totalDebt = activeDebts.reduce((sum, d) => sum + d.amount, 0);
  const overdueDebts = activeDebts.filter(d => d.status === 'overdue');

  const getDaysLeft = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
  };

  return (
    <div className="p-5">
      <header className="mt-4 mb-6">
        <h2 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Salom</h2>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {user?.name || 'Mijoz'}
        </h1>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Total debt card */}
          <div className="bg-gradient-to-br from-slate-800 to-zinc-900 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2">Jami qarz</p>
            <p className="text-4xl font-bold text-white mb-1">
              {totalDebt.toLocaleString()}
              <span className="text-lg font-normal text-zinc-400 ml-2">UZS</span>
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              {activeDebts.length} ta faol qarz
              {overdueDebts.length > 0 && (
                <span className="text-red-400 ml-2">• {overdueDebts.length} ta kechikkan</span>
              )}
            </p>
          </div>

          {/* Active debts list */}
          {activeDebts.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <p className="text-sm text-zinc-500 font-medium">Qarzingiz yo'q!</p>
              <p className="text-xs text-zinc-400">Hamma narsa yaxshi 👍</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Joriy qarzlar</h3>
              {activeDebts.map(d => {
                const daysLeft = getDaysLeft(d.due_date);
                const isOverdue = d.status === 'overdue' || daysLeft < 0;
                const isUrgent = daysLeft <= 3 && daysLeft >= 0;

                return (
                  <div
                    key={d.id}
                    className={`bg-white dark:bg-zinc-900 border rounded-xl p-4 ${
                      isOverdue
                        ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
                        : isUrgent
                        ? 'border-amber-300 dark:border-amber-800'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {d.giver?.shop_name || d.giver?.name || 'Do\'kon'}
                        </p>
                        {d.note && <p className="text-xs text-zinc-500 mt-0.5">{d.note}</p>}
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {d.amount.toLocaleString()}
                        <span className="text-xs text-zinc-500 ml-1">{d.currency}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        {isOverdue ? (
                          <AlertTriangle size={14} className="text-red-500" />
                        ) : (
                          <Clock size={14} className="text-zinc-400" />
                        )}
                        <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-zinc-500'}`}>
                          {isOverdue
                            ? `${Math.abs(daysLeft)} kun kechikkan`
                            : daysLeft === 0
                            ? 'Bugun!'
                            : daysLeft === 1
                            ? 'Ertaga'
                            : `${daysLeft} kun qoldi`
                          }
                        </span>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        isOverdue
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {d.due_date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
