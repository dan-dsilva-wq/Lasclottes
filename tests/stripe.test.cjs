'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyStripeSignature } = require('../lib/stripe');

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
