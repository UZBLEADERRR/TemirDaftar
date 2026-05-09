import { Router } from 'express';
import { supabase } from './supabase.js';
import { AuthenticatedRequest, requireAdmin, telegramAuth } from './auth.js';
import { sendTelegramMessage } from './bot.js';

const router = Router();
router.use(telegramAuth as any);
router.use(requireAdmin as any);

// Dashboard stats
router.get('/stats', async (_req, res) => {
  try {
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: shopkeeperCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_role', 'shopkeeper');
    const { count: customerCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_role', 'customer');
    const { count: activeDebts } = await supabase.from('debts').select('*', { count: 'exact', head: true }).in('status', ['active', 'overdue', 'pending']);
    const { count: paidDebts } = await supabase.from('debts').select('*', { count: 'exact', head: true }).eq('status', 'paid');

    // Subscription stats
    const { count: trialUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_role', 'shopkeeper').eq('subscription_status', 'trial');
    const { count: activeSubscriptions } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_role', 'shopkeeper').eq('subscription_status', 'active');
    const { count: expiredSubscriptions } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_role', 'shopkeeper').eq('subscription_status', 'expired');

    // Subscription revenue
    const { data: paidSubs } = await supabase.from('subscriptions').select('amount').eq('status', 'paid');
    const totalRevenue = paidSubs?.reduce((s, p) => s + p.amount, 0) || 0;

    res.json({
      users: usersCount || 0,
      shopkeepers: shopkeeperCount || 0,
      customers: customerCount || 0,
      activeDebts: activeDebts || 0,
      paidDebts: paidDebts || 0,
      trialUsers: trialUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      expiredSubscriptions: expiredSubscriptions || 0,
      totalRevenue,
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

// Single user details
router.get('/users/:id', async (req, res) => {
  const { data: user } = await supabase.from('users').select('*').eq('id', req.params.id).single();
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { data: debtsAsGiver } = await supabase.from('debts').select('*').eq('giver_id', req.params.id).order('created_at', { ascending: false });
  const { data: debtsAsReceiver } = await supabase.from('debts').select('*').eq('receiver_id', req.params.id).order('created_at', { ascending: false });
  const { data: customers } = await supabase.from('shop_customers').select('*').eq('shop_owner_id', req.params.id);
  res.json({ user, debtsAsGiver: debtsAsGiver || [], debtsAsReceiver: debtsAsReceiver || [], customers: customers || [] });
});

// Manage subscription — activate
router.post('/subscription/activate/:userId', async (req, res) => {
  const { months, amount } = req.body;
  const { data: user } = await supabase.from('users').select('*').eq('id', req.params.userId).single();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (months || 1));

  await supabase.from('users').update({
    subscription_status: 'active',
    subscription_expires_at: expiresAt.toISOString(),
  }).eq('id', user.id);

  await supabase.from('subscriptions').insert({
    user_id: user.id,
    amount: amount || 35000,
    period_months: months || 1,
    status: 'paid',
    paid_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (user.telegram_chat_id) {
    await sendTelegramMessage(user.telegram_chat_id,
      `✅ Obunangiz faollashtirildi!\n\n` +
      `📅 Amal qilish muddati: ${expiresAt.toISOString().split('T')[0]}\n` +
      `💰 To'lov: ${(amount || 35000).toLocaleString()} UZS`
    );
  }
  res.json({ success: true });
});

// Manage subscription — deactivate/expire
router.post('/subscription/expire/:userId', async (req, res) => {
  await supabase.from('users').update({ subscription_status: 'expired' }).eq('id', req.params.userId);
  res.json({ success: true });
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

export default router;
