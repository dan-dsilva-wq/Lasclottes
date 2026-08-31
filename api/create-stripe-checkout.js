'use strict';

const {
    BookingValidationError,
    calculateQuote,
    normalizeRequestId,
    publicReference,
    validateContact
} = require('../lib/booking');
const { checkoutFingerprint } = require('../lib/abuse');
const { config, isStagingOrigin, requestOriginAllowed } = require('../lib/config');
const {
    BookingConflictError,
    BookingRateLimitError,
    DatabaseUnavailableError,
    cancelBooking,
    consumeCheckoutAttempt,
    createBookingHold,
    markCheckoutPending
} = require('../lib/database');
const { json, parseBody } = require('../lib/http');
const {
    checkoutModeAllowed,
    createCheckoutSession,
    retrieveCheckoutSession
} = require('../lib/stripe');
const {
    BOOKING_TERMS_VERSION,
    bookingAgreementSnapshot
} = require('../lib/terms');
const { wixBridgeContext, wixReturnUrl } = require('../lib/wix-bridge');

const termsApprovalRequired = (origin, approved) => (
    ['https://lasclottes.com', 'https://www.lasclottes.com'].includes(origin)
    && approved !== true
);

const checkoutOrigin = (value) => {
    if (!requestOriginAllowed(value)) return '';
    try {
        return new URL(String(value)).origin;
    } catch (_) {
        return '';
    }
};

const checkoutParams = ({ booking, quote, contact, origin, successUrl: suppliedSuccessUrl, cancelUrl: suppliedCancelUrl }) => {
    const successUrl = suppliedSuccessUrl || config.stripeSuccessUrl()
        || `${origin}/payment-success.html?lang=${encodeURIComponent(contact.lang)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = suppliedCancelUrl || config.stripeCancelUrl()
        || `${origin}/payment-cancelled.html?lang=${encodeURIComponent(contact.lang)}`;
    const title = quote.paymentStage === 'full_payment_now'
        ? 'Lasclottes booking payment (full amount due now)'
        : 'Lasclottes booking payment (initial payment due now)';
    const params = new URLSearchParams();

    params.set('mode', 'payment');
    params.set('submit_type', 'book');
    params.set('locale', ['en', 'fr', 'nl'].includes(contact.lang) ? contact.lang : 'auto');
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
        tourist_tax_status: quote.touristTaxStatus,
        damage_deposit_gbp: quote.damageDeposit.toFixed(2),
        amount_due_now_gbp: quote.amountDueNow.toFixed(2),
        balance_due_later_gbp: quote.balanceDueLater.toFixed(2),
        payment_stage: quote.paymentStage,
        safety_agreement: 'accepted',
        booking_terms_version: BOOKING_TERMS_VERSION,
        language: contact.lang
    };
    if (Number.isFinite(quote.touristTaxEur)) {
        metadata.tourist_tax_eur = quote.touristTaxEur.toFixed(2);
    }
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
    const stripeWebhookSecret = config.stripeWebhookSecret();
    if (!stripeSecretKey || !stripeWebhookSecret || !config.databaseUrl()) {
        return json(res, 503, { error: 'Secure card checkout is not configured yet.' });
    }

    const body = parseBody(req);
    const wixBridge = await wixBridgeContext(req);
    const requestOrigin = wixBridge.authenticated
        ? new URL(wixBridge.siteBaseUrl).origin
        : checkoutOrigin(req.headers?.origin);
    if (!requestOrigin) {
        return json(res, 403, { error: 'This booking request did not come from the Lasclottes website.' });
    }

    let quote;
    let contact;
    const stagingTestMode = wixBridge.authenticated
        ? wixBridge.testMode
        : isStagingOrigin(requestOrigin);
    try {
        contact = validateContact(body);
        quote = calculateQuote(body, new Date(), undefined, {
            testMode: stagingTestMode,
            testPriceGbp: stagingTestMode ? 1 : null
        });
    } catch (error) {
        if (error instanceof BookingValidationError) {
            return json(res, 400, { error: error.message, code: error.code });
        }
        return json(res, 400, { error: 'Invalid booking details.' });
    }
    const stripeModeOrigin = wixBridge.authenticated
        ? (stagingTestMode ? 'https://test.lasclottes.com' : 'https://lasclottes.com')
        : requestOrigin;
    if (!checkoutModeAllowed(stripeSecretKey, stripeModeOrigin)) {
        return json(res, 503, {
            error: 'Secure card checkout is not configured for this website environment.',
            code: 'stripe_mode_mismatch'
        });
    }
    if (termsApprovalRequired(stripeModeOrigin, config.bookingTermsApproved())) {
        return json(res, 503, {
            error: 'Online booking terms are awaiting final owner approval.',
            code: 'booking_terms_not_approved'
        });
    }

    try {
        const fingerprintRequest = wixBridge.authenticated
            ? {
                headers: {
                    'cf-connecting-ip': `wix:${normalizeRequestId(body.visitorId || body.requestId)}`,
                    'user-agent': 'Lasclottes Wix booking bridge'
                }
            }
            : req;
        await consumeCheckoutAttempt(checkoutFingerprint(fingerprintRequest, stripeWebhookSecret));
    } catch (error) {
        if (error instanceof BookingRateLimitError) {
            res.setHeader('Retry-After', '900');
            return json(res, 429, { error: error.message, code: error.code });
        }
        if (error instanceof DatabaseUnavailableError) {
            return json(res, 503, { error: 'Live availability is temporarily unavailable.' });
        }
        console.error('Booking abuse protection failed.', error?.code || error?.name || 'Error');
        return json(res, 503, { error: 'Secure card checkout is temporarily unavailable.' });
    }

    const idempotencyKey = normalizeRequestId(body.requestId);
    const reference = publicReference();
    const agreementSnapshot = bookingAgreementSnapshot({ quote, publicReference: reference });
    let booking;
    let reused = false;
    try {
        ({ booking, reused } = await createBookingHold({
            quote,
            contact,
            idempotencyKey,
            publicReference: reference,
            agreementVersion: BOOKING_TERMS_VERSION,
            agreementSnapshot,
            allowOverlap: stagingTestMode
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

        const wixSuccessUrl = wixBridge.authenticated
            ? wixReturnUrl(config.wixStripeSuccessUrl(), wixBridge.siteBaseUrl, '/payment-success')
            : '';
        const wixCancelUrl = wixBridge.authenticated
            ? wixReturnUrl(config.wixStripeCancelUrl(), wixBridge.siteBaseUrl, '/payment-cancelled')
            : '';
        const session = await createCheckoutSession(
            stripeSecretKey,
            checkoutParams({
                booking,
                quote,
                contact,
                origin: requestOrigin,
                successUrl: wixSuccessUrl
                    ? `${wixSuccessUrl}?lang=${encodeURIComponent(contact.lang)}&session_id={CHECKOUT_SESSION_ID}`
                    : '',
                cancelUrl: wixCancelUrl
                    ? `${wixCancelUrl}?lang=${encodeURIComponent(contact.lang)}`
                    : ''
            }),
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
handler.checkoutOrigin = checkoutOrigin;
handler.checkoutParams = checkoutParams;
handler.termsApprovalRequired = termsApprovalRequired;
module.exports = handler;
