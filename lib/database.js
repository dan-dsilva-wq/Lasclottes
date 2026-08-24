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

class BookingRateLimitError extends Error {
    constructor() {
        super('Too many booking attempts. Please wait a few minutes and try again.');
        this.name = 'BookingRateLimitError';
        this.code = 'too_many_booking_attempts';
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
            guest_message text NOT NULL DEFAULT '',
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
            refund_status text,
            refunded_amount_pence integer NOT NULL DEFAULT 0,
            refunded_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            CHECK (departure > arrival),
            CHECK (adults >= 1),
            CHECK (children >= 0),
            CHECK (guests = adults + children),
            CHECK (amount_due_now_pence > 0)
        )
    `;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_status text`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_amount_pence integer NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refunded_at timestamptz`;
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guest_message text NOT NULL DEFAULT ''`;
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
            provider_status text,
            provider_status_detail text,
            last_provider_event_at timestamptz,
            last_error text,
            sent_at timestamptz,
            updated_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (booking_id, kind)
        )
    `;
    await sql`ALTER TABLE email_deliveries ADD COLUMN IF NOT EXISTS provider_status text`;
    await sql`ALTER TABLE email_deliveries ADD COLUMN IF NOT EXISTS provider_status_detail text`;
    await sql`ALTER TABLE email_deliveries ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz`;
    await sql`
        CREATE TABLE IF NOT EXISTS resend_webhook_events (
            event_id text PRIMARY KEY,
            event_type text NOT NULL,
            provider_id text NOT NULL,
            provider_status text NOT NULL,
            event_created_at timestamptz NOT NULL,
            status_detail text,
            attempts integer NOT NULL DEFAULT 1,
            last_attempt_at timestamptz NOT NULL DEFAULT now(),
            processed_at timestamptz,
            last_error text
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS resend_webhook_events_provider_idx
            ON resend_webhook_events (provider_id, event_created_at DESC)
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS booking_rate_limits (
            fingerprint text PRIMARY KEY,
            window_started_at timestamptz NOT NULL DEFAULT now(),
            attempts integer NOT NULL DEFAULT 1,
            updated_at timestamptz NOT NULL DEFAULT now()
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

const consumeCheckoutAttempt = async (fingerprint, maxAttempts = 8, windowMinutes = 15) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        INSERT INTO booking_rate_limits (fingerprint)
        VALUES (${fingerprint})
        ON CONFLICT (fingerprint) DO UPDATE
        SET attempts = CASE
                WHEN booking_rate_limits.window_started_at <= now() - (${windowMinutes} * interval '1 minute') THEN 1
                ELSE booking_rate_limits.attempts + 1
            END,
            window_started_at = CASE
                WHEN booking_rate_limits.window_started_at <= now() - (${windowMinutes} * interval '1 minute') THEN now()
                ELSE booking_rate_limits.window_started_at
            END,
            updated_at = now()
        RETURNING attempts
    `;
    if (Number(rows[0]?.attempts || 0) > maxAttempts) throw new BookingRateLimitError();
};

const createBookingHold = async ({ quote, contact, idempotencyKey, publicReference, holdMinutes = 40 }) => {
    await expireOldHolds();
    const sql = await getSql();
    try {
        const rows = await sql`
            INSERT INTO bookings (
                public_reference, idempotency_key, status, arrival, departure,
                first_name, last_name, email, phone, language, guest_message,
                adults, children, guests, nights, season, payment_stage,
                stay_total_pence, amount_due_now_pence, balance_due_later_pence,
                damage_deposit_pence, tourist_tax_eur_cents, hold_expires_at
            ) VALUES (
                ${publicReference}, ${idempotencyKey}, 'creating_checkout',
                ${quote.arrivalDate}, ${quote.departureDate},
                ${contact.firstName}, ${contact.lastName}, ${contact.email}, ${contact.phone}, ${contact.lang},
                ${contact.message},
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

const recordRefundForPaymentIntent = async ({ paymentIntentId, amountRefunded, fullyRefunded }) => {
    await ensureSchema();
    const normalizedPaymentIntent = String(paymentIntentId || '');
    const normalizedAmount = Number(amountRefunded);
    if (!/^pi_[A-Za-z0-9]+$/.test(normalizedPaymentIntent) || !Number.isInteger(normalizedAmount) || normalizedAmount < 0) {
        throw new Error('Invalid Stripe refund record.');
    }
    const nextStatus = fullyRefunded ? 'full' : 'partial';
    const sql = await getSql();
    const rows = await sql`
        UPDATE bookings
        SET refund_status = CASE
                WHEN refund_status = 'full' OR ${nextStatus} = 'full' THEN 'full'
                ELSE 'partial'
            END,
            refunded_amount_pence = GREATEST(refunded_amount_pence, ${normalizedAmount}),
            refunded_at = COALESCE(refunded_at, now()),
            updated_at = now()
        WHERE stripe_payment_intent_id = ${normalizedPaymentIntent}
        RETURNING *
    `;
    if (!rows[0]) throw new Error('Refunded booking record was not found.');
    return rows[0];
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
          AND (
              stripe_webhook_events.last_error IS NOT NULL
              OR stripe_webhook_events.last_attempt_at <= now() - interval '10 minutes'
          )
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
        WHERE email_deliveries.status = 'failed'
           OR (email_deliveries.status = 'sending' AND email_deliveries.updated_at <= now() - interval '10 minutes')
        RETURNING id
    `;
    return rows.length > 0;
};

const completeEmailDelivery = async (bookingId, kind, providerId) => {
    const sql = await getSql();
    await sql`
        UPDATE email_deliveries
        SET status = 'sent', provider_id = ${providerId || null},
            provider_status = COALESCE(provider_status, 'submitted'),
            sent_at = now(), updated_at = now()
        WHERE booking_id = ${bookingId} AND kind = ${kind}
    `;
    if (providerId) {
        await sql`
            UPDATE email_deliveries AS delivery
            SET provider_status = event.provider_status,
                provider_status_detail = event.status_detail,
                last_provider_event_at = event.event_created_at,
                updated_at = now()
            FROM (
                SELECT provider_status, status_detail, event_created_at
                FROM resend_webhook_events
                WHERE provider_id = ${providerId} AND processed_at IS NOT NULL
                ORDER BY event_created_at DESC
                LIMIT 1
            ) AS event
            WHERE delivery.booking_id = ${bookingId} AND delivery.kind = ${kind}
        `;
    }
};

const failEmailDelivery = async (bookingId, kind, message) => {
    const sql = await getSql();
    await sql`
        UPDATE email_deliveries
        SET status = 'failed', last_error = ${String(message || 'send_failed').slice(0, 250)}, updated_at = now()
        WHERE booking_id = ${bookingId} AND kind = ${kind}
    `;
};

const beginResendWebhookEvent = async ({
    eventId,
    eventType,
    providerId,
    providerStatus,
    eventCreatedAt,
    detail
}) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        INSERT INTO resend_webhook_events (
            event_id, event_type, provider_id, provider_status, event_created_at, status_detail
        )
        VALUES (${eventId}, ${eventType}, ${providerId}, ${providerStatus}, ${eventCreatedAt}, ${detail || null})
        ON CONFLICT (event_id) DO UPDATE
        SET attempts = resend_webhook_events.attempts + 1,
            last_attempt_at = now(),
            last_error = NULL
        WHERE resend_webhook_events.processed_at IS NULL
          AND (
              resend_webhook_events.last_error IS NOT NULL
              OR resend_webhook_events.last_attempt_at <= now() - interval '10 minutes'
          )
        RETURNING event_id
    `;
    return rows.length > 0;
};

const recordEmailProviderEvent = async ({ providerId, providerStatus, eventCreatedAt, detail }) => {
    await ensureSchema();
    const sql = await getSql();
    const rows = await sql`
        UPDATE email_deliveries
        SET provider_status = ${providerStatus},
            provider_status_detail = ${detail || null},
            last_provider_event_at = ${eventCreatedAt},
            updated_at = now()
        WHERE provider_id = ${providerId}
          AND (
              last_provider_event_at IS NULL
              OR last_provider_event_at <= ${eventCreatedAt}
          )
        RETURNING id
    `;
    return rows.length > 0;
};

const completeResendWebhookEvent = async (eventId) => {
    const sql = await getSql();
    await sql`
        UPDATE resend_webhook_events
        SET processed_at = now(), last_error = NULL, last_attempt_at = now()
        WHERE event_id = ${eventId}
    `;
};

const failResendWebhookEvent = async (eventId, message) => {
    const sql = await getSql();
    await sql`
        UPDATE resend_webhook_events
        SET last_error = ${String(message || 'processing_failed').slice(0, 250)}, last_attempt_at = now()
        WHERE event_id = ${eventId}
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
    BookingRateLimitError,
    DatabaseUnavailableError,
    beginResendWebhookEvent,
    beginWebhookEvent,
    cancelBooking,
    claimEmailDelivery,
    completeEmailDelivery,
    completeResendWebhookEvent,
    completeWebhookEvent,
    consumeCheckoutAttempt,
    createBookingHold,
    ensureSchema,
    failEmailDelivery,
    failResendWebhookEvent,
    failWebhookEvent,
    getBookingById,
    getBookingBySessionId,
    getBookingByPublicReference,
    getDatabaseBlockedRanges,
    markBookingPaid,
    markCheckoutPending,
    recordEmailProviderEvent,
    recordRefundForPaymentIntent
};
