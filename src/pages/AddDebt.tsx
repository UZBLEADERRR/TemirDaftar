import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, AlertTriangle, CheckCircle2, ShieldCheck, Copy, Check } from 'lucide-react';
import QRCode from 'react-qr-code';

export const AddDebt = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [trustData, setTrustData] = useState<any>(null);
  const [createdDebt, setCreatedDebt] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const rId = searchParams.get('receiverId');
    const rName = searchParams.get('name');
    if (rId) setReceiverId(rId);
    if (rName) setReceiverName(rName);
  }, [searchParams]);

  useEffect(() => {
    if (!receiverId) { setTrustData(null); return; }
    apiCall(`/api/users/${receiverId}/trust`)
      .then(setTrustData)
      .catch(() => setTrustData(null));
  }, [receiverId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    const currency = fd.get('currency') as string;
    const dueDate = fd.get('dueDate') as string;
    const rName = fd.get('receiverName') as string;
    const rPhone = fd.get('receiverPhone') as string;
    const note = fd.get('note') as string;
    const type = searchParams.get('type') || 'gave';

    try {
      const debt = await apiCall('/api/debts', {
        method: 'POST',
        body: JSON.stringify({
          amount, currency, dueDate, receiverName: rName,
          receiverPhone: rPhone, note, type,
          receiverId: receiverId || undefined,
        }),
      });
      hapticSuccess();
      setCreatedDebt(debt);
    } catch (err: any) {
      toast.error(err.message || 'Qarz yaratishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (!createdDebt?.qr_token) return;
    navigator.clipboard.writeText(`QRZ:${createdDebt.qr_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Nusxalandi!');
  };

  const isTaking = searchParams.get('type') === 'took';
  const trustRatio = trustData?.totalDebts > 0 ? Math.round((trustData.paidOnTime / trustData.totalDebts) * 100) : null;

  // Show QR after creation
  if (createdDebt) {
    const qrValue = `QRZ:${createdDebt.qr_token}`;
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">Qarz yaratildi!</h2>
          <p className="text-sm text-zinc-500 mb-6">
            {isTaking ? 'Qarz beruvchiga' : 'Qarz oluvchiga'} bu QR kodni ko'rsating
          </p>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 inline-block mb-4">
            <QRCode value={qrValue} size={200} />
          </div>

          <p className="text-xs text-zinc-400 mb-2">Faqat 1 marta ishlatiladi</p>

          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-500 truncate flex-1">{createdDebt.qr_token?.slice(0, 16)}...</span>
            <button onClick={handleCopyToken} className="ml-2 text-indigo-600">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-6">
            <div><span className="text-[10px] text-zinc-500">Summa</span><p className="font-bold text-sm">{createdDebt.amount?.toLocaleString()} {createdDebt.currency}</p></div>
            <div><span className="text-[10px] text-zinc-500">Muddat</span><p className="font-bold text-sm">{createdDebt.due_date}</p></div>
            {createdDebt.note && <div className="col-span-2"><span className="text-[10px] text-zinc-500">Izoh</span><p className="text-sm">{createdDebt.note}</p></div>}
          </div>

          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/debts')}>
            Qarzlarimga o'tish →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6 mt-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <ChevronLeft size={24} className="text-zinc-600 dark:text-zinc-300" />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {isTaking ? t('i_took') : t('give_debt')}
        </h1>
      </div>

      {!isTaking && trustData && (
        <div className="mb-6 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
          <h3 className="text-xs font-bold uppercase text-zinc-500 mb-3 flex items-center gap-1">
            <ShieldCheck size={14} /> {t('trust_score')}
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><span className="text-xl font-bold text-zinc-900 dark:text-white">{trustData.totalDebts}</span><p className="text-[10px] text-zinc-500">Jami</p></div>
            <div><span className="text-xl font-bold text-green-600">{trustData.paidOnTime}</span><p className="text-[10px] text-zinc-500">To'langan</p></div>
            <div><span className="text-xl font-bold text-red-500">{trustData.overdue}</span><p className="text-[10px] text-zinc-500">Kechikkan</p></div>
            <div><span className={`text-xl font-bold ${trustRatio !== null && trustRatio >= 70 ? 'text-green-500' : trustRatio !== null && trustRatio >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{trustRatio !== null ? `${trustRatio}%` : '-'}</span><p className="text-[10px] text-zinc-500">Ishonch</p></div>
          </div>
          {trustRatio !== null && trustRatio < 50 && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="text-xs text-red-600 dark:text-red-400">Diqqat: bu foydalanuvchining ishonch darajasi past</span>
            </div>
          )}
          {trustRatio !== null && trustRatio >= 70 && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-500 shrink-0" />
              <span className="text-xs text-green-600 dark:text-green-400">Yaxshi: bu foydalanuvchi ishonchli</span>
            </div>
          )}
        </div>
      )}

      {isTaking && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ {t('service_fee_note')}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label className="dark:text-zinc-300">{t('amount')} / {t('currency')}</Label>
          <div className="flex gap-2">
            <Input name="amount" type="number" required placeholder="50000" className="h-12 text-lg rounded-xl dark:bg-zinc-900 flex-1" />
            <select name="currency" className="h-12 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-100 font-bold w-24 outline-none">
              <option value="UZS">UZS</option><option value="USD">USD</option><option value="RUB">RUB</option><option value="KRW">KRW</option><option value="EUR">EUR</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="dark:text-zinc-300">{isTaking ? t('giver_name') : t('receiver_name')}</Label>
          <Input name="receiverName" value={receiverName} onChange={e => setReceiverName(e.target.value)} required placeholder="Ism" className="h-12 rounded-xl dark:bg-zinc-900" />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="dark:text-zinc-300">{t('phone')} (Ixtiyoriy)</Label>
          <Input name="receiverPhone" placeholder="+998 90 123 45 67" className="h-12 rounded-xl dark:bg-zinc-900" />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="dark:text-zinc-300">{t('due_date')}</Label>
          <Input name="dueDate" type="date" required className="h-12 rounded-xl dark:bg-zinc-900" />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="dark:text-zinc-300">{t('note')} (Ixtiyoriy)</Label>
          <Input name="note" placeholder="Oziq-ovqat uchun" className="h-12 rounded-xl dark:bg-zinc-900" />
        </div>

        <Button type="submit" disabled={loading} size="lg"
          className="h-14 mt-6 text-lg rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white w-full border-none shadow-lg shadow-indigo-500/20">
          {loading ? '...' : t('generate_qr')}
        </Button>
      </form>
    </div>
  );
};
