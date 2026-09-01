import configModule from '../lib/config.js';
import databaseModule from '../lib/database.js';
import paymentsModule from '../lib/payments.js';
import stripeModule from '../lib/stripe.js';

const { config: bookingConfig } = configModule;
const {
    beginWebhookEvent,
    cancelBooking,
    completeWebhookEvent,
    failWebhookEvent,
    recordRefundForPaymentIntent
} = databaseModule;
const { bookingForSession, confirmPaidSession } = paymentsModule;
const { verifyStripeSignature, webhookModeAllowed } = stripeModule;

const respond = (status, payload) => new Response(JSON.stringify(payload), {
    status,
    headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
    }
});

export const refundRecordFromCharge = (charge) => {
    const paymentIntentId = typeof charge?.payment_intent === 'string' ? charge.payment_intent : '';
    const amountRefunded = Number(charge?.amount_refunded);
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId) || !Number.isInteger(amountRefunded) || amountRefunded < 0) {
        throw new Error('Invalid Stripe refund event.');
    }
    return {
        paymentIntentId,
        amountRefunded,
        fullyRefunded: charge?.refunded === true
    };
};

export async function POST(request) {
    if (!bookingConfig.databaseUrl()) {
        return respond(503, { error: 'Webhook processing is not configured.' });
    }

    let rawBody;
    try {
        rawBody = await request.text();
    } catch (error) {
        console.error('Stripe webhook raw body unavailable.', error?.name || 'Error');
        return respond(400, { error: 'Invalid webhook body.' });
    }
    let event;
    try {
        event = JSON.parse(rawBody);
    } catch (_) {
        return respond(400, { error: 'Invalid webhook event.' });
    }
    if (!event?.id || !event?.type) return respond(400, { error: 'Invalid webhook event.' });
    const webhookSecret = event.livemode === true
        ? bookingConfig.stripeLiveWebhookSecret()
        : bookingConfig.stripeWebhookSecret();
    if (!webhookSecret) {
        return respond(503, { error: 'Webhook processing is not configured.' });
    }
    if (!verifyStripeSignature(rawBody, request.headers.get('stripe-signature'), webhookSecret)) {
        return respond(400, { error: 'Invalid webhook signature.' });
    }
    if (!webhookModeAllowed(
        event.livemode,
        request.url,
        bookingConfig.liveStripeWebhooksOnSharedEndpoint()
    )) {
        return respond(400, { error: 'Webhook environment does not match this endpoint.' });
    }

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
        } else if (event.type === 'charge.refunded') {
            await recordRefundForPaymentIntent(refundRecordFromCharge(session));
        }
        await completeWebhookEvent(event.id);
        return respond(200, { received: true });
    } catch (error) {
        await failWebhookEvent(event.id, error?.message).catch(() => {});
        console.error('Stripe webhook processing failed.', error?.name || 'Error');
        return respond(500, { error: 'Webhook processing failed.' });
    }
}
