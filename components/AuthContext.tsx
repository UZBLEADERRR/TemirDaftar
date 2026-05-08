import React, { createContext, useContext, useEffect, useState } from 'react';
import { getTelegramUser, initTelegramApp, apiCall, isTelegramWebApp } from '@/src/lib/telegram';
import { trackLocation } from '@/src/lib/geolocation';

interface User {
  id: string;
  telegram_id: number;
  name: string;
  phone: string;
  wallet_balance: number;
  score: number;
  cards: string[];
  is_admin: boolean;
  is_registered: boolean;
  last_location: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, refreshUser: async () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await apiCall('/api/me');
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initTelegramApp();

    const tgUser = getTelegramUser();
    if (tgUser || import.meta.env.DEV) {
      fetchUser().then((u) => {
        // Track location on each app launch
        if (u) {
          trackLocation().catch(() => {});
        }
      });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
