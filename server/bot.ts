import TelegramBot from 'node-telegram-bot-api';
import { supabase } from './supabase.js';
import { getOrCreateUser } from './auth.js';

let bot: TelegramBot;

const adminIds = () => (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => parseInt(id.trim()));

export function initBot(): TelegramBot {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  bot = new TelegramBot(token, { polling: true });

  // /start command — Registration flow
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const telegramUser = msg.from!;
    const startParam = (match?.[1] || '').trim();

    try {
      // Check if this is an invite link for customer
      if (startParam.startsWith('invite_')) {
        const inviteCode = startParam.replace('invite_', '');
        await handleCustomerInvite(chatId, telegramUser, inviteCode);
        return;
      }

      // Regular start — shopkeeper flow
      const user = await getOrCreateUser(
        {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
        },
        chatId,
        'shopkeeper'
      );

      // Always update chat_id
      await supabase
        .from('users')
        .update({ telegram_chat_id: chatId })
        .eq('id', user.id);

      if (user.is_registered) {
        // Already registered — show main menu
        const roleLabel = user.user_role === 'shopkeeper' ? '🏪 Do\'konchi' : '👤 Mijoz';
        const shopInfo = user.shop_name ? `\n🏪 Do'kon: ${user.shop_name}` : '';

        await bot.sendMessage(chatId,
          `👋 Salom, ${user.name}!\n\n` +
          `${roleLabel}${shopInfo}\n` +
          `⭐ Ishonch bali: ${user.score || 0}\n\n` +
          `📱 Ilovani ochish uchun pastdagi tugmani bosing:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📱 Ilovani ochish', web_app: { url: appUrl } }
              ]],
            }
          }
        );
      } else {
        // New user — ask for phone number (shopkeeper registration)
        await bot.sendMessage(chatId,
          `🎉 Temir Daftar ga xush kelibsiz!\n\n` +
          `🏪 Do'konchilar uchun qarz boshqaruv tizimi\n\n` +
          `📝 Ro'yxatdan o'tish uchun telefon raqamingizni yuboring.\n\n` +
          `Pastdagi "📱 Telefon raqamni yuborish" tugmasini bosing:`,
          {
            reply_markup: {
              keyboard: [[
                { text: '📱 Telefon raqamni yuborish', request_contact: true }
              ]],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
      }
    } catch (err) {
      console.error('Error in /start:', err);
      await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.');
    }
  });

  // Handle contact sharing (phone number) — Shopkeeper registration
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const contact = msg.contact!;

    if (contact.user_id !== msg.from!.id) {
      await bot.sendMessage(chatId, '⚠️ Iltimos, o\'zingizning telefon raqamingizni yuboring.');
      return;
    }

    try {
      const phone = contact.phone_number;

      // Check if this is a customer (already has user_role = customer)
      const { data: existingUser } = await supabase
        .from('users')
        .select('user_role')
        .eq('telegram_id', msg.from!.id)
        .single();

      if (existingUser?.user_role === 'customer') {
        // Customer registration — just save phone and name
        await supabase
          .from('users')
          .update({ phone })
          .eq('telegram_id', msg.from!.id);

        await bot.sendMessage(chatId,
          `✅ Telefon raqam saqlandi: ${phone}\n\n` +
          `👤 Endi ismingizni kiriting:`,
          { reply_markup: { remove_keyboard: true } }
        );

        const nameListener = async (nameMsg: TelegramBot.Message) => {
          if (nameMsg.chat.id !== chatId || !nameMsg.text || nameMsg.text.startsWith('/')) return;
          bot.removeListener('message', nameListener);

          const name = nameMsg.text.trim();
          await supabase
            .from('users')
            .update({ name, is_registered: true })
            .eq('telegram_id', msg.from!.id);

          // Update shop_customers record
          const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('telegram_id', msg.from!.id)
            .single();

          if (user) {
            await supabase
              .from('shop_customers')
              .update({ customer_name: name, customer_phone: phone })
              .eq('customer_id', user.id);
          }

          const appUrl = process.env.APP_URL || 'http://localhost:3000';
          await bot.sendMessage(chatId,
            `🎉 Ro'yxatdan o'tdingiz, ${name}!\n\n` +
            `📱 Qarzlaringizni ko'rish uchun pastdagi tugmani bosing:`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '📱 Ilovani ochish', web_app: { url: appUrl } }
                ]],
              }
            }
          );
        };

        bot.on('message', nameListener);
        setTimeout(() => bot.removeListener('message', nameListener), 5 * 60 * 1000);
        return;
      }

      // Shopkeeper registration
      await supabase
        .from('users')
        .update({ phone })
        .eq('telegram_id', msg.from!.id);

      await bot.sendMessage(chatId,
        `✅ Telefon raqam saqlandi: ${phone}\n\n` +
        `👤 Endi ismingizni kiriting:`,
        { reply_markup: { remove_keyboard: true } }
      );

      // Set a listener for the next text message as name
      const nameListener = async (nameMsg: TelegramBot.Message) => {
        if (nameMsg.chat.id !== chatId || !nameMsg.text || nameMsg.text.startsWith('/')) return;

        bot.removeListener('message', nameListener);

        const name = nameMsg.text.trim();
        await supabase
          .from('users')
          .update({ name })
          .eq('telegram_id', msg.from!.id);

        // Ask for shop name
        await bot.sendMessage(chatId,
          `👤 ${name}, endi do'koningiz nomini kiriting:\n\n` +
          `Masalan: "Baraka savdo", "Oltin bozor"`,
        );

        const shopNameListener = async (shopMsg: TelegramBot.Message) => {
          if (shopMsg.chat.id !== chatId || !shopMsg.text || shopMsg.text.startsWith('/')) return;

          bot.removeListener('message', shopNameListener);

          const shopName = shopMsg.text.trim();
          await supabase
            .from('users')
            .update({
              shop_name: shopName,
              is_registered: true,
              subscription_status: 'trial',
              trial_started_at: new Date().toISOString(),
            })
            .eq('telegram_id', msg.from!.id);

          // Notify admin
          const admins = adminIds();
          for (const adminId of admins) {
            try {
              await bot.sendMessage(adminId,
                `🏪 Yangi do'konchi ro'yxatdan o'tdi:\n\n` +
                `📛 Ism: ${name}\n` +
                `🏪 Do'kon: ${shopName}\n` +
                `📱 Tel: ${phone}\n` +
                `🆔 Telegram ID: ${msg.from!.id}`
              );
            } catch {}
          }

          const appUrl = process.env.APP_URL || 'http://localhost:3000';
          await bot.sendMessage(chatId,
            `🎉 Ro'yxatdan o'tdingiz, ${name}!\n\n` +
            `🏪 Do'kon: ${shopName}\n` +
            `🎁 7 kunlik bepul sinov muddati boshlandi!\n\n` +
            `📱 Ilovani ochish uchun pastdagi tugmani bosing:`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '📱 Ilovani ochish', web_app: { url: appUrl } }
                ]],
              }
            }
          );
        };

        bot.on('message', shopNameListener);
        setTimeout(() => bot.removeListener('message', shopNameListener), 5 * 60 * 1000);
      };

      bot.on('message', nameListener);

      // Auto-remove listener after 5 minutes
      setTimeout(() => bot.removeListener('message', nameListener), 5 * 60 * 1000);

    } catch (err) {
      console.error('Error handling contact:', err);
      await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.');
    }
  });

  console.log('🤖 Telegram bot ishga tushdi');
  return bot;
}

