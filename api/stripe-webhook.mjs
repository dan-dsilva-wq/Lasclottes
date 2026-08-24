import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { config: bookingConfig } = require('../lib/config');
const {
    beginWebhookEvent,
    cancelBooking,
    completeWebhookEvent,
    failWebhookEvent
} = require('../lib/database');
const { json, readRawBody } = require('../lib/http');
const { bookingForSession, confirmPaidSession } = require('../lib/payments');
const { verifyStripeSignature } = require('../lib/stripe');

export const config = { api: { bodyParser: false } };

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }
    const webhookSecret = bookingConfig.stripeWebhookSecret();
    if (!webhookSecret || !bookingConfig.databaseUrl()) {
        return json(res, 503, { error: 'Webhook processing is not configured.' });
    }

    let rawBody;
    try {
        rawBody = await readRawBody(req);
    } catch (error) {
        console.error('Stripe webhook raw body unavailable.', error?.name || 'Error');
        return json(res, 400, { error: 'Invalid webhook body.' });
    }
    if (!verifyStripeSignature(rawBody, req.headers['stripe-signature'], webhookSecret)) {
        return json(res, 400, { error: 'Invalid webhook signature.' });
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch (_) {
        return json(res, 400, { error: 'Invalid webhook event.' });
    }
    if (!event?.id || !event?.type) return json(res, 400, { error: 'Invalid webhook event.' });

    let shouldProcess;
    try {
        shouldProcess = await beginWebhookEvent(event.id, event.type);
    } catch (error) {
        console.error('Stripe webhook could not access the booking database.', error?.code || error?.name || 'Error');
        return json(res, 503, { error: 'Webhook processing is temporarily unavailable.' });
    }
    if (!shouldProcess) return json(res, 200, { received: true, duplicate: true });

    try {
        const session = event.data?.object;
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            if (session?.payment_status === 'paid') await confirmPaidSession(session);
        } else if (event.type === 'checkout.session.expired') {
            const booking = await bookingForSession(session);
            if (booking) await cancelBooking(booking.id, 'expired');
        }
        await completeWebhookEvent(event.id);
        return json(res, 200, { received: true });
    } catch (error) {
        await failWebhookEvent(event.id, error?.message).catch(() => {});
        console.error('Stripe webhook processing failed.', error?.name || 'Error');
        return json(res, 500, { error: 'Webhook processing failed.' });
    }
};

export default handler;
