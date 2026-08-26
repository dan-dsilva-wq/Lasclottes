ALTER TABLE email_deliveries
    ADD COLUMN IF NOT EXISTS send_generation integer NOT NULL DEFAULT 1;
