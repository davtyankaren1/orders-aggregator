ALTER TABLE orders
  ADD COLUMN discount_percent NUMERIC(5, 2),
  ADD COLUMN amount_paid_kop  BIGINT;
