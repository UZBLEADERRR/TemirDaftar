import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const ShopReports = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiCall('/api/shop/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const formatNum = (n: number) => n.toLocaleString('uz-UZ');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-5 mt-4">
        <h1 className="text-2xl font-bold mb-4">Hisobotlar</h1>
        <p className="text-zinc-500 text-center py-16">Ma'lumot topilmadi</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-6">Hisobotlar</h1>

      {/* Daily Summary */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Bugungi kun</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-emerald-600">{formatNum(stats.todayCash)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">💵 Naqd</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-blue-600">{formatNum(stats.todayDebt)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">📝 Qarzga</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formatNum(stats.todayTotal)}</p>
            <p className="text-[10px] text-zinc-500 mt-1">📊 Jami</p>
          </div>
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Oylik umumiy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatNum(stats.monthlyTotal)}</p>
            <p className="text-xs text-zinc-500 mt-1">Jami savdo (UZS)</p>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{formatNum(stats.activeDebtSum)}</p>
            <p className="text-xs text-zinc-500 mt-1">Jami qarz (UZS)</p>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      {stats.dailyBreakdown?.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 mb-4 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Kunlik savdo grafigi</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.dailyBreakdown}>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => v.split('-')[2]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#fff',
                }}
                formatter={(value: number) => [formatNum(value) + ' UZS']}
                labelFormatter={(label) => `Sana: ${label}`}
              />
              <Bar dataKey="cash" name="Naqd" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="debt" name="Qarzga" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
              <span className="text-[10px] text-zinc-500 font-medium">Naqd</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              <span className="text-[10px] text-zinc-500 font-medium">Qarzga</span>
            </div>
          </div>
        </div>
      )}

      {/* Debt Stats */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Qarz statistikasi</h3>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
            <span className="text-sm font-medium">Faol qarzlar</span>
            <span className="font-bold text-blue-600">{stats.activeDebtCount}</span>
          </div>
          <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
            <span className="text-sm font-medium">Kechiktirilgan</span>
            <span className="font-bold text-red-500">{stats.overdueCount}</span>
          </div>
          <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
            <span className="text-sm font-medium">Vaqtida to'lagan mijozlar</span>
            <span className="font-bold text-emerald-600">{stats.onTimeCustomers}</span>
          </div>
          <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
            <span className="text-sm font-medium">Jami mijozlar</span>
            <span className="font-bold">{stats.totalCustomers}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
