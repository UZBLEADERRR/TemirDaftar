import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, ChevronLeft, CheckCircle2, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const ShopDebts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'paid'>('active');
  const [selected, setSelected] = useState<any>(null);
  const [reminding, setReminding] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadDebts();
  }, [user]);

  const loadDebts = async () => {
    try {
      const data = await apiCall('/api/shop/debts');
      setDebts(data);
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemind = async (debtId: string) => {
    setReminding(true);
    try {
      await apiCall(`/api/shop/remind/${debtId}`, { method: 'POST' });
      hapticSuccess();
      toast.success('Eslatma yuborildi!');
    } catch (err: any) {
      if (err.message?.includes('subscription_expired')) {
        toast.error('Obuna muddati tugagan');
      } else {
        toast.error(err.message || 'Xatolik');
      }
    } finally {
      setReminding(false);
    }
  };

  const handleMarkPaid = async (debtId: string) => {
    try {
      await apiCall(`/api/shop/debts/${debtId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      });
      hapticSuccess();
      toast.success('To\'langan deb belgilandi');
      setDebts(debts.map(d => d.id === debtId ? { ...d, status: 'paid' } : d));
      setSelected(null);
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    }
  };

  const handleDelete = async (debtId: string) => {
    try {
      await apiCall(`/api/shop/debts/${debtId}`, { method: 'DELETE' });
      hapticSuccess();
      toast.success('O\'chirildi');
      setDebts(debts.filter(d => d.id !== debtId));
      setSelected(null);
    } catch {
      toast.error('Xatolik');
    }
  };

  const filtered = debts.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['active', 'pending'].includes(d.status);
    if (filter === 'overdue') return d.status === 'overdue';
    if (filter === 'paid') return d.status === 'paid';
    return true;
  });

  const statusColors: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    forgiven: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const statusLabels: Record<string, string> = {
    active: 'Faol',
    pending: 'Kutilmoqda',
    overdue: 'Kechikkan',
    paid: 'To\'langan',
    forgiven: 'Kechirilgan',
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-5 mt-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <ChevronLeft size={24} className="text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Qarzlar</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
        {(['active', 'overdue', 'paid', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); hapticFeedback(); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === f
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            {f === 'active' ? 'Faol' : f === 'overdue' ? 'Kechikkan' : f === 'paid' ? 'To\'langan' : 'Hammasi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-2">
          <span className="text-4xl">📭</span>
          <p className="text-sm text-zinc-500">Qarz topilmadi</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(d => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex justify-between items-center w-full text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex flex-col gap-1">
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {d.receiver_name || d.receiver?.name || 'Noma\'lum'}
                </p>
                <p className={`text-xs ${d.status === 'overdue' ? 'text-red-500 font-bold' : 'text-zinc-500'}`}>
                  {d.due_date}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  {d.amount.toLocaleString()} <span className="text-xs text-zinc-500">{d.currency}</span>
                </p>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusColors[d.status] || statusColors.pending}`}>
                  {statusLabels[d.status] || d.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="w-[90%] rounded-2xl dark:bg-zinc-950 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>Qarz tafsilotlari</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 text-sm">Mijoz</span>
                <span className="font-bold text-sm">{selected.receiver_name || selected.receiver?.name || '?'}</span>
              </div>
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 text-sm">Summa</span>
                <span className="font-bold text-sm">{selected.amount.toLocaleString()} {selected.currency}</span>
              </div>
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 text-sm">Muddat</span>
                <span className={`font-bold text-sm ${selected.status === 'overdue' ? 'text-red-500' : ''}`}>{selected.due_date}</span>
              </div>
              <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
                <span className="text-zinc-500 text-sm">Holat</span>
                <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded-full ${statusColors[selected.status]}`}>
                  {statusLabels[selected.status]}
                </span>
              </div>
              {selected.note && (
                <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Izoh</p>
                  <p className="text-sm">{selected.note}</p>
                </div>
              )}

              {/* Actions */}
              {['active', 'overdue'].includes(selected.status) && (
                <div className="flex flex-col gap-2 mt-2">
                  <Button
                    onClick={() => handleRemind(selected.id)}
                    disabled={reminding}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl"
                  >
                    <Bell size={16} />
                    {reminding ? '...' : 'Eslatma yuborish'}
                  </Button>
                  <Button
                    onClick={() => handleMarkPaid(selected.id)}
                    variant="outline"
                    className="w-full border-emerald-200 text-emerald-600 gap-2 rounded-xl font-bold"
                  >
                    <CheckCircle2 size={16} />
                    To'langan deb belgilash
                  </Button>
                </div>
              )}

              {selected.status === 'pending' && (
                <Button
                  onClick={() => handleDelete(selected.id)}
                  variant="destructive"
                  className="w-full gap-2 rounded-xl mt-2"
                >
                  <Trash2 size={16} />
                  O'chirish
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
