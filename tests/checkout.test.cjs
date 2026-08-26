'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { checkoutFingerprint, requestAddress } = require('../lib/abuse');
const { configuredOrigins, requestOriginAllowed, trustedOrigin } = require('../lib/config');
const bookingStatusHandler = require('../api/booking-status');
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
    assert.equal(params.get('submit_type'), 'book');
    assert.equal(params.get('locale'), 'en');
    assert.equal(params.get('metadata[stay_total_gbp]'), '800.00');
    assert.equal(params.get('metadata[tourist_tax_eur]'), '22.56');
    assert.match(params.get('metadata[booking_terms_version]'), /^2026-08-26-/);
    assert.match(params.get('success_url'), /^https:\/\/preview\.example\/payment-success\.html/);
});

test('the live domain cannot accept payment until the owner approves the terms', () => {
    assert.equal(handler.termsApprovalRequired('https://lasclottes.com', false), true);
    assert.equal(handler.termsApprovalRequired('https://www.lasclottes.com', false), true);
    assert.equal(handler.termsApprovalRequired('https://lasclottes.com', true), false);
    assert.equal(handler.termsApprovalRequired('https://review.example.vercel.app', false), false);
});

test('preview checkout returns to the branch that created it', () => {
    const previous = {
        PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
        SITE_URL: process.env.SITE_URL,
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL
    };
    try {
        delete process.env.PUBLIC_SITE_URL;
        delete process.env.SITE_URL;
        process.env.VERCEL_BRANCH_URL = 'preview.example.vercel.app';
        process.env.VERCEL_URL = 'deployment.example.vercel.app';
        process.env.VERCEL_PROJECT_PRODUCTION_URL = 'production.example.vercel.app';
        assert.equal(trustedOrigin(), 'https://preview.example.vercel.app');
    } finally {
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});

test('checkout accepts only configured site origins', () => {
    const previous = {
        PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
        SITE_URL: process.env.SITE_URL,
        VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL
    };
    try {
        process.env.PUBLIC_SITE_URL = 'https://lasclottes.com';
        process.env.VERCEL_BRANCH_URL = 'review.example.vercel.app';
        process.env.VERCEL_URL = 'deployment.example.vercel.app';
        delete process.env.SITE_URL;
        delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
        assert.deepEqual(configuredOrigins(), [
            'https://lasclottes.com',
            'https://review.example.vercel.app',
            'https://deployment.example.vercel.app'
        ]);
        assert.equal(requestOriginAllowed('https://review.example.vercel.app'), true);
        assert.equal(requestOriginAllowed('https://evil.example'), false);
        assert.equal(requestOriginAllowed('null'), false);
        assert.equal(handler.checkoutOrigin('https://review.example.vercel.app/path'), 'https://review.example.vercel.app');
        assert.equal(handler.checkoutOrigin('https://evil.example'), '');
    } finally {
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
    }
});

test('checkout rate-limit fingerprints do not retain visitor addresses', () => {
    const request = {
        headers: {
            'cf-connecting-ip': '203.0.113.42',
            'user-agent': 'Lasclottes test browser'
        }
    };
    const fingerprint = checkoutFingerprint(request, 'test-secret');
    assert.equal(requestAddress(request.headers), '203.0.113.42');
    assert.match(fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(fingerprint.includes('203.0.113.42'), false);
    assert.equal(checkoutFingerprint(request, 'test-secret'), fingerprint);
    assert.notEqual(checkoutFingerprint(request, 'different-secret'), fingerprint);
});

test('booking dates stay ISO formatted when the database returns Date objects', () => {
    assert.equal(
        bookingStatusHandler.publicDate(new Date('2027-05-20T00:00:00.000Z')),
        '2027-05-20'
    );
    assert.equal(bookingStatusHandler.publicDate('2027-05-24'), '2027-05-24');
});
