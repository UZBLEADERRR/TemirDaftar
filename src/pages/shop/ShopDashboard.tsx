import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall } from '@/src/lib/telegram';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Users, DollarSign, Clock } from 'lucide-react';

interface Stats {
  todayCash: number;
  todayDebt: number;
  todayTotal: number;
  monthlyTotal: number;
  overdueCount: number;
  overdueSum: number;
  onTimeCustomers: number;
  activeDebtSum: number;
  activeDebtCount: number;
  totalCustomers: number;
  dailyBreakdown: Array<{ date: string; cash: number; debt: number; total: number }>;
}

export const ShopDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await apiCall('/api/shop/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const formatNum = (n: number) => n.toLocaleString('uz-UZ');

  // Calculate trial days remaining
  const getTrialDays = () => {
    if (user?.subscription_status !== 'trial' || !user.trial_started_at) return null;
    const trialEnd = new Date(new Date(user.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    const remaining = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    return remaining;
  };

  const trialDays = getTrialDays();

  return (
    <div className="p-5 pb-6">
      {/* Header */}
      <header className="flex justify-between items-start mb-6 mt-4">
        <div>
          <h2 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Xush kelibsiz</h2>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {user?.shop_name || user?.name?.split(' ')[0] || 'Do\'kon'}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-lg">🏪</span>
          </div>
          {trialDays !== null && (
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
              {trialDays} kun qoldi
            </span>
          )}
        </div>
      </header>

      {/* Subscription warning */}
      {user?.subscription_status === 'expired' && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Obuna muddati tugagan. Yangi qarz qo'shish va eslatma uchun obunani yangilang.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : stats ? (
        <>
          {/* Today's Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* Today Cash */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <DollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Bugungi naqd</span>
                </div>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatNum(stats.todayCash)}</p>
                <p className="text-[10px] text-zinc-400">UZS</p>
              </CardContent>
            </Card>

            {/* Today Debt */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <Clock size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Bugungi qarz</span>
                </div>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatNum(stats.todayDebt)}</p>
                <p className="text-[10px] text-zinc-400">UZS</p>
              </CardContent>
            </Card>

            {/* Overdue */}
            <Card className={`border shadow-sm overflow-hidden ${stats.overdueCount > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.overdueCount > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                    <AlertTriangle size={16} className={stats.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'} />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Kechiktirilgan</span>
                </div>
                <p className={`text-xl font-bold ${stats.overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>
                  {stats.overdueCount}
                </p>
                <p className="text-[10px] text-zinc-400">{formatNum(stats.overdueSum)} UZS</p>
              </CardContent>
            </Card>

            {/* Monthly Total */}
            <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                    <TrendingUp size={16} className="text-zinc-600 dark:text-zinc-300" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Oylik jami</span>
                </div>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{formatNum(stats.monthlyTotal)}</p>
                <p className="text-[10px] text-zinc-400">UZS</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Info Row */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.onTimeCustomers}</p>
              <p className="text-[10px] text-zinc-500 font-medium">Vaqtida to'laydi</p>
            </div>
            <div className="flex-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.totalCustomers}</p>
              <p className="text-[10px] text-zinc-500 font-medium">Jami mijozlar</p>
            </div>
            <div className="flex-1 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.activeDebtCount}</p>
              <p className="text-[10px] text-zinc-500 font-medium">Faol qarzlar</p>
            </div>
          </div>

          {/* Monthly Chart */}
          {stats.dailyBreakdown.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">Oylik savdo statistikasi</h3>
              <ResponsiveContainer width="100%" height={200}>
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
                    formatter={(value: number) => [formatNum(value) + ' UZS', '']}
                    labelFormatter={(label) => `Sana: ${label}`}
                  />
                  <Bar dataKey="cash" name="Naqd" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="debt" name="Qarzga" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
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
        </>
      ) : (
        <div className="text-center text-zinc-400 py-16">
          <span className="text-4xl">📊</span>
          <p className="text-sm mt-2">Ma'lumot topilmadi</p>
        </div>
      )}
    </div>
  );
};
