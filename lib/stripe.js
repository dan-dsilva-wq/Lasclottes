'use strict';

const crypto = require('node:crypto');

const STRIPE_API = 'https://api.stripe.com/v1';

class StripeApiError extends Error {
    constructor(status, code) {
        super('Stripe request failed.');
        this.name = 'StripeApiError';
        this.status = status;
        this.code = code || 'stripe_request_failed';
    }
}

const stripeRequest = async ({ secretKey, path, method = 'GET', body, idempotencyKey }) => {
    const headers = { Authorization: `Bearer ${secretKey}` };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const response = await fetch(`${STRIPE_API}${path}`, {
        method,
        headers,
        body: body ? body.toString() : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new StripeApiError(response.status, data?.error?.code || data?.error?.type);
    }
    return data;
};

const createCheckoutSession = (secretKey, params, idempotencyKey) => stripeRequest({
    secretKey,
    path: '/checkout/sessions',
    method: 'POST',
    body: params,
    idempotencyKey
});

const retrieveCheckoutSession = (secretKey, sessionId) => stripeRequest({
    secretKey,
    path: `/checkout/sessions/${encodeURIComponent(sessionId)}`
});

const verifyStripeSignature = (rawBody, signatureHeader, secret, toleranceSeconds = 300) => {
    if (!signatureHeader || !secret) return false;
    const parts = String(signatureHeader).split(',');
    const timestampPart = parts.find((part) => part.startsWith('t='));
    const signatures = parts
        .filter((part) => part.startsWith('v1='))
        .map((part) => part.slice(3));
    const timestamp = Number(timestampPart?.slice(2));
    if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    return signatures.some((signature) => {
        if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    });
};

module.exports = {
    StripeApiError,
    createCheckoutSession,
    retrieveCheckoutSession,
    verifyStripeSignature
};
