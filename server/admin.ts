import { Router } from 'express';
import { supabase } from './supabase.js';
import { AuthenticatedRequest, requireAdmin, telegramAuth } from './auth.js';
import { notifyAdmins, sendTelegramMessage } from './bot.js';
import { getDistance } from 'geolib';

const router = Router();
router.use(telegramAuth as any);
router.use(requireAdmin as any);

// Dashboard stats
router.get('/stats', async (_req, res) => {
  try {
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: activeDebts } = await supabase.from('debts').select('*', { count: 'exact', head: true }).in('status', ['active', 'overdue', 'pending', 'verifying']);
    const { count: paidDebts } = await supabase.from('debts').select('*', { count: 'exact', head: true }).eq('status', 'paid');

    // Revenue from fees
    const { data: fees } = await supabase.from('wallet_transactions').select('amount').eq('type', 'fee').eq('status', 'completed');
    const totalFeeRevenue = fees?.reduce((s, f) => s + f.amount, 0) || 0;

    // Total topups
    const { data: topups } = await supabase.from('wallet_transactions').select('amount').eq('type', 'topup').eq('status', 'approved');
    const totalTopups = topups?.reduce((s, t) => s + t.amount, 0) || 0;

    // Pending topups
    const { count: pendingTopups } = await supabase.from('wallet_transactions').select('*', { count: 'exact', head: true }).eq('type', 'topup').eq('status', 'pending');

    res.json({
      users: usersCount || 0,
      activeDebts: activeDebts || 0,
      paidDebts: paidDebts || 0,
      totalFeeRevenue,
      totalTopups,
      pendingTopups: pendingTopups || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// All users
router.get('/users', async (_req, res) => {
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  res.json(data || []);
});

// Single user + locations
router.get('/users/:id', async (req, res) => {
  const { data: user } = await supabase.from('users').select('*').eq('id', req.params.id).single();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { data: locations } = await supabase.from('locations').select('*').eq('user_id', req.params.id).order('created_at', { ascending: false }).limit(50);
  const { data: debtsAsReceiver } = await supabase.from('debts').select('*').eq('receiver_id', req.params.id).order('created_at', { ascending: false });
  const { data: debtsAsGiver } = await supabase.from('debts').select('*').eq('giver_id', req.params.id).order('created_at', { ascending: false });
  res.json({ user, locations: locations || [], debtsAsReceiver: debtsAsReceiver || [], debtsAsGiver: debtsAsGiver || [] });
});

// Approve topup
router.post('/topup/approve/:txId', async (req, res) => {
  const { data: tx } = await supabase.from('wallet_transactions').select('*').eq('id', req.params.txId).single();
  if (!tx || tx.status !== 'pending') return res.status(400).json({ error: 'Invalid transaction' });

  await supabase.from('wallet_transactions').update({ status: 'approved' }).eq('id', tx.id);
  const { data: user } = await supabase.from('users').select('wallet_balance, telegram_chat_id').eq('id', tx.user_id).single();
  if (user) {
    await supabase.from('users').update({ wallet_balance: (user.wallet_balance || 0) + tx.amount }).eq('id', tx.user_id);
    if (user.telegram_chat_id) {
      await sendTelegramMessage(user.telegram_chat_id, `✅ Hamyoningizga ${tx.amount.toLocaleString()} UZS qo'shildi!`);
    }
  }
  res.json({ success: true });
});

// Reject topup
router.post('/topup/reject/:txId', async (req, res) => {
  await supabase.from('wallet_transactions').update({ status: 'rejected' }).eq('id', req.params.txId);
  res.json({ success: true });
});

// Pending topups
router.get('/topups/pending', async (_req, res) => {
  const { data } = await supabase.from('wallet_transactions').select('*, user:user_id (name, phone, telegram_id)').eq('type', 'topup').eq('status', 'pending').order('created_at', { ascending: false });
  res.json(data || []);
});

// Deduct money from user
router.post('/deduct/:userId', async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const { data: user } = await supabase.from('users').select('wallet_balance, telegram_chat_id, name').eq('id', req.params.userId).single();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = Math.max(0, (user.wallet_balance || 0) - amount);
  await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', req.params.userId);

  await supabase.from('wallet_transactions').insert({
    user_id: req.params.userId, type: 'deduct', amount, status: 'completed',
  });

  if (user.telegram_chat_id) {
    await sendTelegramMessage(user.telegram_chat_id, `⚠️ Hamyoningizdan ${amount.toLocaleString()} UZS yechildi.\nSabab: ${reason || 'Admin tomonidan'}`);
  }
  res.json({ success: true, newBalance });
});

// Account recovery
router.post('/recover-account', async (req, res) => {
  const { oldTelegramId, newTelegramId } = req.body;
  if (!oldTelegramId || !newTelegramId) return res.status(400).json({ error: 'Both IDs required' });

  const { data: oldUser } = await supabase.from('users').select('*').eq('telegram_id', oldTelegramId).single();
  if (!oldUser) return res.status(404).json({ error: 'Old account not found' });

  await supabase.from('users').update({
    telegram_id: newTelegramId,
    deleted_telegram_id: oldTelegramId,
    telegram_chat_id: null,
  }).eq('id', oldUser.id);

  res.json({ success: true, message: `Account ${oldUser.name} transferred to new Telegram ID` });
});

// Distance between two users
router.get('/distance', async (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) return res.status(400).json({ error: 'Two user IDs required' });

  const { data: loc1 } = await supabase.from('locations').select('lat, lng, address').eq('user_id', user1 as string).order('created_at', { ascending: false }).limit(1).single();
  const { data: loc2 } = await supabase.from('locations').select('lat, lng, address').eq('user_id', user2 as string).order('created_at', { ascending: false }).limit(1).single();

  if (!loc1 || !loc2) return res.status(404).json({ error: 'Location data not found for one or both users' });

  const distanceMeters = getDistance(
    { latitude: loc1.lat, longitude: loc1.lng },
    { latitude: loc2.lat, longitude: loc2.lng }
  );

  res.json({
    distance_km: (distanceMeters / 1000).toFixed(2),
    distance_m: distanceMeters,
    user1_location: loc1,
    user2_location: loc2,
  });
});

export default router;
