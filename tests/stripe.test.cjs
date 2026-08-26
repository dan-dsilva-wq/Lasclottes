'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    STRIPE_API_VERSION,
    checkoutModeAllowed,
    createCheckoutSession,
    stripeKeyMode,
    webhookModeAllowed,
    verifyStripeSignature
} = require('../lib/stripe');

test('Stripe API calls pin a tested version, time out and preserve idempotency', async () => {
    const originalFetch = global.fetch;
    let captured;
    global.fetch = async (url, options) => {
        captured = { url, options };
        return { ok: true, json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.test' }) };
    };
    try {
        await createCheckoutSession(
            'sk_test_example',
            new URLSearchParams({ mode: 'payment' }),
            'booking-checkout/test'
        );
    } finally {
        global.fetch = originalFetch;
    }

    assert.equal(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(captured.options.headers['Stripe-Version'], STRIPE_API_VERSION);
    assert.equal(captured.options.headers['Idempotency-Key'], 'booking-checkout/test');
    assert.equal(captured.options.method, 'POST');
    assert.equal(typeof captured.options.signal?.aborted, 'boolean');
});

test('live keys and events are accepted only on the live Lasclottes host', () => {
    assert.equal(stripeKeyMode('sk_test_example'), 'test');
    assert.equal(stripeKeyMode('sk_live_example'), 'live');
    assert.equal(stripeKeyMode('rk_live_example'), '');
    assert.equal(checkoutModeAllowed('sk_test_example', 'https://preview.example'), true);
    assert.equal(checkoutModeAllowed('sk_live_example', 'https://preview.example'), false);
    assert.equal(checkoutModeAllowed('sk_live_example', 'https://test.lasclottes.com'), true);
    assert.equal(checkoutModeAllowed('sk_test_example', 'https://test.lasclottes.com'), false);
    assert.equal(checkoutModeAllowed('sk_live_example', 'https://lasclottes.com'), true);
    assert.equal(checkoutModeAllowed('sk_test_example', 'https://lasclottes.com'), false);
    assert.equal(webhookModeAllowed(false, 'https://lasclottes.super-bread-8b96.workers.dev/api/stripe-webhook'), true);
    assert.equal(webhookModeAllowed(true, 'https://lasclottes.super-bread-8b96.workers.dev/api/stripe-webhook'), false);
    assert.equal(webhookModeAllowed(true, 'https://lasclottes.com/api/stripe-webhook'), true);
    assert.equal(webhookModeAllowed(false, 'https://lasclottes.com/api/stripe-webhook'), false);
    assert.equal(webhookModeAllowed(true, 'https://test.lasclottes.com/api/stripe-webhook'), true);
    assert.equal(webhookModeAllowed(false, 'https://test.lasclottes.com/api/stripe-webhook'), false);
});

test('Stripe webhook signatures are checked against the exact raw body', () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret), true);
    assert.equal(verifyStripeSignature(`${body} `, `t=${timestamp},v1=${signature}`, secret), false);
    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${'0'.repeat(64)}`, secret), false);
});

test('stale webhook signatures are rejected', () => {
    const secret = 'whsec_test_secret';
    const body = '{}';
    const timestamp = Math.floor(Date.now() / 1000) - 1000;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
    assert.equal(verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret), false);
});

test('refund events produce an audit record without deciding cancellation', async () => {
    const { refundRecordFromCharge } = await import('../api/stripe-webhook.mjs');
    assert.deepEqual(refundRecordFromCharge({
        payment_intent: 'pi_test123',
        amount_refunded: 82500,
        refunded: true
    }), {
        paymentIntentId: 'pi_test123',
        amountRefunded: 82500,
        fullyRefunded: true
    });
    assert.throws(() => refundRecordFromCharge({ payment_intent: '', amount_refunded: -1 }));
});
