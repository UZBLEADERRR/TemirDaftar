import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, CreditCard, LogOut, ShieldCheck, ScanLine, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

export const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<string[]>([]);
  const [newCard, setNewCard] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [showTopup, setShowTopup] = useState(false);
  const [topupUrl, setTopupUrl] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [showP2p, setShowP2p] = useState(false);
  const [p2pUserId, setP2pUserId] = useState('');
  const [p2pAmount, setP2pAmount] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'score'>('wallet');
  const [scoreDetails, setScoreDetails] = useState({ given: 0, returned: 0, late: 0 });
  const [calculatedScore, setCalculatedScore] = useState(0);
  const [cardType, setCardType] = useState('uzcard');
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCards(user.cards || []);
    setWalletBalance(user.wallet_balance || 0);
    setCalculatedScore(user.score || 0);
    setEditName(user.name || '');

    // Fetch score details
    apiCall(`/api/users/${user.id}/trust`).then(trust => {
      setScoreDetails({
        given: (trust.givenToOthers || 0) * 5,
        returned: (trust.paidOnTime || 0) * 10,
        late: -(trust.overdue || 0) * 5,
      });
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const sendTo = sp.get('sendTo');
    if (sendTo) {
      setActiveTab('wallet');
      setShowP2p(true);
      setShowTopup(false);
      setP2pUserId(sendTo);
      navigate('/profile', { replace: true });
    }
  }, [location.search]);

  const handleAddCard = async () => {
    if (!newCard || !user) return;
    const cardLabel = `[${cardType.toUpperCase()}] ${newCard}`;
    const updated = [...cards, cardLabel];
    try {
      await apiCall('/api/me/cards', { method: 'PATCH', body: JSON.stringify({ cards: updated }) });
      setCards(updated);
      setNewCard('');
      hapticSuccess();
      toast.success(t('card_added', 'Karta qo\'shildi'));
    } catch { toast.error('Error'); }
  };

  const handleSaveName = async () => {
    if (!editName.trim() || !user) return;
    setSavingName(true);
    try {
      await apiCall('/api/me/name', { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) });
      hapticSuccess();
      toast.success('Ism saqlandi');
      refreshUser();
    } catch { toast.error('Xatolik'); }
    finally { setSavingName(false); }
  };

  const handleRemoveCard = async (idx: number) => {
    const updated = cards.filter((_, i) => i !== idx);
    try {
      await apiCall('/api/me/cards', { method: 'PATCH', body: JSON.stringify({ cards: updated }) });
      setCards(updated);
    } catch { toast.error('Error'); }
  };

  const handleTopup = async () => {
    if (Number(topupAmount) < 10000) { toast.error(t('min_topup')); return; }
    if (!topupUrl) { toast.error(t('receipt_required')); return; }
    try {
      await apiCall('/api/wallet/topup', { method: 'POST', body: JSON.stringify({ amount: Number(topupAmount), receiptUrl: topupUrl }) });
      hapticSuccess();
      toast.success(t('topup_sent'));
      setShowTopup(false);
      setTopupUrl('');
      setTopupAmount('');
    } catch { toast.error(t('topup_error')); }
  };

  const handleP2p = async () => {
    if (!p2pUserId || !p2pAmount || Number(p2pAmount) <= 0) return;
    try {
      const res = await apiCall('/api/wallet/send', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: p2pUserId, amount: Number(p2pAmount) }),
      });
      hapticSuccess();
      setWalletBalance(res.newBalance);
      toast.success(t('sent_successfully'));
      setShowP2p(false);
      setP2pUserId('');
      setP2pAmount('');
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  };

  const percentage = Math.min(100, Math.max(0, calculatedScore));

  return (
    <div className="p-6 relative">
      <header className="flex justify-between items-center mb-6 mt-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t('profile')}</h1>
        <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <SettingsIcon size={20} className="text-zinc-600 dark:text-zinc-300" />
        </button>
      </header>

      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/30">
          <span className="text-white font-bold text-2xl">{user?.name?.charAt(0) || 'U'}</span>
        </div>
        <h2 className="text-2xl font-bold dark:text-white capitalize">{user?.name}</h2>
        <p className="text-xs text-zinc-500 mt-1">{user?.phone}</p>
        <div className="mt-1 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-xs font-mono text-zinc-500">
          ID: {user?.id?.substring(0, 8).toUpperCase()}
        </div>
      </div>

      <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 mb-6">
        <button onClick={() => setActiveTab('wallet')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === 'wallet' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
          {t('wallet_tools')}
        </button>
        <button onClick={() => setActiveTab('score')} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${activeTab === 'score' ? 'bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>
          {t('trust_score')}
        </button>
      </div>

      {activeTab === 'wallet' && (
        <div className="flex flex-col gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white relative overflow-hidden shadow-lg shadow-indigo-500/20">
            <div className="absolute top-0 right-0 p-4 opacity-20"><ShieldCheck size={80} /></div>
            <span className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">{t('your_balance')}</span>
            <span className="text-3xl font-bold block mb-6">{walletBalance.toLocaleString()} <span className="text-lg font-normal">UZS</span></span>
            <div className="flex gap-3 relative z-10">
              <button onClick={() => { setShowTopup(!showTopup); setShowP2p(false); hapticFeedback(); }} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center transition-colors">{t('topup')}</button>
              <button onClick={() => { setShowP2p(!showP2p); setShowTopup(false); hapticFeedback(); }} className="bg-white text-indigo-600 hover:bg-zinc-100 px-4 py-2 rounded-xl text-sm font-bold flex-1 text-center transition-colors shadow-sm">{t('send')}</button>
            </div>
          </div>

          {showTopup && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col gap-3">
              <h3 className="font-bold border-b pb-2">{t('topup_wallet')}</h3>
              <p className="text-xs text-zinc-500">{t('topup_desc')}</p>
              <Input type="text" inputMode="numeric" value={topupAmount} onChange={e => setTopupAmount(e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, ''))} placeholder={t('amount_min')} className="bg-white dark:bg-zinc-950" />
              <Input type="file" accept="image/*" onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 800000) { toast.error(t('file_too_large')); return; }
                  const reader = new FileReader();
                  reader.onload = () => setTopupUrl(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} className="bg-white dark:bg-zinc-950" />
              <Button onClick={handleTopup} className="w-full bg-indigo-600 hover:bg-indigo-700">{t('submit_approval')}</Button>
            </div>
          )}

          {showP2p && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col gap-3">
              <h3 className="font-bold border-b pb-2">{t('send_money')}</h3>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('receiver_id')}</Label>
                <div className="flex gap-2 w-full">
                  <Input placeholder="UUID..." value={p2pUserId} onChange={e => setP2pUserId(e.target.value)} className="bg-white dark:bg-zinc-950 font-mono text-xs flex-1" />
                  <Button variant="outline" size="icon" onClick={() => navigate('/scan')} className="shrink-0">
                    <ScanLine size={18} />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('amount')}</Label>
                <Input type="text" inputMode="numeric" value={p2pAmount} onChange={e => setP2pAmount(e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, ''))} placeholder="Miqdor" className="bg-white dark:bg-zinc-950" />
              </div>
              <Button onClick={handleP2p} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700" disabled={!p2pUserId || !p2pAmount}>{t('send_funds')}</Button>
            </div>
          )}

          <div className="mt-4 flex flex-col items-center">
            <h3 className="font-bold mb-4">{t('scan_code')}</h3>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 inline-block mb-2">
              {user?.id && <QRCode value={`USER:${user.id}`} size={160} />}
            </div>
            <p className="text-xs text-zinc-500 text-center px-6">{t('scan_code_desc')}</p>
          </div>
        </div>
      )}

      {activeTab === 'score' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center shadow-sm">
            <div className="relative w-32 h-32 mx-auto mb-4 flex flex-col items-center justify-center">
              <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="8" fill="none" />
                <circle cx="50" cy="50" r="45"
                  className={`${percentage > 50 ? 'stroke-green-500' : percentage > 20 ? 'stroke-amber-500' : 'stroke-red-500'} transition-all duration-1000`}
                  strokeWidth="8" fill="none"
                  strokeDasharray={2 * Math.PI * 45}
                  strokeDashoffset={(2 * Math.PI * 45) - (percentage / 100) * (2 * Math.PI * 45)}
                  strokeLinecap="round" />
              </svg>
              <div className="flex flex-col items-center relative z-10">
                <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{calculatedScore}</span>
                <span className="text-[10px] uppercase text-zinc-500 font-bold mt-1 tracking-wider">{t('score_label')}</span>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 flex flex-col gap-3 text-left">
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-medium">{t('ontime_return')}</span>
                <span className="text-sm font-bold text-green-600">+{scoreDetails.returned}</span>
              </div>
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-medium">{t('debt_given')}</span>
                <span className="text-sm font-bold text-indigo-600">+{scoreDetails.given}</span>
              </div>
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-medium">{t('late_return')}</span>
                <span className="text-sm font-bold text-red-600">{scoreDetails.late}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Drawer */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowSettings(false)}>
          <div className="w-80 h-full bg-white dark:bg-zinc-950 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><SettingsIcon size={20} /> {t('settings')}</h2>
              <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-zinc-600 p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-8 pb-10">
              {/* Name editing */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Ism</Label>
                <div className="flex gap-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ismingiz" className="flex-1" />
                  <Button variant="outline" onClick={handleSaveName} disabled={savingName} className="shrink-0">
                    {savingName ? '...' : 'Saqlash'}
                  </Button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">{t('cards')}</Label>
                {cards.map((c, i) => (
                  <div key={i} className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <span className="font-mono text-sm tracking-widest">{c}</span>
                    <button className="text-zinc-400 hover:text-red-500 transition-colors" onClick={() => handleRemoveCard(i)}>✕</button>
                  </div>
                ))}
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex gap-2">
                    <select value={cardType} onChange={e => setCardType(e.target.value)}
                      className="h-10 px-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 dark:text-zinc-100 text-sm font-bold outline-none w-28">
                      <option value="uzcard">UzCard</option>
                      <option value="humo">Humo</option>
                      <option value="visa">Visa</option>
                      <option value="mastercard">MasterCard</option>
                      <option value="mir">Mir</option>
                      <option value="other">Boshqa</option>
                    </select>
                    <Input value={newCard} onChange={e => setNewCard(e.target.value)} placeholder="8600 1234 5678 9012" className="flex-1" />
                  </div>
                  <Button variant="outline" onClick={handleAddCard} className="w-full gap-2"><CreditCard size={16} />{t('add')}</Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">{t('language')}</Label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                  {['uz', 'ru', 'en'].map(lang => (
                    <button key={lang} onClick={() => i18n.changeLanguage(lang)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${i18n.language === lang ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-500'}`}>
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Mavzu</Label>
                <button onClick={toggleTheme}
                  className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <span className="text-sm font-medium">{theme === 'dark' ? '🌙 Tungi rejim' : '☀️ Kunduzgi rejim'}</span>
                  {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
