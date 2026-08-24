'use strict';

const { config } = require('./config');
const { toMinorUnits } = require('./booking');

class DatabaseUnavailableError extends Error {
    constructor(message = 'The booking database is not configured.') {
        super(message);
        this.name = 'DatabaseUnavailableError';
    }
}

class BookingConflictError extends Error {
    constructor() {
        super('Those dates have just become unavailable. Please choose different dates.');
        this.name = 'BookingConflictError';
        this.code = 'dates_unavailable';
    }
}

let sqlPromise;
let schemaPromise;

const getSql = async () => {
    const databaseUrl = config.databaseUrl();
    if (!databaseUrl) throw new DatabaseUnavailableError();
    if (!sqlPromise) {
        sqlPromise = import('@neondatabase/serverless').then(({ neon }) => neon(databaseUrl));
    }
    return sqlPromise;
};

const runSchema = async () => {
    const sql = await getSql();
    await sql`
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
        )
    `;
    await sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_active_overlap'
            ) THEN
                ALTER TABLE bookings
                    ADD CONSTRAINT bookings_no_active_overlap
                    EXCLUDE USING gist (stay WITH &&)
                    WHERE (status IN ('creating_checkout', 'pending_payment', 'paid', 'blocked'));
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS bookings_status_dates_idx
            ON bookings (status, arrival, departure)
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
            event_id text PRIMARY KEY,
            event_type text NOT NULL,
            attempts integer NOT NULL DEFAULT 1,
            last_attempt_at timestamptz NOT NULL DEFAULT now(),
            processed_at timestamptz,
            last_error text
        )
    `;
    await sql`
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
        )
    `;
};

const ensureSchema = async () => {
    if (!schemaPromise) {
        schemaPromise = runSchema().catch((error) => {
            schemaPromise = undefined;
            throw error;
        });
    }
    return schemaPromise;
};

const expireOldHolds = async () => {
    await ensureSchema();
    const sql = await getSql();
    await sql`
        UPDATE bookings
        SET status = 'expired', updated_at = now()
        WHERE status IN ('creating_checkout', 'pending_payment')
          AND hold_expires_at IS NOT NULL
          AND hold_expires_at <= now()
    `;
};

const getBookingByIdempotencyKey = async (idempotencyKey) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        SELECT * FROM bookings WHERE idempotency_key = ${idempotencyKey} LIMIT 1
    `;
    return rows[0] || null;
};

const createBookingHold = async ({ quote, contact, idempotencyKey, publicReference, holdMinutes = 40 }) => {
    await expireOldHolds();
    const sql = await getSql();
    try {
        const rows = await sql`
            INSERT INTO bookings (
                public_reference, idempotency_key, status, arrival, departure,
                first_name, last_name, email, phone, language,
                adults, children, guests, nights, season, payment_stage,
                stay_total_pence, amount_due_now_pence, balance_due_later_pence,
                damage_deposit_pence, tourist_tax_eur_cents, hold_expires_at
            ) VALUES (
                ${publicReference}, ${idempotencyKey}, 'creating_checkout',
                ${quote.arrivalDate}, ${quote.departureDate},
                ${contact.firstName}, ${contact.lastName}, ${contact.email}, ${contact.phone}, ${contact.lang},
                ${quote.adults}, ${quote.children}, ${quote.guests}, ${quote.nights},
                ${quote.season}, ${quote.paymentStage},
                ${toMinorUnits(quote.stayTotal)}, ${toMinorUnits(quote.amountDueNow)},
                ${toMinorUnits(quote.balanceDueLater)}, ${toMinorUnits(quote.damageDeposit)},
                ${toMinorUnits(quote.touristTaxEur)}, now() + (${holdMinutes} * interval '1 minute')
            )
            RETURNING *
        `;
        return { booking: rows[0], reused: false };
    } catch (error) {
        if (error?.code === '23P01') throw new BookingConflictError();
        if (error?.code === '23505') {
            const existing = await getBookingByIdempotencyKey(idempotencyKey);
            if (existing) return { booking: existing, reused: true };
        }
        throw error;
    }
};

