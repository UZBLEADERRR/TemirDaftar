import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatMoney } from '@/lib/utils';

const PaymentSection = ({ debt, t }: { debt: any; t: any }) => {
  const [cards, setCards] = useState<string[]>([]);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentToken, setPaymentToken] = useState('');

  useEffect(() => {
    // Get giver's cards
    const giverCards = debt.giver?.cards;
    if (giverCards) setCards(giverCards);
  }, [debt]);

  const handlePay = async () => {
    if (!receiptUrl.trim()) {
      toast.error(t('receipt_required', 'Kvitansiya rasmini yuklang'));
      return;
    }
    setLoading(true);
    try {
      await apiCall(`/api/debts/${debt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'verifying', receipt_url: receiptUrl }),
      });
      hapticSuccess();
      toast.success(t('payment_sent', 'To\'lov tasdiqlashga yuborildi'));
    } catch {
      toast.error(t('error_payment'));
    } finally {
      setLoading(false);
    }
  };

  // Generate payment QR for giver to scan
  const handlePaymentQR = async () => {
    setLoading(true);
    try {
      const res = await apiCall(`/api/debts/${debt.id}/payment-qr`, { method: 'POST' });
      if (res.payment_token) {
        setPaymentToken(res.payment_token);
        hapticSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'QR yaratishda xatolik');
    } finally { setLoading(false); }
  };

  return (
    <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col gap-3">
      <h3 className="font-bold">{t('pay')}</h3>
      {cards.length > 0 ? (
        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg flex flex-col gap-1">
          <span className="text-xs text-zinc-500">{t('receiver_cards', 'Qarz beruvchi kartalari')}:</span>
          {cards.map((c, i) => (
            <span key={i} className="font-mono text-sm bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700">{c}</span>
          ))}
        </div>
      ) : (
        <span className="text-sm text-zinc-500">{t('no_cards_registered')}</span>
      )}
      <Input type="file" accept="image/*" onChange={e => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 800000) { toast.error(t('file_too_large')); return; }
          const reader = new FileReader();
          reader.onload = () => setReceiptUrl(reader.result as string);
          reader.readAsDataURL(file);
        }
      }} className="dark:bg-zinc-900" />
      <Button onClick={handlePay} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
        {loading ? '...' : t('send_payment')}
      </Button>

      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-1">
        <p className="text-xs text-zinc-500 mb-2 text-center">Yoki to'lov QR kodni qarz beruvchiga ko'rsating:</p>
        {paymentToken ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-zinc-200">
              <QRCode value={`PAY:${paymentToken}`} size={140} />
            </div>
            <p className="text-[10px] text-zinc-400 mt-2">Faqat 1 marta ishlatiladi</p>
          </div>
        ) : (
          <Button variant="outline" onClick={handlePaymentQR} disabled={loading} className="w-full">
            📱 To'lov QR yaratish
          </Button>
        )}
      </div>
    </div>
  );
};

const ApproveSection = ({ debt, t }: { debt: any; t: any }) => {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await apiCall(`/api/debts/${debt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      });
      hapticSuccess();
      toast.success(t('thank_receiver'));
    } catch {
      toast.error('Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col gap-3">
      <h3 className="font-bold">{t('payment_verification')}</h3>
      {debt.receipt_url && (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{t('receipt_proof')}</span>
          {debt.receipt_url.startsWith('data:image') ? (
            <img src={debt.receipt_url} alt="Receipt" className="rounded-lg border max-h-48 object-contain" />
          ) : (
            <a href={debt.receipt_url} target="_blank" rel="noreferrer" className="text-indigo-500 underline text-sm break-all">{debt.receipt_url}</a>
          )}
        </div>
      )}
      <Button onClick={handleApprove} disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
        {loading ? '...' : t('approve_payment')}
      </Button>
    </div>
  );
};

const TrustScorePreview = ({ userId, t }: { userId: string; t: any }) => {
  const [trust, setTrust] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    apiCall(`/api/users/${userId}/trust`).then(setTrust).catch(() => {});
  }, [userId]);

  if (!trust) return null;

  const ratio = trust.totalDebts > 0 ? Math.round((trust.paidOnTime / trust.totalDebts) * 100) : 0;
  const color = ratio >= 70 ? 'text-green-500' : ratio >= 40 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
      <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">{t('trust_score', 'Ishonch reytingi')}</h4>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><span className="text-lg font-bold text-zinc-900 dark:text-white">{trust.totalDebts}</span><br/><span className="text-[10px] text-zinc-500">Jami qarz</span></div>
        <div><span className={`text-lg font-bold ${color}`}>{ratio}%</span><br/><span className="text-[10px] text-zinc-500">Vaqtida</span></div>
        <div><span className="text-lg font-bold text-red-500">{trust.overdue}</span><br/><span className="text-[10px] text-zinc-500">Kechikkan</span></div>
      </div>
    </div>
  );
};

