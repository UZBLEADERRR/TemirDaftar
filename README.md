# Temir Daftar

Do'konchilar uchun qarz boshqaruv tizimi — Telegram Mini App

## Biznes Model

| Kim | Nima qiladi | To'lovmi |
|-----|------------|---------|
| **Do'konchi** | Mijozlar qarzini boshqaradi, statistika ko'radi, eslatma yuboradi | Ha — oyiga 35,000 UZS |
| **Mijoz** | O'z qarzini ko'radi, to'lov tarixini tekshiradi | YO'Q — bepul |

## Funksiyalar

### Do'konchi paneli
- 📊 Dashboard — bugungi naqd/qarz, oylik grafik, kechiktirilganlar
- 👥 Mijozlar — ro'yxat, reyting (yashil/sariq/qizil), invite link
- ➕ Qarz/naqd qo'shish — summa, valyuta, muddat
- 📈 Hisobotlar — kunlik/oylik statistika
- 🔔 Eslatma — qo'lda va avtomatik Telegram eslatma
- 👤 Profil — do'kon nomi, kartalar, obuna holati

### Mijoz paneli
- 🏠 Qarzlarim — joriy qarzlar, qolgan kunlar
- 📋 Tarix — to'langan qarzlar
- 🔔 Eslatmalar — kelgan bildirishnomalar
- 👤 Profil — ism, kartalar

### Admin panel
- 📊 Dashboard — foydalanuvchilar, obunalar, qarzlar
- 👥 Foydalanuvchilar — batafsil ko'rish
- 👑 Obuna boshqaruvi — faollashtirish/bekor qilish
- 🔄 Akkaunt tiklash

## Texnologiyalar

- **Frontend:** React 19, Vite, TailwindCSS 4, Recharts
- **Backend:** Node.js, Express, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Bot:** node-telegram-bot-api
- **Deploy:** Railway

## Ishga tushirish

```bash
# Dependencies
npm install

# .env faylni yarating
cp .env.example .env
# TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_TELEGRAM_IDS ni to'ldiring

# Development
npm run dev

# Production build
npm run build
npm start
```

## Environment Variables

```
TELEGRAM_BOT_TOKEN=      # Telegram bot token (@BotFather)
SUPABASE_URL=            # Supabase project URL
SUPABASE_SERVICE_KEY=    # Supabase service role key
ADMIN_TELEGRAM_IDS=      # Vergul bilan admin TG IDlari
APP_URL=                 # Production URL (https://...)
BOT_USERNAME=            # Bot username (@ siz)
PORT=3000
```

## Database Migratsiya

Supabase SQL editor da ketma-ket ishga tushiring:
1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/003_temir_daftar.sql`

## Obuna Tizimi

```
Yangi do'konchi → 7 kun bepul trial
Trial tugadi → Obunani faollashtiring ekrani
Obunasiz: faqat qarzlarni ko'rish mumkin
Obunali: qarz qo'shish, eslatma, statistika
```

## Deploy (Railway)

1. GitHub repo ni ulang
2. Environment variables ni qo'shing
3. Build: `npm run build`
4. Start: `npm start`
