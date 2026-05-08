import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, DollarSign, FileText, MapPin, RefreshCw, Minus, Navigation } from 'lucide-react';
import { formatMoney, formatDate, timeAgo } from '@/lib/utils';

type Tab = 'dashboard' | 'users' | 'topups' | 'recover' | 'distance';

export const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingTopups, setPendingTopups] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [userDebts, setUserDebts] = useState<{ asReceiver: any[]; asGiver: any[] }>({ asReceiver: [], asGiver: [] });
  const [loading, setLoading] = useState(false);

  // Recovery form
  const [oldTgId, setOldTgId] = useState('');
  const [newTgId, setNewTgId] = useState('');

  // Deduct form
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');

  // Add money form
  const [addAmount, setAddAmount] = useState('');
  const [addReason, setAddReason] = useState('');

  // Trust score
  const [trustScore, setTrustScore] = useState<any>(null);

  // Distance form
  const [distUser1, setDistUser1] = useState('');
  const [distUser2, setDistUser2] = useState('');
  const [distResult, setDistResult] = useState<any>(null);

  if (!user?.is_admin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-screen">
        <p className="text-red-500 font-bold">⛔ Admin ruxsati yo'q</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Asosiy sahifaga</Button>
      </div>
    );
  }

  const fetchStats = async () => {
    try {
      const data = await apiCall('/api/admin/stats');
      setStats(data);
    } catch {}
  };

  const fetchUsers = async () => {
    try {
      const data = await apiCall('/api/admin/users');
      setUsers(data);
    } catch {}
  };

  const fetchPendingTopups = async () => {
    try {
      const data = await apiCall('/api/admin/topups/pending');
      setPendingTopups(data);
    } catch {}
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      const data = await apiCall(`/api/admin/users/${userId}`);
      setSelectedUser(data.user);
      setUserLocations(data.locations || []);
      setUserDebts({ asReceiver: data.debtsAsReceiver || [], asGiver: data.debtsAsGiver || [] });
      // Fetch trust score
      try {
        const trust = await apiCall(`/api/users/${userId}/trust`);
        setTrustScore(trust);
      } catch { setTrustScore(null); }
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchPendingTopups();
  }, []);

  const handleApproveTopup = async (txId: string) => {
    try {
      await apiCall(`/api/admin/topup/approve/${txId}`, { method: 'POST' });
      hapticSuccess();
      toast.success('✅ Tasdiqlandi');
      fetchPendingTopups();
      fetchStats();
    } catch { toast.error('Xatolik'); }
  };

  const handleRejectTopup = async (txId: string) => {
    try {
      await apiCall(`/api/admin/topup/reject/${txId}`, { method: 'POST' });
      toast.success('❌ Rad etildi');
      fetchPendingTopups();
    } catch { toast.error('Xatolik'); }
  };

  const handleDeduct = async (userId: string) => {
    if (!deductAmount || Number(deductAmount) <= 0) return;
    try {
      await apiCall(`/api/admin/deduct/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(deductAmount), reason: deductReason }),
      });
      hapticSuccess();
      toast.success('Pul yechildi');
      setDeductAmount('');
      setDeductReason('');
      fetchUserDetails(userId);
    } catch { toast.error('Xatolik'); }
  };

  const handleAddMoney = async (userId: string) => {
    if (!addAmount || Number(addAmount) <= 0) return;
    try {
      await apiCall(`/api/admin/add-money/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(addAmount), reason: addReason }),
      });
      hapticSuccess();
      toast.success('Pul qo\'shildi');
      setAddAmount('');
      setAddReason('');
      fetchUserDetails(userId);
    } catch { toast.error('Xatolik'); }
  };

  const handleRecover = async () => {
    if (!oldTgId || !newTgId) return;
    setLoading(true);
    try {
      const res = await apiCall('/api/admin/recover-account', {
        method: 'POST',
        body: JSON.stringify({ oldTelegramId: Number(oldTgId), newTelegramId: Number(newTgId) }),
      });
      hapticSuccess();
      toast.success(res.message || 'Akkaunt tiklandi');
      setOldTgId('');
      setNewTgId('');
    } catch (err: any) { toast.error(err.message || 'Xatolik'); }
    finally { setLoading(false); }
  };

  const handleDistance = async () => {
    if (!distUser1 || !distUser2) return;
    try {
      const data = await apiCall(`/api/admin/distance?user1=${distUser1}&user2=${distUser2}`);
      setDistResult(data);
    } catch (err: any) { toast.error(err.message || 'Joylashuv topilmadi'); }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: '📊 Dashboard', icon: DollarSign },
    { id: 'users', label: '👥 Users', icon: Users },
    { id: 'topups', label: '💰 To\'lovlar', icon: FileText },
    { id: 'recover', label: '🔄 Tiklash', icon: RefreshCw },
    { id: 'distance', label: '📍 Masofa', icon: Navigation },
  ];

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-3 mb-4 mt-2">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">🛡️ Admin Panel</h1>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 no-scrollbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedUser(null); hapticFeedback(); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Foydalanuvchilar" value={stats.users} color="indigo" />
          <StatCard label="Aktiv qarzlar" value={stats.activeDebts} color="amber" />
          <StatCard label="To'langan" value={stats.paidDebts} color="green" />
          <StatCard label="Kutilayotgan topup" value={stats.pendingTopups} color="red" />
          <StatCard label="Fee daromadi" value={`${(stats.totalFeeRevenue || 0).toLocaleString()} UZS`} color="purple" wide />
          <StatCard label="Jami topup" value={`${(stats.totalTopups || 0).toLocaleString()} UZS`} color="blue" wide />
        </div>
      )}

      {/* Users */}
      {tab === 'users' && !selectedUser && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500 mb-2">{users.length} ta foydalanuvchi</p>
          {users.map(u => (
            <button key={u.id} onClick={() => fetchUserDetails(u.id)}
              className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-left w-full active:scale-[0.98] transition-transform">
              <div>
                <p className="font-bold text-sm">{u.name || 'Nomsiz'}</p>
                <p className="text-xs text-zinc-500">{u.phone || 'Tel yo\'q'} • TG: {u.telegram_id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-indigo-600">{(u.wallet_balance || 0).toLocaleString()}</p>
                <p className="text-[10px] text-zinc-400">⭐ {u.score || 0}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* User Detail */}
      {tab === 'users' && selectedUser && (
        <div className="flex flex-col gap-4">
          <button onClick={() => setSelectedUser(null)} className="text-indigo-600 text-sm font-bold self-start">← Orqaga</button>

          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
            <h3 className="font-bold text-lg">{selectedUser.name}</h3>
            <p className="text-sm text-zinc-500">📱 {selectedUser.phone}</p>
            <p className="text-sm text-zinc-500">🆔 TG: {selectedUser.telegram_id}</p>
            <p className="text-sm text-zinc-500">💰 Balans: {(selectedUser.wallet_balance || 0).toLocaleString()} UZS</p>
            <p className="text-sm text-zinc-500">⭐ Ball: {selectedUser.score || 0}</p>
            <p className="text-sm text-zinc-500">📅 Ro'yxat: {formatDate(selectedUser.created_at)}</p>
            {selectedUser.cards?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-zinc-500 font-bold">Kartalar:</p>
                {selectedUser.cards.map((c: string, i: number) => <p key={i} className="font-mono text-xs">{c}</p>)}
              </div>
            )}
          </div>

          {/* Deduct money */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <h4 className="font-bold text-sm text-red-700 dark:text-red-400 mb-2">💸 Pul yechish</h4>
            <Input type="text" inputMode="numeric" value={deductAmount} onChange={e => setDeductAmount(e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '')} placeholder="Miqdor" className="mb-2" />
            <Input value={deductReason} onChange={e => setDeductReason(e.target.value)} placeholder="Sabab" className="mb-2" />
            <Button variant="destructive" className="w-full" onClick={() => handleDeduct(selectedUser.id)} disabled={!deductAmount}>Yechish</Button>
          </div>

          {/* Add money */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <h4 className="font-bold text-sm text-green-700 dark:text-green-400 mb-2">💰 Pul qo'shish</h4>
            <Input type="text" inputMode="numeric" value={addAmount} onChange={e => setAddAmount(e.target.value.replace(/[^0-9]/g, '').replace(/^0+/, '') || '')} placeholder="Miqdor" className="mb-2" />
            <Input value={addReason} onChange={e => setAddReason(e.target.value)} placeholder="Sabab" className="mb-2" />
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleAddMoney(selectedUser.id)} disabled={!addAmount}>Qo'shish</Button>
          </div>

          {/* Trust Score */}
          {trustScore && (
            <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
              <h4 className="font-bold text-sm mb-3">⭐ Ishonch reytingi</h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><span className="text-xl font-bold">{trustScore.totalDebts}</span><p className="text-[10px] text-zinc-500">Jami</p></div>
                <div><span className="text-xl font-bold text-green-600">{trustScore.paidOnTime}</span><p className="text-[10px] text-zinc-500">To'langan</p></div>
                <div><span className="text-xl font-bold text-red-500">{trustScore.overdue}</span><p className="text-[10px] text-zinc-500">Kechikkan</p></div>
                <div><span className="text-xl font-bold text-indigo-600">{trustScore.givenToOthers}</span><p className="text-[10px] text-zinc-500">Bergan</p></div>
              </div>
            </div>
          )}

          {/* Locations */}
          {userLocations.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-1"><MapPin size={14} /> Joylashuv tarixi ({userLocations.length})</h4>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                {userLocations.map((loc: any) => (
                  <div key={loc.id} className="text-xs bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg">
                    <p className="font-mono">📍 {loc.lat?.toFixed(4)}, {loc.lng?.toFixed(4)}</p>
                    {loc.address && <p className="text-zinc-500 truncate">{loc.address}</p>}
                    <p className="text-zinc-400">{loc.ip} • {timeAgo(loc.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debts */}
          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
            <h4 className="font-bold text-sm mb-2">Qarzlar</h4>
            <p className="text-xs text-zinc-500 mb-1">Olgan: {userDebts.asReceiver.length} | Bergan: {userDebts.asGiver.length}</p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {[...userDebts.asReceiver, ...userDebts.asGiver].slice(0, 10).map((d: any) => (
                <div key={d.id} className="text-xs flex justify-between bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                  <span>{formatMoney(d.amount, d.currency)}</span>
                  <span className={`font-bold uppercase ${d.status === 'paid' ? 'text-green-600' : d.status === 'overdue' ? 'text-red-500' : 'text-zinc-500'}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Topups */}
      {tab === 'topups' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-zinc-500 mb-1">{pendingTopups.length} ta kutilayotgan topup</p>
          {pendingTopups.length === 0 ? (
            <p className="text-center text-zinc-400 py-10">Kutilayotgan topup yo'q</p>
          ) : pendingTopups.map(tx => (
            <div key={tx.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <div>
                  <p className="font-bold">{tx.user?.name || '?'}</p>
                  <p className="text-xs text-zinc-500">{tx.user?.phone} • TG: {tx.user?.telegram_id}</p>
                </div>
                <p className="font-bold text-lg text-indigo-600">{tx.amount.toLocaleString()}</p>
              </div>
              {tx.receipt_url && (
                tx.receipt_url.startsWith('data:image') ?
                  <img src={tx.receipt_url} alt="Receipt" className="rounded-lg border max-h-32 object-contain mb-2 w-full" /> :
                  <a href={tx.receipt_url} target="_blank" className="text-indigo-500 underline text-xs mb-2 block">Kvitansiya</a>
              )}
              <p className="text-[10px] text-zinc-400 mb-3">{timeAgo(tx.created_at)}</p>
              <div className="flex gap-2">
                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleApproveTopup(tx.id)}>✅ Tasdiqlash</Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleRejectTopup(tx.id)}>❌ Rad</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Recovery */}
      {tab === 'recover' && (
        <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4 flex flex-col gap-4">
          <h3 className="font-bold text-lg">🔄 Akkaunt tiklash</h3>
          <p className="text-xs text-zinc-500">O'chirilgan Telegram akkauntning ma'lumotlarini yangi akkauntga o'tkazish</p>
          <div>
            <Label className="text-xs">Eski Telegram ID</Label>
            <Input type="number" value={oldTgId} onChange={e => setOldTgId(e.target.value)} placeholder="123456789" />
          </div>
          <div>
            <Label className="text-xs">Yangi Telegram ID</Label>
            <Input type="number" value={newTgId} onChange={e => setNewTgId(e.target.value)} placeholder="987654321" />
          </div>
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleRecover} disabled={loading || !oldTgId || !newTgId}>
            {loading ? '...' : '🔄 Tiklash'}
          </Button>
        </div>
      )}

      {/* Distance */}
      {tab === 'distance' && (
        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-bold text-lg">📍 Masofani aniqlash</h3>
            <p className="text-xs text-zinc-500">Ikki foydalanuvchining oxirgi joylashuvi orasidagi masofani hisoblash</p>
            <div>
              <Label className="text-xs">1-foydalanuvchi ID</Label>
              <select value={distUser1} onChange={e => setDistUser1(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm">
                <option value="">Tanlang...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">2-foydalanuvchi ID</Label>
              <select value={distUser2} onChange={e => setDistUser2(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm">
                <option value="">Tanlang...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.phone})</option>)}
              </select>
            </div>
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700" onClick={handleDistance} disabled={!distUser1 || !distUser2}>
              📍 Hisoblash
            </Button>
          </div>

          {distResult && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <h4 className="font-bold text-green-700 dark:text-green-400 mb-3">📏 Natija</h4>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">{distResult.distance_km} km</p>
              <p className="text-xs text-zinc-500">({distResult.distance_m} metr)</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg">
                  <p className="font-bold">📍 User 1</p>
                  <p className="text-zinc-500 truncate">{distResult.user1_location?.address || `${distResult.user1_location?.lat}, ${distResult.user1_location?.lng}`}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg">
                  <p className="font-bold">📍 User 2</p>
                  <p className="text-zinc-500 truncate">{distResult.user2_location?.address || `${distResult.user2_location?.lat}, ${distResult.user2_location?.lng}`}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color, wide }: { label: string; value: any; color: string; wide?: boolean }) => {
  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500 to-indigo-700',
    amber: 'from-amber-500 to-amber-700',
    green: 'from-green-500 to-green-700',
    red: 'from-red-500 to-red-700',
    purple: 'from-purple-500 to-purple-700',
    blue: 'from-blue-500 to-blue-700',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.indigo} rounded-xl p-4 text-white shadow-md ${wide ? 'col-span-2' : ''}`}>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};
