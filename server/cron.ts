import cron from 'node-cron';
import { supabase } from './supabase.js';
import { sendTelegramMessage } from './bot.js';

export function initCronJobs(): void {
  // Every hour — check and mark overdue debts
  cron.schedule('0 * * * *', async () => {
    await markOverdueDebts();
  });

  // Every 5 hours — send reminders for OVERDUE debts (only after deadline passed)
  cron.schedule('0 */5 * * *', async () => {
    console.log('⏰ Checking overdue debts for reminders...');
    await sendOverdueReminders();
  });

  // Every day at 09:00 — send "1 kun qoldi" warning for debts expiring tomorrow
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Checking debts expiring tomorrow...');
    await sendExpiringWarnings();
  });

  // Every day at 00:05 — check subscription expirations
  cron.schedule('5 0 * * *', async () => {
    console.log('⏰ Checking subscription expirations...');
    await checkSubscriptionExpirations();
  });

  console.log('⏰ Cron joblar ishga tushdi');
}

async function markOverdueDebts(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: debts } = await supabase
      .from('debts').select('id')
      .in('status', ['pending', 'active']).lt('due_date', today);

    if (debts && debts.length > 0) {
      await supabase.from('debts')
        .update({ status: 'overdue', updated_at: new Date().toISOString() })
        .in('id', debts.map(d => d.id));
      console.log(`📌 ${debts.length} ta qarz overdue deb belgilandi`);
    }
  } catch (err) { console.error('Error marking overdue:', err); }
}

/**
 * Send reminders for debts that are ALREADY overdue (past due date)
 * Runs every 5 hours
 */
async function sendOverdueReminders(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const { data: debts } = await supabase
      .from('debts')
      .select('id, amount, currency, due_date, receiver_id, giver_id, shop_owner_id')
      .eq('status', 'overdue')
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`);

    if (!debts || debts.length === 0) return;

    for (const debt of debts) {
      if (!debt.receiver_id) continue;
      const { data: receiver } = await supabase
        .from('users').select('telegram_chat_id, name').eq('id', debt.receiver_id).single();

      // Get shop info
      const shopOwnerId = debt.shop_owner_id || debt.giver_id;
      const { data: shopOwner } = await supabase
        .from('users').select('name, shop_name').eq('id', shopOwnerId).single();

      const shopName = shopOwner?.shop_name || shopOwner?.name || 'Do\'kon';

      if (receiver?.telegram_chat_id) {
        await sendTelegramMessage(receiver.telegram_chat_id,
          `🔴 <b>Qarz muddati o'tgan!</b>\n\n` +
          `🏪 ${shopName}\n` +
          `💰 Summa: <b>${debt.amount.toLocaleString()} ${debt.currency}</b>\n` +
          `📅 Muddat: ${debt.due_date}\n\n` +
          `❗ Iltimos, imkon qadar tezroq to'lang.`
        );
      }
      await supabase.from('debts').update({ last_reminder_at: new Date().toISOString() }).eq('id', debt.id);
    }
    console.log(`📨 ${debts.length} ta overdue eslatma yuborildi`);
  } catch (err) { console.error('Error sending overdue reminders:', err); }
}

/**
 * Send "1 kun qoldi" warning for debts expiring TOMORROW
 * Runs once daily at 09:00
 */
async function sendExpiringWarnings(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: debts } = await supabase
      .from('debts')
      .select('id, amount, currency, due_date, receiver_id, giver_id, shop_owner_id')
      .in('status', ['active', 'pending'])
      .eq('due_date', tomorrowStr);

    if (!debts || debts.length === 0) return;

    for (const debt of debts) {
      if (!debt.receiver_id) continue;
      const { data: receiver } = await supabase
        .from('users').select('telegram_chat_id, name').eq('id', debt.receiver_id).single();

      const shopOwnerId = debt.shop_owner_id || debt.giver_id;
      const { data: shopOwner } = await supabase
        .from('users').select('name, shop_name').eq('id', shopOwnerId).single();

      const shopName = shopOwner?.shop_name || shopOwner?.name || 'Do\'kon';

      if (receiver?.telegram_chat_id) {
        await sendTelegramMessage(receiver.telegram_chat_id,
          `Assalomu alaykum, ${receiver.name}! ` +
          `${shopName} dan eslatma: ${debt.amount.toLocaleString()} ${debt.currency} lik qarzingiz ` +
          `muddati ${debt.due_date} ga to'g'ri keladi. Iltimos, vaqtida to'lang.`
        );
      }
    }
    console.log(`⚠️ ${debts.length} ta "1 kun qoldi" ogohlantirish yuborildi`);
  } catch (err) { console.error('Error sending expiring warnings:', err); }
}

/**
 * Check and expire subscriptions that have passed their expiration date
 * Runs daily at 00:05
 */
async function checkSubscriptionExpirations(): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Find active subscriptions that have expired
    const { data: expired } = await supabase
      .from('users')
      .select('id, name, telegram_chat_id')
      .eq('user_role', 'shopkeeper')
      .eq('subscription_status', 'active')
      .lt('subscription_expires_at', now);

    if (!expired || expired.length === 0) return;

    for (const user of expired) {
      await supabase.from('users').update({ subscription_status: 'expired' }).eq('id', user.id);

      if (user.telegram_chat_id) {
        await sendTelegramMessage(user.telegram_chat_id,
          `⚠️ <b>Obuna muddati tugadi!</b>\n\n` +
          `Yangi qarz qo'shish va eslatma yuborish imkoniyatlari bloklanadi.\n\n` +
          `Obunani yangilash uchun ilovani oching.`
        );
      }
    }

    // Also check trial users (7 days since trial_started_at)
    const trialCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: trialExpired } = await supabase
      .from('users')
      .select('id, name, telegram_chat_id')
      .eq('user_role', 'shopkeeper')
      .eq('subscription_status', 'trial')
      .lt('trial_started_at', trialCutoff);

    if (trialExpired && trialExpired.length > 0) {
      for (const user of trialExpired) {
        await supabase.from('users').update({ subscription_status: 'expired' }).eq('id', user.id);

        if (user.telegram_chat_id) {
          await sendTelegramMessage(user.telegram_chat_id,
            `⏰ <b>7 kunlik bepul sinov muddati tugadi!</b>\n\n` +
            `Temir Daftar dan foydalanishni davom ettirish uchun obunani faollashtiring.\n\n` +
            `📱 Ilovani oching va obuna bo'ling.`
          );
        }
      }
    }

    console.log(`📋 ${(expired?.length || 0) + (trialExpired?.length || 0)} ta obuna expired qilindi`);
  } catch (err) { console.error('Error checking subscriptions:', err); }
}
