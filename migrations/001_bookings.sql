CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_reference text NOT NULL UNIQUE,
    idempotency_key text NOT NULL UNIQUE,
    status text NOT NULL,
    arrival date NOT NULL,
    departure date NOT NULL,
    stay daterange GENERATED ALWAYS AS (daterange(arrival, departure, '[)')) STORED,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    language text NOT NULL DEFAULT 'en',
    adults integer NOT NULL,
    children integer NOT NULL DEFAULT 0,
    guests integer NOT NULL,
    nights integer NOT NULL,
    season text NOT NULL,
    payment_stage text NOT NULL,
    currency text NOT NULL DEFAULT 'gbp',
    stay_total_pence integer NOT NULL,
    amount_due_now_pence integer NOT NULL,
    balance_due_later_pence integer NOT NULL,
    damage_deposit_pence integer NOT NULL,
    tourist_tax_eur_cents integer NOT NULL,
    hold_expires_at timestamptz,
    stripe_checkout_session_id text UNIQUE,
    stripe_payment_intent_id text,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (departure > arrival),
    CHECK (adults >= 1),
    CHECK (children >= 0),
    CHECK (guests = adults + children),
    CHECK (amount_due_now_pence > 0)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_active_overlap') THEN
        ALTER TABLE bookings
            ADD CONSTRAINT bookings_no_active_overlap
            EXCLUDE USING gist (stay WITH &&)
            WHERE (status IN ('creating_checkout', 'pending_payment', 'paid', 'blocked'));
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS bookings_status_dates_idx ON bookings (status, arrival, departure);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    attempts integer NOT NULL DEFAULT 1,
    last_attempt_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    last_error text
);

CREATE TABLE IF NOT EXISTS email_deliveries (
    id bigserial PRIMARY KEY,
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    kind text NOT NULL,
    status text NOT NULL,
    attempts integer NOT NULL DEFAULT 1,
    provider_id text,
    last_error text,
    sent_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (booking_id, kind)
);
