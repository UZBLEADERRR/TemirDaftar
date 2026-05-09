import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initBot, sendDebtReminder } from './bot.js';
import { initCronJobs } from './cron.js';
import adminRouter from './admin.js';
import locationRouter from './location.js';
import { supabase } from './supabase.js';
import { telegramAuth, requireShopkeeper, requireActiveSubscription, AuthenticatedRequest } from './auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000');
const isProd = process.env.NODE_ENV === 'production';

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // ===== API Routes =====
  app.use('/api/admin', adminRouter);
  app.use('/api/location', locationRouter);

  // Get current user
  app.get('/api/me', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('*')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch { res.status(500).json({ error: 'Server error' }); }
  });

  // ==========================================
  // SHOPKEEPER ROUTES — /api/shop/*
  // ==========================================

  // Get shop dashboard stats
  app.get('/api/shop/stats', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7) + '-01';

      // Today's sales
      const { data: todaySales } = await supabase
        .from('sales')
        .select('amount, sale_type, currency')
        .eq('shop_owner_id', user.id)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59');

      const todayCash = (todaySales || [])
        .filter(s => s.sale_type === 'cash')
        .reduce((sum, s) => sum + s.amount, 0);
      const todayDebt = (todaySales || [])
        .filter(s => s.sale_type === 'debt')
        .reduce((sum, s) => sum + s.amount, 0);

      // Monthly sales
      const { data: monthlySales } = await supabase
        .from('sales')
        .select('amount, sale_type, created_at')
        .eq('shop_owner_id', user.id)
        .gte('created_at', monthStart + 'T00:00:00');

      const monthlyTotal = (monthlySales || []).reduce((sum, s) => sum + s.amount, 0);

      // Overdue debts
      const { data: overdueDebts } = await supabase
        .from('debts')
        .select('id, amount, currency')
        .eq('shop_owner_id', user.id)
        .eq('status', 'overdue');

      const overdueCount = overdueDebts?.length || 0;
      const overdueSum = (overdueDebts || []).reduce((sum, d) => sum + d.amount, 0);

      // On-time customers (paid debts)
      const { data: paidDebts } = await supabase
        .from('debts')
        .select('receiver_id')
        .eq('shop_owner_id', user.id)
        .eq('status', 'paid');

      const onTimeCustomers = new Set((paidDebts || []).map(d => d.receiver_id).filter(Boolean)).size;

      // Active debts total
      const { data: activeDebts } = await supabase
        .from('debts')
        .select('id, amount')
        .eq('shop_owner_id', user.id)
        .in('status', ['active', 'pending', 'overdue']);

      const activeDebtSum = (activeDebts || []).reduce((sum, d) => sum + d.amount, 0);
      const activeDebtCount = activeDebts?.length || 0;

      // Total customers
      const { count: totalCustomers } = await supabase
        .from('shop_customers')
        .select('id', { count: 'exact', head: true })
        .eq('shop_owner_id', user.id);

      // Daily breakdown for monthly chart
      const dailyBreakdown: Record<string, { cash: number; debt: number }> = {};
      (monthlySales || []).forEach(s => {
        const day = s.created_at.split('T')[0];
        if (!dailyBreakdown[day]) dailyBreakdown[day] = { cash: 0, debt: 0 };
        dailyBreakdown[day][s.sale_type as 'cash' | 'debt'] += s.amount;
      });

      res.json({
        todayCash,
        todayDebt,
        todayTotal: todayCash + todayDebt,
        monthlyTotal,
        overdueCount,
        overdueSum,
        onTimeCustomers,
        activeDebtSum,
        activeDebtCount,
        totalCustomers: totalCustomers || 0,
        dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({
          date,
          cash: data.cash,
          debt: data.debt,
          total: data.cash + data.debt,
        })).sort((a, b) => a.date.localeCompare(b.date)),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // Get shopkeeper's customers
  app.get('/api/shop/customers', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: customers } = await supabase
        .from('shop_customers')
        .select('*, customer:customer_id(name, phone, telegram_chat_id)')
        .eq('shop_owner_id', user.id)
        .order('created_at', { ascending: false });

      // Enrich with debt info
      const enriched = await Promise.all((customers || []).map(async (c) => {
        const customerId = c.customer_id;
        let totalDebt = 0;
        let overdueCount = 0;
        let nearestDueDate: string | null = null;

        if (customerId) {
          const { data: debts } = await supabase
            .from('debts')
            .select('amount, status, due_date')
            .eq('shop_owner_id', user.id)
            .eq('receiver_id', customerId)
            .in('status', ['active', 'pending', 'overdue']);

          (debts || []).forEach(d => {
            totalDebt += d.amount;
            if (d.status === 'overdue') overdueCount++;
            if (!nearestDueDate || d.due_date < nearestDueDate) nearestDueDate = d.due_date;
          });
        }

        return {
          ...c,
          totalDebt,
          overdueCount,
          nearestDueDate,
          displayName: c.customer?.name || c.customer_name,
          displayPhone: c.customer?.phone || c.customer_phone,
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // Add new customer to shop
  app.post('/api/shop/customers', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { customerName, customerPhone } = req.body;
      if (!customerName?.trim()) return res.status(400).json({ error: 'Mijoz ismi kerak' });

      // Generate unique invite code
      const { randomUUID } = await import('crypto');
      const inviteCode = randomUUID().replace(/-/g, '').substring(0, 12);

      const { data: customer, error } = await supabase
        .from('shop_customers')
        .insert({
          shop_owner_id: user.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone || '',
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (error) throw error;
      res.json(customer);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to add customer' });
    }
  });

  // Get invite link for customer
  app.get('/api/shop/customers/:id/invite', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: customer } = await supabase
        .from('shop_customers')
        .select('invite_code')
        .eq('id', req.params.id)
        .single();

      if (!customer) return res.status(404).json({ error: 'Customer not found' });

      const botUsername = process.env.BOT_USERNAME || 'qarz_daftari_bot';
      const inviteLink = `https://t.me/${botUsername}?start=invite_${customer.invite_code}`;

      res.json({ inviteLink, inviteCode: customer.invite_code });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update customer rating
  app.patch('/api/shop/customers/:id', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { rating } = req.body;
      const { data, error } = await supabase
        .from('shop_customers')
        .update({ rating })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get shopkeeper's debts
  app.get('/api/shop/debts', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: debts } = await supabase
        .from('debts')
        .select('*, receiver:receiver_id(name, phone)')
        .eq('shop_owner_id', user.id)
        .order('created_at', { ascending: false });

      res.json(debts || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // Create new debt (shopkeeper) — no fees
  app.post('/api/shop/debts', telegramAuth as any, requireActiveSubscription as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id, name, shop_name')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { amount, currency, dueDate, receiverName, receiverPhone, note, saleType, customerId } = req.body;

      if (!amount || amount <= 0) return res.status(400).json({ error: 'Summani kiriting' });
      if (!dueDate) return res.status(400).json({ error: 'Muddatni kiriting' });

      // Find or link customer
      let receiverId: string | null = null;
      if (customerId) {
        const { data: shopCustomer } = await supabase
          .from('shop_customers')
          .select('customer_id')
          .eq('id', customerId)
          .eq('shop_owner_id', user.id)
          .single();

        if (shopCustomer?.customer_id) {
          receiverId = shopCustomer.customer_id;
        }
      }

      const { data: debt, error } = await supabase.from('debts').insert({
        amount,
        currency: currency || 'UZS',
        due_date: dueDate,
        giver_id: user.id,
        receiver_id: receiverId,
        receiver_name: receiverName || '',
        receiver_phone: receiverPhone || '',
        status: 'active',
        note: note || '',
        creator_id: user.id,
        shop_owner_id: user.id,
        sale_type: saleType || 'debt',
      }).select().single();

      if (error) throw error;

      // Record the sale
      await supabase.from('sales').insert({
        shop_owner_id: user.id,
        customer_id: receiverId,
        debt_id: debt.id,
        amount,
        currency: currency || 'UZS',
        sale_type: saleType || 'debt',
        product_note: note || '',
      });

      res.json(debt);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create debt' });
    }
  });

  // Record cash sale (no debt created)
  app.post('/api/shop/sales', telegramAuth as any, requireActiveSubscription as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { amount, currency, note } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: 'Summani kiriting' });

      const { data: sale, error } = await supabase.from('sales').insert({
        shop_owner_id: user.id,
        amount,
        currency: currency || 'UZS',
        sale_type: 'cash',
        product_note: note || '',
      }).select().single();

      if (error) throw error;
      res.json(sale);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to record sale' });
    }
  });

  // Send manual reminder (shopkeeper)
  app.post('/api/shop/remind/:debtId', telegramAuth as any, requireActiveSubscription as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const result = await sendDebtReminder(req.params.debtId, user.id);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to send reminder' });
    }
  });

  // Update debt status (shopkeeper)
  app.patch('/api/shop/debts/:id', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const updates = { ...req.body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('debts')
        .update(updates)
        .eq('id', req.params.id)
        .eq('shop_owner_id', user.id)
        .select().single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update debt' });
    }
  });

  // Delete debt (shopkeeper)
  app.delete('/api/shop/debts/:id', telegramAuth as any, requireShopkeeper as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      await supabase.from('debts').delete()
        .eq('id', req.params.id)
        .eq('shop_owner_id', user.id);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete' }); }
  });

  // ==========================================
  // CUSTOMER ROUTES — /api/customer/*
  // ==========================================

  // Get customer's debts
  app.get('/api/customer/debts', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id, user_role')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: debts } = await supabase
        .from('debts')
        .select('id, amount, currency, due_date, note, status, created_at, giver:giver_id(name, shop_name)')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      res.json(debts || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // Get customer's payment history (paid debts)
  app.get('/api/customer/history', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: history } = await supabase
        .from('debts')
        .select('id, amount, currency, due_date, note, status, created_at, updated_at, giver:giver_id(name, shop_name)')
        .eq('receiver_id', user.id)
        .eq('status', 'paid')
        .order('updated_at', { ascending: false });

      res.json(history || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Server error' });
    }
  });

  // ==========================================
  // SHARED ROUTES
  // ==========================================

  // Notifications
  app.get('/api/notifications', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    res.json(data || []);
  });

  app.patch('/api/notifications/read-all', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.json({ success: true });
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    res.json({ success: true });
  });

  // Update user cards
  app.patch('/api/me/cards', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { cards } = req.body;
    await supabase.from('users').update({ cards }).eq('id', user.id);
    res.json({ success: true });
  });

  // Update user name
  app.patch('/api/me/name', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Ism bo\'sh bo\'lmasligi kerak' });
    await supabase.from('users').update({ name: name.trim() }).eq('id', user.id);
    res.json({ success: true });
  });

  // Update shop name
  app.patch('/api/me/shop-name', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { shopName } = req.body;
    if (!shopName?.trim()) return res.status(400).json({ error: 'Do\'kon nomi bo\'sh bo\'lmasligi kerak' });
    await supabase.from('users').update({ shop_name: shopName.trim() }).eq('id', user.id);
    res.json({ success: true });
  });

  // Get user trust score
  app.get('/api/users/:id/trust', telegramAuth as any, async (req, res) => {
    const userId = req.params.id;
    const { data: asReceiver } = await supabase.from('debts').select('status, due_date, amount, created_at').eq('receiver_id', userId);
    const { data: asGiver } = await supabase.from('debts').select('status').eq('giver_id', userId);

    const total = asReceiver?.length || 0;
    const paid = asReceiver?.filter(d => d.status === 'paid').length || 0;
    const overdue = asReceiver?.filter(d => d.status === 'overdue').length || 0;
    const given = asGiver?.length || 0;

    res.json({ totalDebts: total, paidOnTime: paid, overdue, givenToOthers: given, history: asReceiver || [] });
  });

  // ===== Static / Vite =====
  if (isProd) {
    // Server runs from dist/server/index.js, Vite output is in dist/
    const distPath = path.resolve(__dirname, '..');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // ===== Start =====
  initBot();
  initCronJobs();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
  });
}

start().catch(console.error);
