import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticSuccess } from '@/src/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Sun, Moon, Store, Crown, CreditCard } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShopName, setEditShopName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingShopName, setSavingShopName] = useState(false);

  // Score state (only for shopkeepers)
  const [scoreDetails, setScoreDetails] = useState({ given: 0, returned: 0, late: 0 });
  const [calculatedScore, setCalculatedScore] = useState(0);

  // Cards state
  const [cards, setCards] = useState<string[]>([]);
  const [newCard, setNewCard] = useState('');
  const [cardType, setCardType] = useState('uzcard');

  useEffect(() => {
    if (!user) return;
    setEditName(user.name || '');
    setEditShopName(user.shop_name || '');
    setCards(user.cards || []);
    setCalculatedScore(user.score || 0);

    if (user.user_role === 'shopkeeper') {
      apiCall(`/api/users/${user.id}/trust`).then(trust => {
        setScoreDetails({
          given: (trust.givenToOthers || 0) * 5,
          returned: (trust.paidOnTime || 0) * 10,
          late: -(trust.overdue || 0) * 5,
        });
      }).catch(() => {});
    }
  }, [user]);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSavingName(true);
    try {
      await apiCall('/api/me/name', { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) });
      hapticSuccess();
      toast.success('Ism saqlandi');
      refreshUser();
    } catch { toast.error('Xatolik'); }
    finally { setSavingName(false); }
  };

  const handleSaveShopName = async () => {
    if (!editShopName.trim()) return;
    setSavingShopName(true);
    try {
      await apiCall('/api/me/shop-name', { method: 'PATCH', body: JSON.stringify({ shopName: editShopName.trim() }) });
      hapticSuccess();
      toast.success('Do\'kon nomi saqlandi');
      refreshUser();
    } catch { toast.error('Xatolik'); }
    finally { setSavingShopName(false); }
  };

  const handleAddCard = async () => {
    if (!newCard || !user) return;
    const cardLabel = `[${cardType.toUpperCase()}] ${newCard}`;
    const updated = [...cards, cardLabel];
    try {
      await apiCall('/api/me/cards', { method: 'PATCH', body: JSON.stringify({ cards: updated }) });
      setCards(updated);
      setNewCard('');
      hapticSuccess();
      toast.success('Karta qo\'shildi');
    } catch { toast.error('Xatolik'); }
  };

  const handleRemoveCard = async (idx: number) => {
    const updated = cards.filter((_, i) => i !== idx);
    try {
      await apiCall('/api/me/cards', { method: 'PATCH', body: JSON.stringify({ cards: updated }) });
      setCards(updated);
    } catch { toast.error('Xatolik'); }
  };

  const isShopkeeper = user?.user_role === 'shopkeeper';
  const percentage = Math.min(100, Math.max(0, calculatedScore));

  // Subscription info
  const getSubscriptionLabel = () => {
    if (!user) return '';
    if (user.subscription_status === 'trial') {
      const trialEnd = new Date(new Date(user.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000);
      const remaining = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      return `🎁 Bepul sinov (${remaining} kun qoldi)`;
    }
    if (user.subscription_status === 'active') {
      const expires = user.subscription_expires_at ? new Date(user.subscription_expires_at).toLocaleDateString('uz-UZ') : '';
      return `✅ Faol${expires ? ` (${expires} gacha)` : ''}`;
    }
    return '⚠️ Muddati tugagan';
  };

  return (
    <div className="p-5 relative">
      <header className="flex justify-between items-center mb-6 mt-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Profil</h1>
        <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <SettingsIcon size={20} className="text-zinc-600 dark:text-zinc-300" />
        </button>
      </header>

      {/* Avatar & Info */}
      <div className="flex flex-col items-center mb-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 shadow-lg ${
          isShopkeeper
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
        }`}>
          <span className="text-white font-bold text-2xl">{user?.name?.charAt(0) || 'U'}</span>
        </div>
        <h2 className="text-2xl font-bold dark:text-white capitalize">{user?.name}</h2>
        {isShopkeeper && user?.shop_name && (
          <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
            <Store size={14} /> {user.shop_name}
          </p>
        )}
        <p className="text-xs text-zinc-500 mt-1">{user?.phone}</p>
        <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${
          isShopkeeper ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}>
          {isShopkeeper ? '🏪 Do\'konchi' : '👤 Mijoz'}
        </span>
      </div>

      {/* Subscription (shopkeeper only) */}
      {isShopkeeper && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Crown size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Obuna</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{getSubscriptionLabel()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Score (shopkeeper only) */}
      {isShopkeeper && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center shadow-sm mb-4">
          <div className="relative w-28 h-28 mx-auto mb-4 flex flex-col items-center justify-center">
            <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="8" fill="none" />
              <circle cx="50" cy="50" r="45"
                className={`${percentage > 50 ? 'stroke-emerald-500' : percentage > 20 ? 'stroke-amber-500' : 'stroke-red-500'} transition-all duration-1000`}
                strokeWidth="8" fill="none"
                strokeDasharray={2 * Math.PI * 45}
                strokeDashoffset={(2 * Math.PI * 45) - (percentage / 100) * (2 * Math.PI * 45)}
                strokeLinecap="round" />
            </svg>
            <div className="flex flex-col items-center relative z-10">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{calculatedScore}</span>
              <span className="text-[10px] uppercase text-zinc-500 font-bold mt-1 tracking-wider">Ball</span>
            </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-3 flex flex-col gap-2 text-left">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-medium">Vaqtida qaytargan</span>
              <span className="text-xs font-bold text-emerald-600">+{scoreDetails.returned}</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-medium">Qarz bergan</span>
              <span className="text-xs font-bold text-blue-600">+{scoreDetails.given}</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-medium">Kechiktirilgan</span>
              <span className="text-xs font-bold text-red-600">{scoreDetails.late}</span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Drawer */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowSettings(false)}>
          <div className="w-80 h-full bg-white dark:bg-zinc-950 p-6 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8 border-b pb-4">
              <h2 className="text-xl font-bold flex items-center gap-2"><SettingsIcon size={20} /> Sozlamalar</h2>
              <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-zinc-600 p-2">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-8 pb-10">
              {/* Name */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Ism</Label>
                <div className="flex gap-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ismingiz" className="flex-1" />
                  <Button variant="outline" onClick={handleSaveName} disabled={savingName} className="shrink-0">
                    {savingName ? '...' : 'Saqlash'}
                  </Button>
                </div>
              </div>

              {/* Shop name (shopkeeper only) */}
              {isShopkeeper && (
                <div className="flex flex-col gap-3">
                  <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Do'kon nomi</Label>
                  <div className="flex gap-2">
                    <Input value={editShopName} onChange={e => setEditShopName(e.target.value)} placeholder="Do'kon nomi" className="flex-1" />
                    <Button variant="outline" onClick={handleSaveShopName} disabled={savingShopName} className="shrink-0">
                      {savingShopName ? '...' : 'Saqlash'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Cards */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Kartalar</Label>
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
                    </select>
                    <Input value={newCard} onChange={e => setNewCard(e.target.value)} placeholder="8600 1234 5678 9012" className="flex-1" />
                  </div>
                  <Button variant="outline" onClick={handleAddCard} className="w-full gap-2"><CreditCard size={16} /> Qo'shish</Button>
                </div>
              </div>

              {/* Language */}
              <div className="flex flex-col gap-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Til</Label>
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                  {['uz', 'ru', 'en'].map(lang => (
                    <button key={lang} onClick={() => i18n.changeLanguage(lang)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${i18n.language === lang ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'text-zinc-500'}`}>
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme */}
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
