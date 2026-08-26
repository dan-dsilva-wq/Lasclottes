'use strict';

const crypto = require('node:crypto');

const STRIPE_API = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2026-02-25.clover';
const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const LIVE_CHECKOUT_ORIGINS = new Set([
    'https://test.lasclottes.com',
    'https://lasclottes.com',
    'https://www.lasclottes.com'
]);

class StripeApiError extends Error {
    constructor(status, code) {
        super('Stripe request failed.');
        this.name = 'StripeApiError';
        this.status = status;
        this.code = code || 'stripe_request_failed';
    }
}

const stripeRequest = async ({ secretKey, path, method = 'GET', body, idempotencyKey }) => {
    const headers = {
        Authorization: `Bearer ${secretKey}`,
        'Stripe-Version': STRIPE_API_VERSION
    };
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const response = await fetch(`${STRIPE_API}${path}`, {
        method,
        headers,
        body: body ? body.toString() : undefined,
        signal: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
            ? AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS)
            : undefined
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

const stripeKeyMode = (secretKey) => {
    const key = String(secretKey || '');
    if (key.startsWith('sk_test_')) return 'test';
    if (key.startsWith('sk_live_')) return 'live';
    return '';
};

const checkoutModeAllowed = (secretKey, origin) => {
    const mode = stripeKeyMode(secretKey);
    let normalizedOrigin;
    try {
        normalizedOrigin = new URL(String(origin || '')).origin;
    } catch (_) {
        return false;
    }
    return LIVE_CHECKOUT_ORIGINS.has(normalizedOrigin)
        ? mode === 'live'
        : mode === 'test';
};

const webhookModeAllowed = (livemode, requestUrl) => {
    if (typeof livemode !== 'boolean') return false;
    let origin;
    try {
        origin = new URL(String(requestUrl || '')).origin;
    } catch (_) {
        return false;
    }
    return livemode === LIVE_CHECKOUT_ORIGINS.has(origin);
};

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
    STRIPE_API_VERSION,
    StripeApiError,
    checkoutModeAllowed,
    createCheckoutSession,
    retrieveCheckoutSession,
    stripeKeyMode,
    webhookModeAllowed,
    verifyStripeSignature
};
