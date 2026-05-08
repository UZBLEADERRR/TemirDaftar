import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback } from '@/src/lib/telegram';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/lib/utils';

const CURRENCIES = ['UZS', 'USD', 'RUB', 'KRW', 'EUR'];

export const Home = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [toReceive, setToReceive] = useState<Record<string, number>>({});
  const [toPay, setToPay] = useState<Record<string, number>>({});
  const [activeCurrency, setActiveCurrency] = useState('UZS');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDebts = async () => {
      try {
        const data = await apiCall('/api/debts');

        const receiveTotals: Record<string, number> = {};
        (data.given || []).forEach((d: any) => {
          if (['pending', 'active', 'verifying', 'overdue'].includes(d.status)) {
            const c = d.currency || 'UZS';
            receiveTotals[c] = (receiveTotals[c] || 0) + d.amount;
          }
        });
        setToReceive(receiveTotals);

        const payTotals: Record<string, number> = {};
        (data.taken || []).forEach((d: any) => {
          if (['pending', 'active', 'verifying', 'overdue'].includes(d.status)) {
            const c = d.currency || 'UZS';
            payTotals[c] = (payTotals[c] || 0) + d.amount;
          }
        });
        setToPay(payTotals);
      } catch (err) {
        console.error('Failed to fetch debts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDebts();
  }, [user]);

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h2 className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{t('welcome')}</h2>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {user?.name?.split(' ')[0] || 'User'}
          </h1>
        </div>
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/20 shadow-lg">
          <span className="text-white font-bold text-lg">{user?.name?.charAt(0) || 'U'}</span>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
        {CURRENCIES.map(c => (
          <button
            key={c}
            onClick={() => { setActiveCurrency(c); hapticFeedback(); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              activeCurrency === c
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 border-none shadow-lg shadow-indigo-500/20 text-white">
          <CardContent className="p-5 flex flex-col gap-1">
            <span className="text-indigo-200 text-xs font-medium uppercase tracking-wider">{t('to_receive')}</span>
            <span className="text-2xl font-bold">
              {loading ? '...' : (toReceive[activeCurrency] || 0).toLocaleString()}
              <span className="text-sm font-normal ml-1 opacity-70">{activeCurrency}</span>
            </span>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <CardContent className="p-5 flex flex-col gap-1">
            <span className="text-zinc-500 dark:text-zinc-400 text-xs font-medium uppercase tracking-wider">{t('to_pay')}</span>
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {loading ? '...' : (toPay[activeCurrency] || 0).toLocaleString()}
              <span className="text-sm font-medium text-zinc-500 ml-1">{activeCurrency}</span>
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          to="/add?type=gave"
          onClick={() => hapticFeedback()}
          className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 h-14 rounded-xl font-bold text-white active:scale-95 transition-all shadow-md shadow-indigo-500/20"
        >
          {t('i_gave')}
        </Link>
        <Link
          to="/add?type=took"
          onClick={() => hapticFeedback()}
          className="w-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 h-14 rounded-xl font-bold text-zinc-900 dark:text-zinc-100 active:scale-95 transition-transform border border-zinc-200 dark:border-zinc-700"
        >
          {t('i_took')}
        </Link>
      </div>
    </div>
  );
};