/**
 * Handle customer invite link: /start invite_XXXX
 */
async function handleCustomerInvite(chatId: number, telegramUser: TelegramBot.User, inviteCode: string) {
  try {
    // Find the shop_customer record with this invite code
    const { data: shopCustomer } = await supabase
      .from('shop_customers')
      .select('*, shop_owner:shop_owner_id(name, shop_name)')
      .eq('invite_code', inviteCode)
      .single();

    if (!shopCustomer) {
      await bot.sendMessage(chatId, '❌ Noto\'g\'ri havola. Do\'konchingizdan yangi havola so\'rang.');
      return;
    }

    // Get or create user as customer
    const user = await getOrCreateUser(
      {
        id: telegramUser.id,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        username: telegramUser.username,
      },
      chatId,
      'customer'
    );

    // Update user role to customer and link to shop
    await supabase
      .from('users')
      .update({
        telegram_chat_id: chatId,
        user_role: 'customer',
        shop_owner_id: shopCustomer.shop_owner_id,
      })
      .eq('id', user.id);

    // Link customer to shop_customers record
    await supabase
      .from('shop_customers')
      .update({ customer_id: user.id })
      .eq('id', shopCustomer.id);

    const shopName = (shopCustomer as any).shop_owner?.shop_name || 'Do\'kon';
    const shopOwnerName = (shopCustomer as any).shop_owner?.name || '';

    if (user.is_registered) {
      // Already registered — just show app
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      await bot.sendMessage(chatId,
        `👋 Salom, ${user.name}!\n\n` +
        `🏪 ${shopName} do'koniga ulandingiz.\n\n` +
        `📱 Qarzlaringizni ko'rish uchun pastdagi tugmani bosing:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Qarzlarimni ko\'rish', web_app: { url: appUrl } }
            ]],
          }
        }
      );
    } else {
      // New customer — ask for phone
      await bot.sendMessage(chatId,
        `🎉 ${shopName} do'koniga xush kelibsiz!\n\n` +
        `📝 Ro'yxatdan o'tish uchun telefon raqamingizni yuboring:`,
        {
          reply_markup: {
            keyboard: [[
              { text: '📱 Telefon raqamni yuborish', request_contact: true }
            ]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    }
  } catch (err) {
    console.error('Error handling invite:', err);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.');
  }
}

export function getBot(): TelegramBot {
  return bot;
}

/**
 * Send message to user via Telegram bot
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: TelegramBot.SendMessageOptions
): Promise<void> {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...options });
  } catch (err) {
    console.error(`Failed to send message to ${chatId}:`, err);
  }
}

/**
 * Notify admin about an event
 */
export async function notifyAdmins(text: string): Promise<void> {
  const admins = adminIds();
  for (const adminId of admins) {
    await sendTelegramMessage(adminId, text);
  }
}

/**
 * Create in-app notification AND send Telegram message
 */
export async function createNotification(
  userId: string,
  telegramChatId: number | null,
  title: string,
  message: string
): Promise<void> {
  // Save to DB
  try {
    await supabase.from('notifications').insert({ user_id: userId, title, message });
  } catch (err) {
    console.error('Failed to save notification:', err);
  }
  // Send Telegram message
  if (telegramChatId) {
    await sendTelegramMessage(telegramChatId, `🔔 <b>${title}</b>\n${message}`);
  }
}

/**
 * Send debt reminder to customer via Telegram
 */
export async function sendDebtReminder(
  debtId: string,
  shopOwnerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: debt } = await supabase
      .from('debts')
      .select('id, amount, currency, due_date, receiver_id, receiver_name')
      .eq('id', debtId)
      .single();

    if (!debt) return { success: false, error: 'Qarz topilmadi' };

    const { data: shopOwner } = await supabase
      .from('users')
      .select('name, shop_name')
      .eq('id', shopOwnerId)
      .single();

    if (!shopOwner) return { success: false, error: 'Do\'konchi topilmadi' };

    // Find customer
    let customerChatId: number | null = null;
    let customerName = debt.receiver_name || 'Mijoz';

    if (debt.receiver_id) {
      const { data: customer } = await supabase
        .from('users')
        .select('telegram_chat_id, name')
        .eq('id', debt.receiver_id)
        .single();

      if (customer) {
        customerChatId = customer.telegram_chat_id;
        customerName = customer.name;
      }
    }

    if (!customerChatId) {
      return { success: false, error: 'Mijozning Telegram raqami topilmadi' };
    }

    const shopName = shopOwner.shop_name || shopOwner.name;
    const formattedAmount = debt.amount.toLocaleString();
    const dueDate = debt.due_date;

    await sendTelegramMessage(customerChatId,
      `Assalomu alaykum, ${customerName}! ` +
      `${shopName} dan eslatma: ${formattedAmount} ${debt.currency} lik qarzingiz ` +
      `muddati ${dueDate} ga to'g'ri keladi. Iltimos, vaqtida to'lang.`
    );

    // Update last_reminder_at
    await supabase
      .from('debts')
      .update({ last_reminder_at: new Date().toISOString() })
      .eq('id', debtId);

    return { success: true };
  } catch (err: any) {
    console.error('Error sending reminder:', err);
    return { success: false, error: err.message };
  }
}
