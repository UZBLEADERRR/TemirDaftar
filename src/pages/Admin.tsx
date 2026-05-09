import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, RefreshCw, Crown, Store } from 'lucide-react';
import { formatDate, timeAgo } from '@/lib/utils';

type Tab = 'dashboard' | 'users' | 'subscriptions' | 'recover';

export const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Recovery form
  const [oldTgId, setOldTgId] = useState('');
  const [newTgId, setNewTgId] = useState('');

  // Subscription form
  const [subMonths, setSubMonths] = useState('1');
  const [subAmount, setSubAmount] = useState('35000');

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

  const fetchUserDetails = async (userId: string) => {
    try {
      const data = await apiCall(`/api/admin/users/${userId}`);
      setSelectedUser(data);
    } catch {}
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  const handleActivateSubscription = async (userId: string) => {
    try {
      await apiCall(`/api/admin/subscription/activate/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ months: Number(subMonths), amount: Number(subAmount) }),
      });
      hapticSuccess();
      toast.success('Obuna faollashtirildi');
      fetchUserDetails(userId);
      fetchStats();
    } catch (err: any) { toast.error(err.message || 'Xatolik'); }
  };

  const handleExpireSubscription = async (userId: string) => {
    try {
      await apiCall(`/api/admin/subscription/expire/${userId}`, { method: 'POST' });
      toast.success('Obuna bekor qilindi');
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'users', label: '👥 Foydalanuvchilar' },
    { id: 'subscriptions', label: '👑 Obunalar' },
    { id: 'recover', label: '🔄 Tiklash' },
  ];

  const subStatusColors: Record<string, string> = {
    trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

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
              tab === t.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Dashboard */}
      {tab === 'dashboard' && stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Jami foydalanuvchilar" value={stats.users} color="emerald" />
          <StatCard label="Do'konchilar" value={stats.shopkeepers} color="teal" />
          <StatCard label="Mijozlar" value={stats.customers} color="blue" />
          <StatCard label="Aktiv qarzlar" value={stats.activeDebts} color="amber" />
          <StatCard label="To'langan" value={stats.paidDebts} color="green" />
          <StatCard label="Trial" value={stats.trialUsers} color="yellow" />
          <StatCard label="Faol obunalar" value={stats.activeSubscriptions} color="emerald" />
          <StatCard label="Tugagan obunalar" value={stats.expiredSubscriptions} color="red" />
          <StatCard label="Obuna daromadi" value={`${(stats.totalRevenue || 0).toLocaleString()} UZS`} color="purple" wide />
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
                <p className="font-bold text-sm flex items-center gap-1.5">
                  {u.user_role === 'shopkeeper' ? <Store size={12} className="text-emerald-600" /> : null}
                  {u.name || 'Nomsiz'}
                </p>
                <p className="text-xs text-zinc-500">{u.phone || 'Tel yo\'q'} • {u.shop_name || ''}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${subStatusColors[u.subscription_status] || subStatusColors.trial}`}>
                  {u.subscription_status || 'trial'}
                </span>
                <p className="text-[10px] text-zinc-400 mt-1">⭐ {u.score || 0}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* User Detail */}
      {tab === 'users' && selectedUser && (
        <div className="flex flex-col gap-4">
          <button onClick={() => setSelectedUser(null)} className="text-emerald-600 text-sm font-bold self-start">← Orqaga</button>

          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
            <h3 className="font-bold text-lg">{selectedUser.user?.name}</h3>
            <p className="text-sm text-zinc-500">📱 {selectedUser.user?.phone}</p>
            <p className="text-sm text-zinc-500">🆔 TG: {selectedUser.user?.telegram_id}</p>
            <p className="text-sm text-zinc-500">🏪 Do'kon: {selectedUser.user?.shop_name || '-'}</p>
            <p className="text-sm text-zinc-500">👤 Rol: {selectedUser.user?.user_role}</p>
            <p className="text-sm text-zinc-500">📅 Ro'yxat: {formatDate(selectedUser.user?.created_at)}</p>
            <div className="mt-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${subStatusColors[selectedUser.user?.subscription_status] || subStatusColors.trial}`}>
                Obuna: {selectedUser.user?.subscription_status}
              </span>
            </div>
          </div>

          {/* Subscription management */}
          {selectedUser.user?.user_role === 'shopkeeper' && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <h4 className="font-bold text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1">
                <Crown size={16} /> Obuna boshqaruvi
              </h4>
              <div className="flex gap-2 mb-2">
                <div className="flex-1">
                  <Label className="text-[10px]">Oylar</Label>
                  <Input type="number" value={subMonths} onChange={e => setSubMonths(e.target.value)} className="h-9" />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px]">Summa (UZS)</Label>
                  <Input type="number" value={subAmount} onChange={e => setSubAmount(e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9 text-xs"
                  onClick={() => handleActivateSubscription(selectedUser.user?.id)}
                >
                  ✅ Faollashtirish
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-9 text-xs"
                  onClick={() => handleExpireSubscription(selectedUser.user?.id)}
                >
                  ❌ Bekor qilish
                </Button>
              </div>
            </div>
          )}

          {/* Debts */}
          <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
            <h4 className="font-bold text-sm mb-2">Qarzlar</h4>
            <p className="text-xs text-zinc-500 mb-1">
              Bergan: {selectedUser.debtsAsGiver?.length || 0} | Olgan: {selectedUser.debtsAsReceiver?.length || 0}
            </p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {[...(selectedUser.debtsAsGiver || []), ...(selectedUser.debtsAsReceiver || [])].slice(0, 10).map((d: any) => (
                <div key={d.id} className="text-xs flex justify-between bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                  <span>{d.amount?.toLocaleString()} {d.currency}</span>
                  <span className={`font-bold uppercase ${d.status === 'paid' ? 'text-emerald-600' : d.status === 'overdue' ? 'text-red-500' : 'text-zinc-500'}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Customers (if shopkeeper) */}
          {selectedUser.customers?.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border rounded-xl p-4">
              <h4 className="font-bold text-sm mb-2">Mijozlar ({selectedUser.customers.length})</h4>
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                {selectedUser.customers.map((c: any) => (
                  <div key={c.id} className="text-xs flex justify-between bg-zinc-50 dark:bg-zinc-800 p-2 rounded">
                    <span>{c.customer_name}</span>
                    <span className={`font-bold ${c.rating === 'green' ? 'text-emerald-600' : c.rating === 'yellow' ? 'text-amber-500' : 'text-red-500'}`}>
                      {c.rating}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscriptions overview */}
      {tab === 'subscriptions' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500 mb-2">Do'konchilar obuna holati</p>
          {users.filter(u => u.user_role === 'shopkeeper').map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div>
                <p className="font-bold text-sm">{u.name}</p>
                <p className="text-xs text-zinc-500">{u.shop_name || '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${subStatusColors[u.subscription_status] || subStatusColors.trial}`}>
                  {u.subscription_status}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-2"
                  onClick={() => { setTab('users'); fetchUserDetails(u.id); }}
                >
                  Boshqarish
                </Button>
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
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleRecover} disabled={loading || !oldTgId || !newTgId}>
            {loading ? '...' : '🔄 Tiklash'}
          </Button>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color, wide }: { label: string; value: any; color: string; wide?: boolean }) => {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500 to-emerald-700',
    teal: 'from-teal-500 to-teal-700',
    blue: 'from-blue-500 to-blue-700',
    amber: 'from-amber-500 to-amber-700',
    green: 'from-green-500 to-green-700',
    red: 'from-red-500 to-red-700',
    purple: 'from-purple-500 to-purple-700',
    yellow: 'from-yellow-500 to-yellow-700',
  };

  return (
    <div className={`bg-gradient-to-br ${colorMap[color] || colorMap.emerald} rounded-xl p-4 text-white shadow-md ${wide ? 'col-span-2' : ''}`}>
      <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};
