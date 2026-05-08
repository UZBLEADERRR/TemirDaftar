import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initBot } from './bot.js';
import { initCronJobs } from './cron.js';
import adminRouter from './admin.js';
import locationRouter from './location.js';
import { supabase } from './supabase.js';
import { telegramAuth, AuthenticatedRequest } from './auth.js';

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

  // Get debts for current user
  app.get('/api/debts', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { data: given } = await supabase.from('debts')
        .select('*, receiver:receiver_id(name, phone)')
        .eq('giver_id', user.id).order('created_at', { ascending: false });
      const { data: taken } = await supabase.from('debts')
        .select('*, giver:giver_id(name, phone, cards)')
        .eq('receiver_id', user.id).order('created_at', { ascending: false });

      res.json({ given: given || [], taken: taken || [] });
    } catch { res.status(500).json({ error: 'Server error' }); }
  });

  // Create debt
  app.post('/api/debts', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id, wallet_balance')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const { amount, currency, dueDate, receiverName, receiverPhone, note, type, receiverId } = req.body;

      // If taking debt, charge 1000 UZS fee
      if (type === 'took') {
        if ((user.wallet_balance || 0) < 1000) {
          return res.status(400).json({ error: 'Hamyonda 1,000 UZS yetarli emas' });
        }
        await supabase.from('users').update({ wallet_balance: (user.wallet_balance || 0) - 1000 }).eq('id', user.id);
        await supabase.from('wallet_transactions').insert({
          user_id: user.id, type: 'fee', amount: 1000, status: 'completed',
        });
      }

      const { data: debt, error } = await supabase.from('debts').insert({
        amount, currency: currency || 'UZS', due_date: dueDate,
        giver_id: type === 'took' ? null : user.id,
        receiver_id: type === 'took' ? user.id : (receiverId || null),
        receiver_name: type === 'took' ? '' : receiverName,
        receiver_phone: type === 'took' ? '' : receiverPhone,
        status: receiverId ? 'active' : 'pending',
        note: note || '', creator_id: user.id,
      }).select().single();

      if (error) throw error;
      res.json(debt);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create debt' });
    }
  });

  // Update debt status
  app.patch('/api/debts/:id', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      const { data: user } = await supabase
        .from('users').select('id')
        .eq('telegram_id', req.telegramUser!.id).single();
      if (!user) return res.status(404).json({ error: 'User not found' });

      const updates = { ...req.body, updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from('debts')
        .update(updates).eq('id', req.params.id).select().single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update debt' });
    }
  });

  // Delete debt
  app.delete('/api/debts/:id', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    try {
      await supabase.from('debts').delete().eq('id', req.params.id);
      res.json({ success: true });
    } catch { res.status(500).json({ error: 'Failed to delete' }); }
  });

  // Get user by ID (for scanning)
  app.get('/api/users/:id', telegramAuth as any, async (req, res) => {
    const { data } = await supabase.from('users')
      .select('id, name, score, telegram_id').eq('id', req.params.id).single();
    if (!data) return res.status(404).json({ error: 'User not found' });
    res.json(data);
  });

  // Get trust score details for a user
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

  // Wallet: topup request
  app.post('/api/wallet/topup', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { amount, receiptUrl } = req.body;
    if (!amount || amount < 10000) return res.status(400).json({ error: 'Min 10,000 UZS' });

    await supabase.from('wallet_transactions').insert({
      user_id: user.id, type: 'topup', amount, status: 'pending', receipt_url: receiptUrl || '',
    });
    // Notify admins
    const { notifyAdmins } = await import('./bot.js');
    await notifyAdmins(`💰 Yangi topup so'rov:\nMiqdor: ${amount.toLocaleString()} UZS`);
    res.json({ success: true });
  });

  // Wallet: send money (P2P)
  app.post('/api/wallet/send', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: sender } = await supabase.from('users').select('id, wallet_balance').eq('telegram_id', req.telegramUser!.id).single();
    if (!sender) return res.status(404).json({ error: 'User not found' });
    const { targetUserId, amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if ((sender.wallet_balance || 0) < amount) return res.status(400).json({ error: 'Mablag\' yetarli emas' });

    const { data: target } = await supabase.from('users').select('id, wallet_balance, telegram_chat_id').eq('id', targetUserId).single();
    if (!target) return res.status(404).json({ error: 'Target user not found' });

    await supabase.from('users').update({ wallet_balance: (sender.wallet_balance || 0) - amount }).eq('id', sender.id);
    await supabase.from('users').update({ wallet_balance: (target.wallet_balance || 0) + amount }).eq('id', target.id);
    await supabase.from('wallet_transactions').insert({
      user_id: sender.id, target_user_id: target.id, type: 'p2p', amount, status: 'completed',
    });

    if (target.telegram_chat_id) {
      const { sendTelegramMessage } = await import('./bot.js');
      await sendTelegramMessage(target.telegram_chat_id, `💸 Sizga ${amount.toLocaleString()} UZS yuborildi!`);
    }
    res.json({ success: true, newBalance: (sender.wallet_balance || 0) - amount });
  });

  // Update user cards
  app.patch('/api/me/cards', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { cards } = req.body;
    await supabase.from('users').update({ cards }).eq('id', user.id);
    res.json({ success: true });
  });

  // Confirm debt via QR scan
  app.post('/api/debts/:id/confirm', telegramAuth as any, async (req: AuthenticatedRequest, res) => {
    const { data: user } = await supabase.from('users').select('id, wallet_balance').eq('telegram_id', req.telegramUser!.id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { data: debt } = await supabase.from('debts').select('*').eq('id', req.params.id).single();
    if (!debt) return res.status(404).json({ error: 'Debt not found' });

    const { role } = req.body; // 'receiver' or 'giver'

    if (role === 'receiver') {
      // Charge 1000 UZS fee
      if ((user.wallet_balance || 0) < 1000) {
        return res.status(400).json({ error: 'Hamyonda 1,000 UZS yetarli emas' });
      }
      await supabase.from('users').update({ wallet_balance: (user.wallet_balance || 0) - 1000 }).eq('id', user.id);
      await supabase.from('wallet_transactions').insert({ user_id: user.id, type: 'fee', amount: 1000, status: 'completed' });
      await supabase.from('debts').update({ receiver_id: user.id, status: 'active', updated_at: new Date().toISOString() }).eq('id', debt.id);
    } else {
      await supabase.from('debts').update({ giver_id: user.id, status: 'active', updated_at: new Date().toISOString() }).eq('id', debt.id);
    }

    res.json({ success: true });
  });

  // ===== Static / Vite =====
  if (isProd) {
    const distPath = path.resolve(__dirname, '../dist');
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
