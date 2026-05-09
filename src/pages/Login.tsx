import { useAuth } from '@/components/AuthContext';
import { Navigate } from 'react-router-dom';
import { isTelegramWebApp } from '@/src/lib/telegram';
import { Store, User } from 'lucide-react';

export const Login = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 max-w-md mx-auto">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-zinc-400 text-sm">Yuklanmoqda...</span>
      </div>
    );
  }

  if (user?.is_registered) return <Navigate to="/" />;

  const botUsername = 'qarz_daftari_bot';

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 relative max-w-md mx-auto overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

      <div className="w-full flex-[1] mt-16 relative z-10">
        {/* Logo */}
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/30 rotate-3 hover:rotate-0 transition-transform">
          <span className="text-4xl">📒</span>
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight text-white text-center mb-2">
          Temir Daftar
        </h1>
        <p className="text-center text-zinc-400 font-medium mb-2">
          Do'konchilar uchun qarz boshqaruv tizimi
        </p>
        <p className="text-center text-zinc-600 text-xs mb-8">
          Mijozlar qarzini boshqaring, eslatma yuboring, statistika ko'ring
        </p>

        {!isTelegramWebApp() && (
          <div className="flex flex-col gap-4 px-2">
            {/* Shopkeeper button */}
            <a
              href={`https://t.me/${botUsername}?start=shopkeeper`}
              className="w-full flex items-center gap-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white h-16 px-6 text-lg font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/30"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Store size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold">Men do'konchiman</span>
                <span className="text-xs text-emerald-200 font-normal">Qarzlarni boshqarish</span>
              </div>
            </a>

            {/* Customer info */}
            <div className="w-full flex items-center gap-4 bg-zinc-800/50 backdrop-blur border border-zinc-700 text-zinc-300 h-16 px-6 rounded-2xl">
              <div className="w-10 h-10 bg-zinc-700/50 rounded-xl flex items-center justify-center">
                <User size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-medium text-zinc-200">Men mijozman</span>
                <span className="text-xs text-zinc-500 font-normal">Do'konchi bergan link orqali kiring</span>
              </div>
            </div>
          </div>
        )}

        {user && !user.is_registered && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl mx-2">
            <p className="text-amber-300 text-sm text-center">
              ⚠️ Ro'yxatdan to'liq o'tmagansiz. Telegram botga qaytib ma'lumotlaringizni yuboring.
            </p>
          </div>
        )}
      </div>

      <div className="w-full pb-8 relative z-10">
        <p className="text-center text-zinc-700 text-[10px]">
          Temir Daftar © 2025 • Do'konchilar uchun
        </p>
      </div>
    </div>
  );
};
