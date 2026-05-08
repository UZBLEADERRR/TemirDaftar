import { useAuth } from '@/components/AuthContext';
import { Navigate } from 'react-router-dom';
import { isTelegramWebApp } from '@/src/lib/telegram';

export const Login = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-zinc-400 text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  if (user?.is_registered) return <Navigate to="/" />;

  const botUsername = 'qarz_daftari_bot'; // TODO: update with real bot username

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 relative max-w-md mx-auto overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>

      <div className="w-full flex-[1] mt-24 relative z-10">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/30">
          <span className="text-3xl">📒</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white text-center mb-2">
          Qarz Daftari
        </h1>
        <p className="text-center text-zinc-400 font-medium mb-4">
          Raqamli qarz kelishuvi platformasi
        </p>

        {!isTelegramWebApp() && (
          <div className="mt-8 p-4 bg-zinc-800/50 backdrop-blur border border-zinc-700 rounded-2xl">
            <p className="text-zinc-300 text-sm text-center mb-3">
              Bu ilova faqat Telegram ichida ishlaydi
            </p>
            <p className="text-zinc-500 text-xs text-center">
              Telegram bot orqali ro'yxatdan o'ting:
            </p>
          </div>
        )}

        {user && !user.is_registered && (
          <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
            <p className="text-amber-300 text-sm text-center">
              ⚠️ Ro'yxatdan to'liq o'tmagansiz. Telegram botga qaytib telefon raqam va ism yuboring.
            </p>
          </div>
        )}
      </div>

      <div className="w-full pb-12 flex flex-col gap-4 relative z-10">
        {!isTelegramWebApp() && (
          <a
            href={`https://t.me/${botUsername}?start=login`}
            className="w-full flex items-center justify-center bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white h-14 text-lg font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
          >
            🤖 Telegram Bot orqali kirish
          </a>
        )}
        <p className="text-center text-zinc-600 text-xs">
          Kirish orqali siz foydalanish shartlariga rozilik bildirasiz
        </p>
      </div>
    </div>
  );
};
