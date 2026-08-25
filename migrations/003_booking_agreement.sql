ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS agreement_version text,
    ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz,
    ADD COLUMN IF NOT EXISTS agreement_snapshot jsonb;
