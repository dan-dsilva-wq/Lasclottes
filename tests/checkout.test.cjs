'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/create-stripe-checkout');

const makeResponse = () => {
    const state = { status: null, body: null };
    return {
        state,
        response: {
            setHeader() {},
            status(code) { state.status = code; return this; },
            json(body) { state.body = body; return this; }
        }
    };
};

test('payment safety gate is closed unless explicitly enabled', async () => {
    const previous = process.env.BOOKING_PAYMENTS_ENABLED;
    delete process.env.BOOKING_PAYMENTS_ENABLED;
    try {
        const result = makeResponse();
        await handler({ method: 'POST', body: {} }, result.response);
        assert.equal(result.state.status, 503);
        assert.equal(result.state.body.code, 'payments_disabled');
    } finally {
        if (previous === undefined) delete process.env.BOOKING_PAYMENTS_ENABLED;
        else process.env.BOOKING_PAYMENTS_ENABLED = previous;
    }
});

test('Stripe line items use the database amount, not browser totals', () => {
    const quote = handler.calculateQuote({
        arrivalDate: '2027-05-15',
        departureDate: '2027-05-19',
        adults: 4,
        children: 0,
        amountDueNow: 0.01
    }, new Date('2026-08-24T12:00:00Z'));
    const params = handler.checkoutParams({
        booking: {
            id: '00000000-0000-4000-8000-000000000000',
            public_reference: 'LC-TEST0001',
            amount_due_now_pence: 20000
        },
        quote,
        contact: { email: 'guest@example.test', lang: 'en' },
        origin: 'https://preview.example'
    });

    assert.equal(params.get('line_items[0][price_data][unit_amount]'), '20000');
    assert.equal(params.get('metadata[stay_total_gbp]'), '800.00');
    assert.equal(params.get('metadata[tourist_tax_eur]'), '22.56');
    assert.match(params.get('success_url'), /^https:\/\/preview\.example\/payment-success\.html/);
});