const DebtItem: React.FC<{ debt: any; isGiven: boolean; t: any }> = ({ debt, isGiven, t }) => {
  const isOverdue = debt.status === 'overdue' || (debt.status === 'active' && new Date(debt.due_date).getTime() < Date.now());
  const displayStatus = isOverdue ? 'overdue' : debt.status;

  return (
    <Dialog>
      <DialogTrigger className="mb-3 overflow-hidden active:scale-[0.98] transition-transform cursor-pointer border-0 text-left bg-transparent shadow-none w-full p-0">
        <CardContent className={`p-4 flex justify-between items-center bg-white dark:bg-zinc-900 border ${isOverdue ? 'border-red-500/50' : 'border-zinc-200 dark:border-zinc-800'} rounded-xl w-full`}>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-zinc-900 dark:text-zinc-100">
              {isGiven ? (debt.receiver_name || debt.receiver?.name || '?') : (debt.giver?.name || '?')}
            </span>
            <span className={`text-xs ${isOverdue ? 'text-red-500 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {formatDate(debt.due_date)}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`font-bold ${isGiven ? 'text-green-600' : 'text-red-500'}`}>
              {isGiven ? '+' : '-'}{debt.amount.toLocaleString()} <span className="text-xs">{debt.currency}</span>
            </span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
              displayStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              isOverdue ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
              displayStatus === 'verifying' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
              {t(displayStatus) || displayStatus}
            </span>
          </div>
        </CardContent>
      </DialogTrigger>
      <DialogContent className="w-[90%] rounded-xl dark:bg-zinc-950 dark:border-zinc-800">
        <DialogTitle className="dark:text-zinc-100">{t('debt_details')}</DialogTitle>
        <DialogDescription>
          {isOverdue && !isGiven && <div className="text-red-500 font-medium text-sm mt-1">{t('warning_overdue')}</div>}
        </DialogDescription>
        <div className="flex flex-col gap-2 mt-4 text-sm dark:text-zinc-300">
          <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
            <span className="text-zinc-500">{t('amount')}</span>
            <span className="font-bold">{formatMoney(debt.amount, debt.currency)}</span>
          </div>
          <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
            <span className="text-zinc-500">{t('status')}</span>
            <span className={`font-bold uppercase ${isOverdue ? 'text-red-500' : ''}`}>{displayStatus}</span>
          </div>
          <div className="flex justify-between border-b dark:border-zinc-800 pb-2">
            <span className="text-zinc-500">{t('due_date')}</span>
            <span className={`font-bold ${isOverdue ? 'text-red-500' : ''}`}>{formatDate(debt.due_date)}</span>
          </div>
          {debt.note && (
            <div className="flex flex-col gap-1 pt-2">
              <span className="text-zinc-500">{t('note')}</span>
              <span className="font-medium bg-zinc-50 dark:bg-zinc-900 p-2 border dark:border-zinc-800 rounded-lg">{debt.note}</span>
            </div>
          )}

          {/* Trust score for the other party */}
          {isGiven && debt.receiver_id && <TrustScorePreview userId={debt.receiver_id} t={t} />}

          {/* QR for pending debts */}
          {isGiven && debt.status === 'pending' && (
            <div className="mt-6 flex flex-col items-center">
              <span className="text-xs text-zinc-500 mb-2 font-medium text-center">{t('show_this_qr')}</span>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200">
                <QRCode value={debt.qr_token ? `QRZ:${debt.qr_token}` : `DEBT:${debt.id}`} size={150} />
              </div>
            </div>
          )}

          {/* Payment section for receiver */}
          {!isGiven && (debt.status === 'active' || debt.status === 'overdue') && (
            <PaymentSection debt={debt} t={t} />
          )}

          {/* Approve section for giver */}
          {isGiven && debt.status === 'verifying' && <ApproveSection debt={debt} t={t} />}

          {/* Forgive debt */}
          {isGiven && (debt.status === 'active' || debt.status === 'overdue') && (
            <Button variant="outline" className="mt-4 w-full border-indigo-200 text-indigo-600 font-bold" onClick={async () => {
              try {
                await apiCall(`/api/debts/${debt.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'forgiven' }) });
                hapticSuccess();
                toast.success(t('debt_forgiven'));
              } catch { toast.error('Failed'); }
            }}>{t('forgive_debt')}</Button>
          )}

          {/* Mark as paid */}
          {isGiven && (debt.status === 'active' || debt.status === 'overdue') && (
            <Button variant="outline" className="mt-2 w-full border-green-200 text-green-600 font-bold" onClick={async () => {
              try {
                await apiCall(`/api/debts/${debt.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) });
                hapticSuccess();
                toast.success(t('marked_as_paid'));
              } catch { toast.error('Failed'); }
            }}>{t('mark_paid')}</Button>
          )}

          {/* Delete pending debt */}
          {debt.status === 'pending' && (
            <Button variant="destructive" className="mt-4 w-full font-bold" onClick={async () => {
              try {
                await apiCall(`/api/debts/${debt.id}`, { method: 'DELETE' });
                hapticSuccess();
                toast.success(t('debt_deleted'));
              } catch { toast.error('Failed'); }
            }}>{t('delete_debt')}</Button>
          )}

          {/* Waiting for giver approval */}
          {!isGiven && debt.status === 'verifying' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm rounded-lg text-center font-medium">
              {t('waiting_for_giver')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const Debts = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [given, setGiven] = useState<any[]>([]);
  const [taken, setTaken] = useState<any[]>([]);
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'given' | 'taken'>('given');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const data = await apiCall('/api/debts');
        setGiven(data.given || []);
        setTaken(data.taken || []);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [user]);

  const currencies = ['ALL', 'UZS', 'USD', 'RUB', 'KRW', 'EUR'];
  const hiddenStatuses = ['paid', 'forgiven', 'rejected'];
  const activeGiven = given.filter(d => !hiddenStatuses.includes(d.status));
  const activeTaken = taken.filter(d => !hiddenStatuses.includes(d.status));
  const fGiven = filterCurrency === 'ALL' ? activeGiven : activeGiven.filter(d => (d.currency || 'UZS') === filterCurrency);
  const fTaken = filterCurrency === 'ALL' ? activeTaken : activeTaken.filter(d => (d.currency || 'UZS') === filterCurrency);
  const activeList = activeTab === 'given' ? fGiven : fTaken;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 mt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
            <ChevronLeft size={24} className="text-zinc-600 dark:text-zinc-300" />
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t('records')}</h1>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
        {currencies.map(c => (
          <button key={c} onClick={() => { setFilterCurrency(c); hapticFeedback(); }}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filterCurrency === c ? 'bg-indigo-600 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
            }`}>{c}</button>
        ))}
      </div>

      <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 mb-6">
        <button onClick={() => { setActiveTab('given'); hapticFeedback(); }}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'given' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {t('to_receive')}
        </button>
        <button onClick={() => { setActiveTab('taken'); hapticFeedback(); }}
          className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'taken' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {t('to_pay')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
      ) : activeList.length === 0 ? (
        <div className="text-center text-zinc-400 py-16 flex flex-col items-center gap-2">
          <span className="text-4xl">📭</span>
          <span className="text-sm">{t('no_records_found')}</span>
        </div>
      ) : (
        activeList.map(d => <DebtItem key={d.id} debt={d} isGiven={activeTab === 'given'} t={t} />)
      )}
    </div>
  );
};

