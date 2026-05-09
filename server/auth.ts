import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { supabase } from './supabase.js';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface AuthenticatedRequest extends Request {
  telegramUser?: TelegramUser;
  dbUser?: any;
}

/**
 * Validate Telegram WebApp initData using HMAC-SHA256
 */
export function validateInitData(initData: string, botToken: string): TelegramUser | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const entries = Array.from(params.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    return JSON.parse(userStr) as TelegramUser;
  } catch {
    return null;
  }
}

/**
 * Express middleware: Authenticate requests via Telegram initData
 */
export function telegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const initData = req.headers['x-telegram-init-data'] as string;

  if (!initData) {
    // Dev mode fallback: check for x-dev-telegram-id header
    if (process.env.NODE_ENV === 'development') {
      const devId = req.headers['x-dev-telegram-id'] as string;
      if (devId) {
        req.telegramUser = {
          id: parseInt(devId),
          first_name: 'Dev User'
        };
        next();
        return;
      }
    }
    res.status(401).json({ error: 'Missing Telegram auth data' });
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const user = validateInitData(initData, botToken);

  if (!user) {
    res.status(401).json({ error: 'Invalid Telegram auth data' });
    return;
  }

  req.telegramUser = user;
  next();
}

/**
 * Middleware: Require admin access
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => parseInt(id.trim()));

  if (!req.telegramUser || !adminIds.includes(req.telegramUser.id)) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

/**
 * Middleware: Require shopkeeper role
 */
export async function requireShopkeeper(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.telegramUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, user_role, subscription_status, trial_started_at, subscription_expires_at')
    .eq('telegram_id', req.telegramUser.id)
    .single();

  if (!user || user.user_role !== 'shopkeeper') {
    res.status(403).json({ error: 'Shopkeeper access required' });
    return;
  }

  req.dbUser = user;
  next();
}

/**
 * Middleware: Check shopkeeper subscription (blocks features if expired)
 */
export async function requireActiveSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.telegramUser) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, user_role, subscription_status, trial_started_at, subscription_expires_at')
    .eq('telegram_id', req.telegramUser.id)
    .single();

  if (!user || user.user_role !== 'shopkeeper') {
    res.status(403).json({ error: 'Shopkeeper access required' });
    return;
  }

  // Check trial period (7 days)
  if (user.subscription_status === 'trial') {
    const trialStart = new Date(user.trial_started_at);
    const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > trialEnd) {
      // Trial expired — update status
      await supabase.from('users').update({ subscription_status: 'expired' }).eq('id', user.id);
      res.status(403).json({ error: 'subscription_expired', message: 'Bepul sinov muddati tugadi. Obunani faollashtiring.' });
      return;
    }
  } else if (user.subscription_status === 'expired') {
    res.status(403).json({ error: 'subscription_expired', message: 'Obuna muddati tugagan. Obunani yangilang.' });
    return;
  } else if (user.subscription_status === 'active') {
    // Check if subscription has expired
    if (user.subscription_expires_at && new Date() > new Date(user.subscription_expires_at)) {
      await supabase.from('users').update({ subscription_status: 'expired' }).eq('id', user.id);
      res.status(403).json({ error: 'subscription_expired', message: 'Obuna muddati tugagan. Obunani yangilang.' });
      return;
    }
  }

  req.dbUser = user;
  next();
}

/**
 * Get or create user in DB from Telegram user
 */
export async function getOrCreateUser(telegramUser: TelegramUser, chatId?: number, role?: string) {
  // Try to find existing user
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (existing) {
    // Update chat_id if provided
    if (chatId && !existing.telegram_chat_id) {
      await supabase
        .from('users')
        .update({ telegram_chat_id: chatId })
        .eq('id', existing.id);
    }
    return existing;
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramUser.id,
      telegram_chat_id: chatId || null,
      name: `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`,
      is_registered: false,
      user_role: role || 'shopkeeper',
      trial_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return newUser;
}
