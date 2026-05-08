import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticSuccess, hapticFeedback } from '@/src/lib/telegram';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatDate } from '@/lib/utils';

export const Scanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [debtInfo, setDebtInfo] = useState<any>(null);
  const [scannedUser, setScannedUser] = useState<any>(null);
  const [scannedToken, setScannedToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let mounted = true;

    try {
      html5QrCode = new Html5Qrcode('reader');
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          if (!mounted) return;
          try { await html5QrCode?.pause(); } catch {}
          hapticFeedback();

          try {
            if (decodedText.startsWith('QRZ:')) {
              // Debt QR token
              const token = decodedText.replace('QRZ:', '');
              setScannedToken(token);
              const data = await apiCall(`/api/debts/scan/${token}`);
              if (data && mounted) setDebtInfo(data);
              else { toast.error('QR kod topilmadi'); html5QrCode?.resume(); }

            } else if (decodedText.startsWith('PAY:')) {
              // Payment confirmation QR
              const token = decodedText.replace('PAY:', '');
              setScannedToken(token);
              setLoading(true);
              try {
                await apiCall(`/api/debts/payment/${token}/confirm`, { method: 'POST' });
                hapticSuccess();
                setConfirmed(true);
                toast.success('To\'lov tasdiqlandi! ✅');
              } catch (err: any) {
                toast.error(err.message || 'Xatolik');
                html5QrCode?.resume();
              } finally { setLoading(false); }

            } else if (decodedText.startsWith('USER:')) {
              const uId = decodedText.replace('USER:', '');
              const data = await apiCall(`/api/users/${uId}`);
              if (data && mounted) setScannedUser(data);
              else { toast.error('Foydalanuvchi topilmadi'); html5QrCode?.resume(); }

            } else {
              toast.error('Noto\'g\'ri QR kod');
              html5QrCode?.resume();
            }
          } catch (e: any) {
            if (mounted) { toast.error(e.message || 'QR xatolik'); html5QrCode?.resume(); }
          }
        },
        () => {}
      ).catch(() => {
        if (mounted) toast.error(t('camera_error'));
      });
    } catch {}

    return () => {
      mounted = false;
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
      }
    };
  }, []);

  const handleConfirmDebt = async () => {
    if (!scannedToken) return;
    setLoading(true);
    try {
      await apiCall(`/api/debts/scan/${scannedToken}/confirm`, { method: 'POST' });
      hapticSuccess();
      setConfirmed(true);
      toast.success('Qarz tasdiqlandi! ✅');
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    } finally { setLoading(false); }
  };

  // Success screen
  if (confirmed) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Tasdiqlandi!</h2>
          <p className="text-zinc-500 mb-8">Qarz muvaffaqiyatli ro'yxatdan o'tdi</p>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/debts')}>
            Qarzlarimga o'tish →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t('scan_code')}</h1>

      {/* Camera */}
      {!debtInfo && !scannedUser && (
        <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800 bg-black flex items-center justify-center relative">
          <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&#reader__dashboard_section_csr]:hidden border-none text-white absolute inset-0"></div>
        </div>
      )}

      {/* User scanned */}
      {scannedUser && (
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 text-center">
          <h2 className="text-xl font-bold mb-2">{scannedUser.name}</h2>
          <p className="text-zinc-500 mb-2">{t('score')}: <strong>{scannedUser.score || 0}</strong></p>
          <div className="flex flex-col gap-3 mt-6">
            <Button size="lg" className="h-14 text-lg rounded-xl w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={() => navigate(`/add?receiverId=${scannedUser.id}&name=${encodeURIComponent(scannedUser.name)}`)}>
              {t('give_debt')}
            </Button>
            <Button size="lg" variant="outline" className="h-14 text-lg rounded-xl w-full border-indigo-200 text-indigo-600"
              onClick={() => navigate(`/profile?sendTo=${scannedUser.id}`)}>
              {t('send_money')}
            </Button>
            <Button size="lg" variant="ghost" className="h-14 rounded-xl w-full" onClick={() => window.location.reload()}>
              {t('back')}
            </Button>
          </div>
        </div>
      )}

      {/* Debt QR scanned — show debt info and confirm button */}
      {debtInfo && (
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-center mb-4">
            {debtInfo.giver_id ? '📥 Qarz so\'rovi' : '📤 Qarz berish so\'rovi'}
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-4 flex flex-col gap-2">
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Summa</span>
              <span className="font-bold text-lg">{debtInfo.amount?.toLocaleString()} {debtInfo.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500 text-sm">Muddat</span>
              <span className="font-bold">{formatDate(debtInfo.due_date)}</span>
            </div>
            {debtInfo.note && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Izoh</span>
                <span className="font-medium text-right">{debtInfo.note}</span>
              </div>
            )}
            {debtInfo.giver && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Kimdan</span>
                <span className="font-bold">{(debtInfo.giver as any)?.name || '?'}</span>
              </div>
            )}
            {debtInfo.receiver && (
              <div className="flex justify-between">
                <span className="text-zinc-500 text-sm">Kimga</span>
                <span className="font-bold">{(debtInfo.receiver as any)?.name || debtInfo.receiver_name || '?'}</span>
              </div>
            )}
          </div>

          {/* If giver exists but no receiver → I become receiver (qarz olaman) */}
          {debtInfo.giver_id && !debtInfo.receiver_id && (
            <>
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">⚠️ {t('service_fee_note')}</p>
              </div>
              <p className="text-sm text-zinc-500 text-center mb-4">Tasdiqlasangiz, siz qarz olgan bo'lasiz</p>
            </>
          )}

          {/* If receiver exists but no giver → I become giver (qarz beraman) */}
          {debtInfo.receiver_id && !debtInfo.giver_id && (
            <p className="text-sm text-zinc-500 text-center mb-4">Tasdiqlasangiz, siz qarz bergan bo'lasiz</p>
          )}

          <div className="flex flex-col gap-3">
            <Button size="lg" className="h-14 text-lg rounded-xl bg-indigo-600 text-white w-full"
              onClick={handleConfirmDebt} disabled={loading}>
              {loading ? '⏳ Kuting...' : '✅ Tasdiqlash'}
            </Button>
            <Button size="lg" variant="outline" className="h-14 text-lg rounded-xl w-full"
              onClick={() => navigate('/')} disabled={loading}>
              ❌ {t('reject')}
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-400 mt-6 text-center max-w-xs">
        QR kodni ko'rsating yoki skanerlang. Har bir QR kod faqat 1 marta ishlatiladi.
      </p>
    </div>
  );
};
