'use strict';

const {
    BookingValidationError,
    calculateQuote,
    normalizeRequestId,
    publicReference,
    validateContact
} = require('../lib/booking');
const { config, trustedOrigin } = require('../lib/config');
const {
    BookingConflictError,
    DatabaseUnavailableError,
    cancelBooking,
    createBookingHold,
    markCheckoutPending
} = require('../lib/database');
const { json, parseBody } = require('../lib/http');
const { createCheckoutSession, retrieveCheckoutSession } = require('../lib/stripe');

const checkoutParams = ({ booking, quote, contact, origin }) => {
    const successUrl = process.env.STRIPE_SUCCESS_URL
        || `${origin}/payment-success.html?lang=${encodeURIComponent(contact.lang)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL
        || `${origin}/payment-cancelled.html?lang=${encodeURIComponent(contact.lang)}`;
    const title = quote.paymentStage === 'full_payment_now'
        ? 'Lasclottes booking payment (full amount due now)'
        : 'Lasclottes booking payment (deposit due now)';
    const params = new URLSearchParams();

    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.set('expires_at', String(Math.floor(Date.now() / 1000) + (35 * 60)));
    params.set('client_reference_id', booking.id);
    params.append('payment_method_types[]', 'card');
    params.set('billing_address_collection', 'auto');
    params.set('phone_number_collection[enabled]', 'true');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'gbp');
    params.set('line_items[0][price_data][unit_amount]', String(booking.amount_due_now_pence));
    params.set('line_items[0][price_data][product_data][name]', title);
    params.set(
        'line_items[0][price_data][product_data][description]',
        `${quote.arrivalDate} to ${quote.departureDate} · ${quote.guests} guests · ${quote.nights} nights`
    );
    params.set('customer_email', contact.email);

    const metadata = {
        booking_id: booking.id,
        booking_reference: booking.public_reference,
        arrival_date: quote.arrivalDate,
        departure_date: quote.departureDate,
        nights: String(quote.nights),
        guests: String(quote.guests),
        adults: String(quote.adults),
        children: String(quote.children),
        stay_total_gbp: quote.stayTotal.toFixed(2),
        tourist_tax_eur: quote.touristTaxEur.toFixed(2),
        damage_deposit_gbp: quote.damageDeposit.toFixed(2),
        amount_due_now_gbp: quote.amountDueNow.toFixed(2),
        balance_due_later_gbp: quote.balanceDueLater.toFixed(2),
        payment_stage: quote.paymentStage,
        safety_agreement: 'accepted',
        language: contact.lang
    };
    Object.entries(metadata).forEach(([key, value]) => {
        params.set(`metadata[${key}]`, value);
        params.set(`payment_intent_data[metadata][${key}]`, value);
    });
    return params;
};

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }
    if (!config.paymentsEnabled()) {
        return json(res, 503, {
            error: 'Online booking payments are being prepared. Please contact us to reserve.',
            code: 'payments_disabled'
        });
    }

    const stripeSecretKey = config.stripeSecretKey();
    if (!stripeSecretKey || !config.databaseUrl()) {
        return json(res, 503, { error: 'Secure card checkout is not configured yet.' });
    }

    const body = parseBody(req);
    let quote;
    let contact;
    try {
        contact = validateContact(body);
        quote = calculateQuote(body);
    } catch (error) {
        if (error instanceof BookingValidationError) {
            return json(res, 400, { error: error.message, code: error.code });
        }
        return json(res, 400, { error: 'Invalid booking details.' });
    }

    let origin;
    try {
        origin = trustedOrigin();
    } catch (_) {
        return json(res, 503, { error: 'Secure card checkout is not configured yet.' });
    }

    const idempotencyKey = normalizeRequestId(body.requestId);
    let booking;
    let reused = false;
    try {
        ({ booking, reused } = await createBookingHold({
            quote,
            contact,
            idempotencyKey,
            publicReference: publicReference()
        }));
    } catch (error) {
        if (error instanceof BookingConflictError) {
            return json(res, 409, { error: error.message, code: error.code });
        }
        if (error instanceof DatabaseUnavailableError) {
            return json(res, 503, { error: 'Live availability is temporarily unavailable.' });
        }
        console.error('Booking hold creation failed.', error?.code || error?.name || 'Error');
        return json(res, 503, { error: 'Live availability is temporarily unavailable.' });
    }

    try {
        if (reused && booking.stripe_checkout_session_id) {
            const existingSession = await retrieveCheckoutSession(
                stripeSecretKey,
                booking.stripe_checkout_session_id
            );
            if (existingSession?.url && existingSession.status === 'open') {
                return json(res, 200, { id: existingSession.id, url: existingSession.url, quote });
            }
            return json(res, 409, {
                error: 'This checkout request has already been used. Please refresh and try again.',
                code: 'checkout_already_used'
            });
        }

        const session = await createCheckoutSession(
            stripeSecretKey,
            checkoutParams({ booking, quote, contact, origin }),
            `booking-checkout/${booking.id}`
        );
        if (!session?.id || !session?.url) throw new Error('Stripe did not return a checkout URL.');
        await markCheckoutPending(booking.id, session.id);
        return json(res, 200, { id: session.id, url: session.url, quote });
    } catch (error) {
        if (!reused) await cancelBooking(booking.id).catch(() => {});
        console.error('Stripe checkout session creation failed.', error?.code || error?.name || 'Error');
        return json(res, 502, { error: 'Unable to start secure card checkout. Please try again.' });
    }
};

handler.calculateQuote = calculateQuote;
handler.checkoutParams = checkoutParams;
module.exports = handler;
