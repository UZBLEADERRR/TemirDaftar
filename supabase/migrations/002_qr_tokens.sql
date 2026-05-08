-- Add qr_token to debts for one-time QR scanning
ALTER TABLE debts ADD COLUMN IF NOT EXISTS qr_token UUID DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_debts_qr_token ON debts(qr_token);

-- Add payment_qr_token for one-time payment QR
ALTER TABLE debts ADD COLUMN IF NOT EXISTS payment_qr_token UUID DEFAULT NULL;
