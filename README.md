# Qarz Daftari

Telegram Mini App — Raqamli qarz kelishuvi platformasi.

## Tech Stack
- **Frontend**: React 19 + Vite + TailwindCSS 4
- **Backend**: Node.js + Express + Telegram Bot API
- **Database**: Supabase (PostgreSQL)
- **Deploy**: Railway

## Setup

### 1. Supabase
1. [supabase.com](https://supabase.com) da yangi loyiha yarating
2. SQL Editor da `supabase/migrations/001_init.sql` ni run qiling
3. Project Settings → API dan URL va Service Role Key olding

### 2. Telegram Bot
1. [@BotFather](https://t.me/BotFather) da yangi bot yarating
2. Bot token ni oling
3. Bot Settings → Menu Button → Web App URL ni kiriting (deploy qilgandan keyin)

### 3. Environment Variables
`.env` faylni yarating:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
TELEGRAM_BOT_TOKEN=7xxx:AAHxxx
ADMIN_TELEGRAM_IDS=123456789
APP_URL=https://your-app.railway.app
PORT=3000
NODE_ENV=development
```

### 4. Admin qilish
Supabase SQL Editor da:
```sql
UPDATE users SET is_admin = true WHERE telegram_id = YOUR_TELEGRAM_ID;
```

### 5. Local Development
```bash
npm install
npm run dev
```

### 6. Railway Deploy
1. GitHub ga push qiling
2. Railway da yangi loyiha yarating
3. Environment variablellarni qo'shing
4. Deploy!

## Features
- 📱 Telegram Mini App
- 🤖 Telegram Bot (registratsiya, eslatmalar)
- 💰 Hamyon (topup, send)
- 📊 Admin Panel (statistika, foydalanuvchilar, to'lovlar)
- 📍 Geolokatsiya tracking
- 📏 Masofa kalkulyatori
- ⏰ Qarz eslatmalari (har 5 soatda)
- 🔄 Akkaunt tiklash
- ⭐ Ishonch reytingi
- 🌐 Ko'p tilli (UZ/RU/EN)
