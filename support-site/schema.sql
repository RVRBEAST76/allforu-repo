CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('razorpay', 'bmc', 'manual')),
  amount_usd REAL NOT NULL CHECK (amount_usd >= 0),
  amount_display TEXT NOT NULL,
  currency TEXT NOT NULL,
  donor_name TEXT NOT NULL DEFAULT 'Supporter',
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  month TEXT NOT NULL,
  refunded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_month_created
  ON payments (month, created_at DESC);
