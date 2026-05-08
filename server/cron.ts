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
      .select('id, amount, currency, due_date, receiver_id, giver_id')
      .eq('status', 'overdue')
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${cutoff}`);

    if (!debts || debts.length === 0) return;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    for (const debt of debts) {
      if (!debt.receiver_id) continue;
      const { data: receiver } = await supabase
        .from('users').select('telegram_chat_id, name').eq('id', debt.receiver_id).single();
      const { data: giver } = await supabase
        .from('users').select('name').eq('id', debt.giver_id).single();

      if (receiver?.telegram_chat_id) {
        await sendTelegramMessage(receiver.telegram_chat_id,
          `🔴 <b>Qarz muddati o'tgan!</b>\n\n` +
          `💰 Summa: <b>${debt.amount.toLocaleString()} ${debt.currency}</b>\n` +
          `👤 Kimga: ${giver?.name || '?'}\n` +
          `📅 Muddat: ${debt.due_date}\n\n` +
          `❗ Iltimos, imkon qadar tezroq to'lang.`,
          { reply_markup: { inline_keyboard: [[{ text: '💳 Qarzni to\'lash', web_app: { url: `${appUrl}?debt=${debt.id}` } }]] } }
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
      .select('id, amount, currency, due_date, receiver_id, giver_id')
      .in('status', ['active', 'pending'])
      .eq('due_date', tomorrowStr);

    if (!debts || debts.length === 0) return;
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    for (const debt of debts) {
      if (!debt.receiver_id) continue;
      const { data: receiver } = await supabase
        .from('users').select('telegram_chat_id, name').eq('id', debt.receiver_id).single();
      const { data: giver } = await supabase
        .from('users').select('name').eq('id', debt.giver_id).single();

      if (receiver?.telegram_chat_id) {
        await sendTelegramMessage(receiver.telegram_chat_id,
          `⚠️ <b>Qarz muddati tugashiga 1 kun qoldi!</b>\n\n` +
          `💰 Summa: <b>${debt.amount.toLocaleString()} ${debt.currency}</b>\n` +
          `👤 Kimga: ${giver?.name || '?'}\n` +
          `📅 Muddat: ${debt.due_date}\n\n` +
          `⏰ Ertaga muddati tugaydi. Vaqtida to'lang!`,
          { reply_markup: { inline_keyboard: [[{ text: '💳 Qarzni to\'lash', web_app: { url: `${appUrl}?debt=${debt.id}` } }]] } }
        );
      }
    }
    console.log(`⚠️ ${debts.length} ta "1 kun qoldi" ogohlantirish yuborildi`);
  } catch (err) { console.error('Error sending expiring warnings:', err); }
}
