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
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramUser = msg.from!;

    try {
      const user = await getOrCreateUser(
        {
          id: telegramUser.id,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          username: telegramUser.username,
        },
        chatId
      );

      // Always update chat_id
      await supabase
        .from('users')
        .update({ telegram_chat_id: chatId })
        .eq('id', user.id);

      if (user.is_registered) {
        // Already registered — show main menu
        await bot.sendMessage(chatId,
          `👋 Salom, ${user.name}!\n\n` +
          `💰 Balans: ${(user.wallet_balance || 0).toLocaleString()} UZS\n` +
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
        // New user — ask for phone number
        await bot.sendMessage(chatId,
          `🎉 Qarz Daftari ga xush kelibsiz!\n\n` +
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

  // Handle contact sharing (phone number)
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const contact = msg.contact!;

    if (contact.user_id !== msg.from!.id) {
      await bot.sendMessage(chatId, '⚠️ Iltimos, o\'zingizning telefon raqamingizni yuboring.');
      return;
    }

    try {
      const phone = contact.phone_number;

      // Update user phone
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
          .update({ name, is_registered: true })
          .eq('telegram_id', msg.from!.id);

        // Notify admin
        const admins = adminIds();
        for (const adminId of admins) {
          try {
            await bot.sendMessage(adminId,
              `👤 Yangi foydalanuvchi ro'yxatdan o'tdi:\n\n` +
              `📛 Ism: ${name}\n` +
              `📱 Tel: ${phone}\n` +
              `🆔 Telegram ID: ${msg.from!.id}`
            );
          } catch {}
        }

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        await bot.sendMessage(chatId,
          `🎉 Ro'yxatdan o'tdingiz, ${name}!\n\n` +
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
