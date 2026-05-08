import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticSuccess } from '@/src/lib/telegram';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export const Scanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [debtData, setDebtData] = useState<any>(null);
  const [scannedUser, setScannedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

          try {
            if (decodedText.startsWith('USER:')) {
              const uId = decodedText.replace('USER:', '');
              const data = await apiCall(`/api/users/${uId}`);
              if (data && mounted) setScannedUser(data);
              else if (mounted) { toast.error('User not found'); html5QrCode?.resume(); }
            } else if (decodedText.startsWith('DEBT:')) {
              const dId = decodedText.replace('DEBT:', '');
              // For debts, we need to fetch via the general API
              const debtsData = await apiCall('/api/debts');
              const allDebts = [...(debtsData.given || []), ...(debtsData.taken || [])];
              const found = allDebts.find((d: any) => d.id === dId);
              if (!found) {
                // Try direct fetch approach
                toast.error('Debt not found in your records');
                html5QrCode?.resume();
              } else if (mounted) {
                setDebtData(found);
              }
            } else if (mounted) {
              toast.error('Invalid QR code');
              html5QrCode?.resume();
            }
          } catch (e) {
            if (mounted) { toast.error('Error processing QR'); html5QrCode?.resume(); }
          }
        },
        () => {}
      ).catch(() => {
        if (mounted) toast.error(t('camera_error', 'Kamera xatoligi'));
      });
    } catch {}

    return () => {
      mounted = false;
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {});
      }
    };
  }, []);

  const handleConfirmDebt = async (role: 'receiver' | 'giver') => {
    if (!debtData || !user) return;
    setLoading(true);
    try {
      await apiCall(`/api/debts/${debtData.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      hapticSuccess();
      toast.success(t('confirm') + ' ✅');
      navigate('/debts');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">{t('scan_code')}</h1>

      {!debtData && !scannedUser && (
        <div className="w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800 bg-black flex items-center justify-center relative">
          <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full [&_#reader__dashboard_section_csr]:hidden border-none text-white absolute inset-0"></div>
        </div>
      )}

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
              {t('back', 'Orqaga')}
            </Button>
          </div>
        </div>
      )}

      {debtData && debtData.giver_id && !debtData.receiver_id && (
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border text-center">
          <h2 className="text-xl font-bold mb-2">{t('debt_request')}</h2>
          <p className="text-zinc-500 mb-6">{t('someone_gave_you')} <strong>{debtData.amount.toLocaleString()} {debtData.currency}</strong></p>
          <p className="text-amber-500 font-medium text-sm mb-4">{t('service_fee_note')}</p>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="h-14 text-lg rounded-xl bg-indigo-600 text-white w-full" onClick={() => handleConfirmDebt('receiver')} disabled={loading}>
              {loading ? '...' : t('confirm')}
            </Button>
            <Button size="lg" variant="outline" className="h-14 text-lg rounded-xl w-full" onClick={() => navigate('/')} disabled={loading}>
              {t('reject')}
            </Button>
          </div>
        </div>
      )}

      {debtData && !debtData.giver_id && debtData.receiver_id && (
        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-xl border text-center">
          <h2 className="text-xl font-bold mb-2">{t('debt_requested')}</h2>
          <p className="text-zinc-500 mb-6">{t('they_want_from_you')} <strong>{debtData.amount.toLocaleString()} {debtData.currency}</strong></p>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="h-14 text-lg rounded-xl bg-indigo-600 text-white w-full" onClick={() => handleConfirmDebt('giver')} disabled={loading}>
              {loading ? '...' : t('confirm')}
            </Button>
            <Button size="lg" variant="outline" className="h-14 text-lg rounded-xl w-full" onClick={() => navigate('/')} disabled={loading}>
              {t('reject')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
