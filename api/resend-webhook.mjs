import configModule from '../lib/config.js';
import databaseModule from '../lib/database.js';
import resendWebhookModule from '../lib/resend-webhook.js';

const { config: bookingConfig } = configModule;
const {
    beginResendWebhookEvent,
    completeResendWebhookEvent,
    failResendWebhookEvent,
    recordEmailProviderEvent
} = databaseModule;
const { resendEventRecord, verifyResendSignature } = resendWebhookModule;

const respond = (status, payload) => new Response(JSON.stringify(payload), {
    status,
    headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
    }
});

export async function POST(request) {
    const webhookSecret = bookingConfig.resendWebhookSecret();
    if (!webhookSecret || !bookingConfig.databaseUrl()) {
        return respond(503, { error: 'Email webhook processing is not configured.' });
    }

    let rawBody;
    try {
        rawBody = await request.text();
    } catch (error) {
        console.error('Resend webhook raw body unavailable.', error?.name || 'Error');
        return respond(400, { error: 'Invalid webhook body.' });
    }

    const messageId = request.headers.get('svix-id');
    const timestamp = request.headers.get('svix-timestamp');
    const signature = request.headers.get('svix-signature');
    if (!await verifyResendSignature({
        rawBody,
        messageId,
        timestamp,
        signature,
        secret: webhookSecret
    })) {
        return respond(400, { error: 'Invalid webhook signature.' });
    }

    let event;
    let record;
    try {
        event = JSON.parse(rawBody);
        if (!event?.type) throw new Error('Invalid Resend webhook event.');
        record = resendEventRecord(event);
    } catch (_) {
        return respond(400, { error: 'Invalid webhook event.' });
    }
    if (!record) return respond(200, { received: true, ignored: true });

    let shouldProcess;
    try {
        shouldProcess = await beginResendWebhookEvent({ eventId: messageId, ...record });
    } catch (error) {
        console.error('Resend webhook could not access the booking database.', error?.code || error?.name || 'Error');
        return respond(503, { error: 'Email webhook processing is temporarily unavailable.' });
    }
    if (!shouldProcess) return respond(200, { received: true, duplicate: true });

    try {
        const matched = await recordEmailProviderEvent(record);
        await completeResendWebhookEvent(messageId);
        return respond(200, { received: true, matched });
    } catch (error) {
        await failResendWebhookEvent(messageId, error?.message).catch(() => {});
        console.error('Resend webhook processing failed.', error?.name || 'Error');
        return respond(500, { error: 'Email webhook processing failed.' });
    }
}