const markCheckoutPending = async (bookingId, sessionId) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        UPDATE bookings
        SET status = 'pending_payment', stripe_checkout_session_id = ${sessionId}, updated_at = now()
        WHERE id = ${bookingId}
        RETURNING *
    `;
    return rows[0] || null;
};

const cancelBooking = async (bookingId, status = 'checkout_failed') => {
    await ensureSchema();
    const sql = await getSql();
    await sql`
        UPDATE bookings
        SET status = ${status}, updated_at = now()
        WHERE id = ${bookingId} AND status <> 'paid'
    `;
};

const getBookingBySessionId = async (sessionId) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        SELECT * FROM bookings WHERE stripe_checkout_session_id = ${sessionId} LIMIT 1
    `;
    return rows[0] || null;
};

const getBookingByPublicReference = async (reference) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        SELECT * FROM bookings WHERE public_reference = ${reference} LIMIT 1
    `;
    return rows[0] || null;
};

const getBookingById = async (bookingId) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`SELECT * FROM bookings WHERE id = ${bookingId} LIMIT 1`;
    return rows[0] || null;
};

const markBookingPaid = async ({ bookingId, sessionId, paymentIntentId, amountTotal, currency }) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        UPDATE bookings
        SET status = 'paid',
            stripe_checkout_session_id = ${sessionId},
            stripe_payment_intent_id = ${paymentIntentId || null},
            paid_at = COALESCE(paid_at, now()),
            hold_expires_at = NULL,
            updated_at = now()
        WHERE id = ${bookingId}
          AND amount_due_now_pence = ${amountTotal}
          AND currency = ${currency}
        RETURNING *
    `;
    return rows[0] || null;
};

const beginWebhookEvent = async (eventId, eventType) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        INSERT INTO stripe_webhook_events (event_id, event_type)
        VALUES (${eventId}, ${eventType})
        ON CONFLICT (event_id) DO UPDATE
        SET attempts = stripe_webhook_events.attempts + 1,
            last_attempt_at = now(),
            last_error = NULL
        WHERE stripe_webhook_events.processed_at IS NULL
        RETURNING event_id
    `;
    return rows.length > 0;
};

const completeWebhookEvent = async (eventId) => {
    const sql = await getSql();
    await sql`
        UPDATE stripe_webhook_events
        SET processed_at = now(), last_error = NULL, last_attempt_at = now()
        WHERE event_id = ${eventId}
    `;
};

const failWebhookEvent = async (eventId, message) => {
    const sql = await getSql();
    await sql`
        UPDATE stripe_webhook_events
        SET last_error = ${String(message || 'processing_failed').slice(0, 250)}, last_attempt_at = now()
        WHERE event_id = ${eventId}
    `;
};

const claimEmailDelivery = async (bookingId, kind) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        INSERT INTO email_deliveries (booking_id, kind, status)
        VALUES (${bookingId}, ${kind}, 'sending')
        ON CONFLICT (booking_id, kind) DO UPDATE
        SET status = 'sending', attempts = email_deliveries.attempts + 1,
            last_error = NULL, updated_at = now()
        WHERE email_deliveries.status <> 'sent'
        RETURNING id
    `;
    return rows.length > 0;
};

const completeEmailDelivery = async (bookingId, kind, providerId) => {
    const sql = await getSql();
    await sql`
        UPDATE email_deliveries
        SET status = 'sent', provider_id = ${providerId || null}, sent_at = now(), updated_at = now()
        WHERE booking_id = ${bookingId} AND kind = ${kind}
    `;
};

const failEmailDelivery = async (bookingId, kind, message) => {
    const sql = await getSql();
    await sql`
        UPDATE email_deliveries
        SET status = 'failed', last_error = ${String(message || 'send_failed').slice(0, 250)}, updated_at = now()
        WHERE booking_id = ${bookingId} AND kind = ${kind}
    `;
};

const getDatabaseBlockedRanges = async () => {
    await expireOldHolds();
    const sql = await getSql();
    const rows = await sql`
        SELECT arrival::text AS start, departure::text AS end,
               CASE WHEN status = 'paid' THEN 'booked' ELSE 'held' END AS status
        FROM bookings
        WHERE status IN ('creating_checkout', 'pending_payment', 'paid', 'blocked')
        ORDER BY arrival
    `;
    return rows;
};

module.exports = {
    BookingConflictError,
    DatabaseUnavailableError,
    beginWebhookEvent,
    cancelBooking,
    claimEmailDelivery,
    completeEmailDelivery,
    completeWebhookEvent,
    createBookingHold,
    ensureSchema,
    failEmailDelivery,
    failWebhookEvent,
    getBookingById,
    getBookingBySessionId,
    getBookingByPublicReference,
    getDatabaseBlockedRanges,
    markBookingPaid,
    markCheckoutPending
};
