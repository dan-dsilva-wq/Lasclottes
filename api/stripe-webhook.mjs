import configModule from '../lib/config.js';
import databaseModule from '../lib/database.js';
import paymentsModule from '../lib/payments.js';
import stripeModule from '../lib/stripe.js';

const { config: bookingConfig } = configModule;
const {
    beginWebhookEvent,
    cancelBooking,
    completeWebhookEvent,
    failWebhookEvent
} = databaseModule;
const { bookingForSession, confirmPaidSession } = paymentsModule;
const { verifyStripeSignature } = stripeModule;

const respond = (status, payload) => new Response(JSON.stringify(payload), {
    status,
    headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
    }
});

export async function POST(request) {
    const webhookSecret = bookingConfig.stripeWebhookSecret();
    if (!webhookSecret || !bookingConfig.databaseUrl()) {
        return respond(503, { error: 'Webhook processing is not configured.' });
    }

    let rawBody;
    try {
        rawBody = await request.text();
    } catch (error) {
        console.error('Stripe webhook raw body unavailable.', error?.name || 'Error');
        return respond(400, { error: 'Invalid webhook body.' });
    }
    if (!verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), webhookSecret)) {
        return respond(400, { error: 'Invalid webhook signature.' });
    }

    let event;
    try {
        event = JSON.parse(rawBody);
    } catch (_) {
        return respond(400, { error: 'Invalid webhook event.' });
    }
    if (!event?.id || !event?.type) return respond(400, { error: 'Invalid webhook event.' });

    let shouldProcess;
    try {
        shouldProcess = await beginWebhookEvent(event.id, event.type);
    } catch (error) {
        console.error('Stripe webhook could not access the booking database.', error?.code || error?.name || 'Error');
        return respond(503, { error: 'Webhook processing is temporarily unavailable.' });
    }
    if (!shouldProcess) return respond(200, { received: true, duplicate: true });

    try {
        const session = event.data?.object;
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            if (session?.payment_status === 'paid') await confirmPaidSession(session);
        } else if (event.type === 'checkout.session.expired') {
            const booking = await bookingForSession(session);
            if (booking) await cancelBooking(booking.id, 'expired');
        }
        await completeWebhookEvent(event.id);
        return respond(200, { received: true });
    } catch (error) {
        await failWebhookEvent(event.id, error?.message).catch(() => {});
        console.error('Stripe webhook processing failed.', error?.name || 'Error');
        return respond(500, { error: 'Webhook processing failed.' });
    }
}
