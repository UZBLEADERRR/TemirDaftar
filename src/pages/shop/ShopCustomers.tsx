import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiCall, hapticFeedback, hapticSuccess } from '@/src/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Plus, UserPlus, Phone, AlertTriangle, Copy, Check, Send, ArrowUpDown, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Customer {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  invite_code: string;
  rating: 'green' | 'yellow' | 'red';
  totalDebt: number;
  overdueCount: number;
  nearestDueDate: string | null;
  displayName: string;
  displayPhone: string;
}

type SortKey = 'name' | 'debt' | 'overdue';

export const ShopCustomers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadCustomers();
  }, [user]);

  const loadCustomers = async () => {
    try {
      const data = await apiCall('/api/shop/customers');
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!newName.trim()) {
      toast.error('Mijoz ismini kiriting');
      return;
    }
    setAdding(true);
    try {
      const customer = await apiCall('/api/shop/customers', {
        method: 'POST',
        body: JSON.stringify({ customerName: newName.trim(), customerPhone: newPhone.trim() }),
      });
      hapticSuccess();
      toast.success('Mijoz qo\'shildi!');
      setCustomers([customer, ...customers]);
      setShowAdd(false);
      setNewName('');
      setNewPhone('');

      // Auto-show invite link
      const res = await apiCall(`/api/shop/customers/${customer.id}/invite`);
      setInviteLink(res.inviteLink);
      setShowInvite(true);
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    } finally {
      setAdding(false);
    }
  };

  const handleGetInvite = async (customerId: string) => {
    try {
      const res = await apiCall(`/api/shop/customers/${customerId}/invite`);
      setInviteLink(res.inviteLink);
      setShowInvite(true);
    } catch (err: any) {
      toast.error(err.message || 'Xatolik');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    hapticSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const ratingColors = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
  };

  const ratingLabels = {
    green: 'Yaxshi',
    yellow: 'O\'rtacha',
    red: 'Yomon',
  };

  // Filter and sort
  const filtered = customers
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.displayName?.toLowerCase().includes(q) || c.displayPhone?.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'debt') return b.totalDebt - a.totalDebt;
      if (sortBy === 'overdue') return b.overdueCount - a.overdueCount;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

  return (
    <div className="p-5">
      <header className="flex justify-between items-center mb-5 mt-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mijozlar</h1>
        <Button
          onClick={() => { setShowAdd(true); hapticFeedback(); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 rounded-xl h-10 px-4"
        >
          <UserPlus size={16} />
          Qo'shish
        </Button>
      </header>

      {/* Search + Sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ism yoki telefon..."
            className="pl-9 h-10 rounded-xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          />
        </div>
        <button
          onClick={() => {
            const keys: SortKey[] = ['name', 'debt', 'overdue'];
            const idx = keys.indexOf(sortBy);
            setSortBy(keys[(idx + 1) % keys.length]);
            hapticFeedback();
          }}
          className="h-10 px-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          <ArrowUpDown size={14} />
          {sortBy === 'name' ? 'Ism' : sortBy === 'debt' ? 'Qarz' : 'Kechikish'}
        </button>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 flex flex-col items-center gap-3">
          <span className="text-5xl">👥</span>
          <p className="text-sm text-zinc-500">{search ? 'Natija topilmadi' : 'Hali mijoz qo\'shilmagan'}</p>
          {!search && (
            <Button onClick={() => setShowAdd(true)} variant="outline" className="gap-1.5 rounded-xl">
              <Plus size={16} /> Birinchi mijozni qo'shing
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              {/* Rating dot */}
              <div className="flex flex-col items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${ratingColors[c.rating]}`}></div>
                <span className="text-[8px] text-zinc-400 font-medium">{ratingLabels[c.rating]}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{c.displayName}</p>
                {c.displayPhone && (
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Phone size={10} /> {c.displayPhone}
                  </p>
                )}
                {c.nearestDueDate && (
                  <p className={`text-[10px] mt-0.5 ${c.overdueCount > 0 ? 'text-red-500 font-bold' : 'text-zinc-400'}`}>
                    {c.overdueCount > 0 ? `⚠ ${c.overdueCount} ta kechikkan` : `Muddat: ${c.nearestDueDate}`}
                  </p>
                )}
              </div>

              {/* Debt amount */}
              <div className="flex flex-col items-end gap-1">
                <p className={`font-bold text-sm ${c.totalDebt > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                  {c.totalDebt > 0 ? c.totalDebt.toLocaleString() : '0'}
                </p>
                <p className="text-[10px] text-zinc-400">UZS</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                {!c.customer_id && (
                  <button
                    onClick={() => handleGetInvite(c.id)}
                    className="w-7 h-7 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center"
                  >
                    <Send size={12} className="text-blue-600 dark:text-blue-400" />
                  </button>
                )}
                <Link
                  to={`/add-debt?customerId=${c.id}&name=${encodeURIComponent(c.displayName)}`}
                  className="w-7 h-7 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center"
                >
                  <Plus size={12} className="text-emerald-600 dark:text-emerald-400" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="w-[90%] rounded-2xl dark:bg-zinc-950 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>Yangi mijoz</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Ism *</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Mijoz ismi"
                className="h-12 rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Telefon (ixtiyoriy)</Label>
              <Input
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="h-12 rounded-xl"
              />
            </div>
            <Button
              onClick={handleAddCustomer}
              disabled={adding}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {adding ? '...' : 'Qo\'shish'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Link Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="w-[90%] rounded-2xl dark:bg-zinc-950 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle>Mijoz uchun havola</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <p className="text-sm text-zinc-500">
              Bu havolani mijozga Telegram orqali yuboring. Mijoz havola orqali kirib o'z qarzlarini ko'radi.
            </p>
            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl border dark:border-zinc-800 flex items-center gap-2">
              <code className="text-xs font-mono flex-1 break-all text-zinc-600 dark:text-zinc-400">{inviteLink}</code>
              <button onClick={handleCopyLink} className="shrink-0 text-emerald-600 p-1">
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <a
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl font-bold transition-colors"
            >
              <ExternalLink size={16} />
              Telegram da ochish
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
