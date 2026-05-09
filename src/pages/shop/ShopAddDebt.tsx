import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ChevronLeft, CheckCircle2, CreditCard, Banknote } from 'lucide-react';

export const ShopAddDebt = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdDebt, setCreatedDebt] = useState<any>(null);
  const [saleType, setSaleType] = useState<'debt' | 'cash'>('debt');

  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');

  useEffect(() => {
    // Load customers for dropdown
    apiCall('/api/shop/customers')
      .then(setCustomers)
      .catch(() => {});

    // Pre-fill from search params
    const cId = searchParams.get('customerId');
    const cName = searchParams.get('name');
    if (cId) setSelectedCustomer(cId);
    if (cName) setReceiverName(cName);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    const currency = fd.get('currency') as string;
    const dueDate = fd.get('dueDate') as string;
    const note = fd.get('note') as string;

    if (!amount || amount <= 0) {
      toast.error('Summani kiriting');
      setLoading(false);
      return;
    }

    try {
      if (saleType === 'cash') {
        // Just record a cash sale, no debt
        await apiCall('/api/shop/sales', {
          method: 'POST',
          body: JSON.stringify({ amount, currency, note }),
        });
        hapticSuccess();
        toast.success('Naqd savdo qayd qilindi!');
        setCreated(true);
        setCreatedDebt({ amount, currency, sale_type: 'cash', note });
      } else {
        // Create debt
        if (!dueDate) {
          toast.error('To\'lov muddatini kiriting');
          setLoading(false);
          return;
        }

        const debt = await apiCall('/api/shop/debts', {
          method: 'POST',
          body: JSON.stringify({
            amount,
            currency,
            dueDate,
            receiverName: receiverName || (selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.displayName : ''),
            receiverPhone,
            note,
            saleType: 'debt',
            customerId: selectedCustomer || undefined,
          }),
        });
        hapticSuccess();
        setCreated(true);
        setCreatedDebt(debt);
      }
    } catch (err: any) {
      if (err.message?.includes('subscription_expired')) {
        toast.error('Obuna muddati tugagan. Yangi qarz qo\'shish uchun obunani yangilang.');
      } else {
        toast.error(err.message || 'Xatolik yuz berdi');
      }
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (created && createdDebt) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            {createdDebt.sale_type === 'cash' ? 'Naqd savdo qayd qilindi!' : 'Qarz yaratildi!'}
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mt-4 mb-6 text-left">
            <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-2">
              <span className="text-xs text-zinc-500">Summa</span>
              <span className="font-bold text-sm">{createdDebt.amount?.toLocaleString()} {createdDebt.currency || 'UZS'}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-2">
              <span className="text-xs text-zinc-500">Turi</span>
              <span className="font-bold text-sm">{createdDebt.sale_type === 'cash' ? '💵 Naqd' : '📝 Qarzga'}</span>
            </div>
            {createdDebt.due_date && (
              <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2 mb-2">
                <span className="text-xs text-zinc-500">Muddat</span>
                <span className="font-bold text-sm">{createdDebt.due_date}</span>
              </div>
            )}
            {createdDebt.note && (
              <div className="flex justify-between">
                <span className="text-xs text-zinc-500">Izoh</span>
                <span className="text-sm">{createdDebt.note}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setCreated(false); setCreatedDebt(null); }}>
              Yana qo'shish
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={() => navigate('/')}>
              Bosh sahifa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-6 mt-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <ChevronLeft size={24} className="text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Savdo qo'shish
        </h1>
      </div>

      {/* Sale Type Toggle */}
      <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 mb-6">
        <button
          onClick={() => { setSaleType('debt'); hapticFeedback(); }}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-lg transition-all ${
            saleType === 'debt'
              ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400'
              : 'text-zinc-500'
          }`}
        >
          <CreditCard size={16} />
          Qarzga
        </button>
        <button
          onClick={() => { setSaleType('cash'); hapticFeedback(); }}
          className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-bold rounded-lg transition-all ${
            saleType === 'cash'
              ? 'bg-white dark:bg-zinc-800 shadow-sm text-emerald-600 dark:text-emerald-400'
              : 'text-zinc-500'
          }`}
        >
          <Banknote size={16} />
          Naqd
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Amount + Currency */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Summa</Label>
          <div className="flex gap-2">
            <Input
              name="amount"
              type="text"
              inputMode="numeric"
              required
              placeholder="50000"
              className="h-12 text-lg rounded-xl dark:bg-zinc-900 flex-1 font-bold"
              onInput={e => {
                const v = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '').replace(/^0+/, '');
                (e.target as HTMLInputElement).value = v;
              }}
            />
            <select name="currency" className="h-12 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-100 font-bold w-24 outline-none">
              <option value="UZS">UZS</option>
              <option value="USD">USD</option>
              <option value="RUB">RUB</option>
            </select>
          </div>
        </div>

        {/* Customer selection (only for debt) */}
        {saleType === 'debt' && (
          <>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Mijoz</Label>
              {customers.length > 0 ? (
                <select
                  value={selectedCustomer}
                  onChange={e => {
                    setSelectedCustomer(e.target.value);
                    const found = customers.find(c => c.id === e.target.value);
                    if (found) {
                      setReceiverName(found.displayName || '');
                      setReceiverPhone(found.displayPhone || '');
                    }
                  }}
                  className="h-12 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-100 font-medium outline-none"
                >
                  <option value="">Yangi mijoz...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.displayName}{c.totalDebt > 0 ? ` (${c.totalDebt.toLocaleString()} UZS)` : ''}</option>
                  ))}
                </select>
              ) : null}

              {!selectedCustomer && (
                <div className="flex flex-col gap-3 mt-1">
                  <Input
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    required
                    placeholder="Mijoz ismi"
                    className="h-12 rounded-xl dark:bg-zinc-900"
                  />
                  <Input
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    placeholder="+998 90 123 45 67 (ixtiyoriy)"
                    className="h-12 rounded-xl dark:bg-zinc-900"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">To'lov muddati</Label>
              <Input name="dueDate" type="date" required className="h-12 rounded-xl dark:bg-zinc-900" />
            </div>
          </>
        )}

        {/* Note */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Izoh (ixtiyoriy)</Label>
          <Input name="note" placeholder="Mahsulot nomi, miqdori..." className="h-12 rounded-xl dark:bg-zinc-900" />
        </div>

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className={`h-14 mt-4 text-lg rounded-xl w-full border-none shadow-lg font-bold ${
            saleType === 'debt'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
          } text-white`}
        >
          {loading ? '...' : saleType === 'debt' ? '📝 Qarz yaratish' : '💵 Naqd savdo qayd qilish'}
        </Button>
      </form>
    </div>
  );
};
