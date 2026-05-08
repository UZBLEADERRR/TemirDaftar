/**
 * Telegram WebApp helpers for Mini App integration
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        };
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        themeParams: Record<string, string>;
        colorScheme: 'light' | 'dark';
        platform: string;
        version: string;
      };
    };
  }
}

export function isTelegramWebApp(): boolean {
  return !!window.Telegram?.WebApp?.initData;
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

export function getTelegramUser() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

export function getInitData(): string {
  return window.Telegram?.WebApp?.initData || '';
}

export function getStartParam(): string | undefined {
  return window.Telegram?.WebApp?.initDataUnsafe?.start_param;
}

export function hapticFeedback(type: 'light' | 'medium' | 'heavy' = 'light') {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);
  } catch {}
}

export function hapticSuccess() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  } catch {}
}

export function hapticError() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
  } catch {}
}

export function initTelegramApp() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }
}

/**
 * Helper to make authenticated API calls with Telegram initData
 */
export async function apiCall(url: string, options: RequestInit = {}): Promise<any> {
  const initData = getInitData();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  } else if (import.meta.env.DEV) {
    // Dev mode: use a mock telegram ID
    headers['X-Dev-Telegram-Id'] = '123456789';
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
