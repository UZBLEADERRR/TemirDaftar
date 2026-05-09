-- TEMIR DAFTAR
-- TEMIR DAFTAR — Migration: Shopkeeper/Customer Model
-- TEMIR DAFTAR

-- 1. Users jadvaliga yangi ustunlar
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'shopkeeper' 
  CHECK (user_role IN ('shopkeeper', 'customer'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_name TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_owner_id UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial' 
  CHECK (subscription_status IN ('trial', 'active', 'expired'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 2. Do'konchi-mijoz aloqasi
CREATE TABLE IF NOT EXISTS shop_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT DEFAULT '',
  invite_code TEXT UNIQUE,
  rating TEXT DEFAULT 'green' CHECK (rating IN ('green', 'yellow', 'red')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Savdo (sales) jadvali — naqd vs qarzga statistika uchun
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID,
  debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'UZS',
  sale_type TEXT NOT NULL CHECK (sale_type IN ('cash', 'debt')),
  product_note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Obuna to'lovlari
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  period_months INTEGER DEFAULT 1,
  payment_method TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Debts jadvaliga do'kon bilan bog'lash
ALTER TABLE debts ADD COLUMN IF NOT EXISTS shop_owner_id UUID REFERENCES users(id);
ALTER TABLE debts ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'debt' CHECK (sale_type IN ('cash', 'debt'));

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_shop_customers_owner ON shop_customers(shop_owner_id);
CREATE INDEX IF NOT EXISTS idx_shop_customers_customer ON shop_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_customers_invite ON shop_customers(invite_code);
CREATE INDEX IF NOT EXISTS idx_sales_owner ON sales(shop_owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(sale_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_shop_owner ON debts(shop_owner_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_shop_owner ON users(shop_owner_id);

-- 7. RLS
ALTER TABLE shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON shop_customers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON sales FOR ALL USING (true);
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (true);
