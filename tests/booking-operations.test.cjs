'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const handler = require('../api/booking-operations');
const {
    bearerToken,
    configuredOperationsToken,
    operationsAuthorized
} = require('../lib/operations-auth');
const { emailIdempotencyKey } = require('../lib/email');

const root = path.resolve(__dirname, '..');
const makeResponse = () => {
    const state = { status: null, body: null, headers: new Map() };
    return {
        state,
        response: {
            setHeader(name, value) { state.headers.set(String(name).toLowerCase(), String(value)); },
            status(code) { state.status = code; return this; },
            json(body) { state.body = body; return this; }
        }
    };
};

test('booking operations tokens fail closed and use a timing-safe digest comparison', async () => {
    const token = 'test-only-operations-token-1234567890-abcdef';
    assert.equal(configuredOperationsToken('short'), '');
    assert.equal(configuredOperationsToken(token), token);
    assert.equal(bearerToken(`Bearer ${token}`), token);
    assert.equal(bearerToken(token), '');
    assert.equal(await operationsAuthorized(`Bearer ${token}`, token), true);
    assert.equal(await operationsAuthorized('Bearer wrong-token-that-is-long-enough-123456', token), false);
});

test('booking operations API is unavailable without a secret and rejects invalid authorization', async () => {
    const previous = process.env.BOOKING_OPERATIONS_TOKEN;
    try {
        delete process.env.BOOKING_OPERATIONS_TOKEN;
        const unconfigured = makeResponse();
        await handler({ method: 'GET', headers: {} }, unconfigured.response);
        assert.equal(unconfigured.state.status, 503);
        assert.match(unconfigured.state.headers.get('cache-control'), /no-store/);

        process.env.BOOKING_OPERATIONS_TOKEN = 'test-only-operations-token-1234567890-abcdef';
        const denied = makeResponse();
        await handler({ method: 'GET', headers: { authorization: 'Bearer wrong-token-that-is-long-enough-123456' } }, denied.response);
        assert.equal(denied.state.status, 401);
        assert.match(denied.state.headers.get('www-authenticate'), /Bearer/);
    } finally {
        if (previous === undefined) delete process.env.BOOKING_OPERATIONS_TOKEN;
        else process.env.BOOKING_OPERATIONS_TOKEN = previous;
    }
});

test('authorized booking operations validate retry requests before touching booking data', async () => {
    const previous = process.env.BOOKING_OPERATIONS_TOKEN;
    const token = 'test-only-operations-token-1234567890-abcdef';
    try {
        process.env.BOOKING_OPERATIONS_TOKEN = token;
        const result = makeResponse();
        await handler({
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
            body: JSON.stringify({ action: 'retry_email', reference: 'not-a-booking', kind: 'guest_payment_confirmation' })
        }, result.response);
        assert.equal(result.state.status, 400);
    } finally {
        if (previous === undefined) delete process.env.BOOKING_OPERATIONS_TOKEN;
        else process.env.BOOKING_OPERATIONS_TOKEN = previous;
    }
});

test('manual retries use a new provider idempotency generation without weakening ordinary retries', () => {
    assert.equal(
        emailIdempotencyKey('guest_payment_confirmation', 'booking-id', 1),
        'guest_payment_confirmation/booking-id/v1'
    );
    assert.equal(
        emailIdempotencyKey('guest_payment_confirmation', 'booking-id', 2),
        'guest_payment_confirmation/booking-id/v2'
    );
});

test('the private operations page is excluded from search and the public sitemap', () => {
    const page = fs.readFileSync(path.join(root, 'booking-operations.html'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'js', 'booking-operations.js'), 'utf8');
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const database = fs.readFileSync(path.join(root, 'lib', 'database.js'), 'utf8');

    assert.match(page, /noindex, nofollow, noarchive/);
    assert.match(page, /type="password"/);
    assert.match(page, /js\/booking-operations\.js/);
    assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/i);
    assert.doesNotMatch(sitemap, /booking-operations/);
    assert.match(script, /window\.confirm/);
    assert.match(database, /delivery\.attempts < \$\{maxAttempts\}/);
    assert.ok(fs.existsSync(path.join(root, 'migrations', '004_email_retry.sql')));
});
