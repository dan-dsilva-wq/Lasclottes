'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    config,
    configuredOrigins,
    isStagingHostname,
    isStagingOrigin,
    setRuntimeConfig
} = require('../lib/config');

test('Cloudflare runtime bindings are read explicitly and can be cleared safely', () => {
    setRuntimeConfig({
        BOOKING_PAYMENTS_ENABLED: 'true',
        BOOKINGS_DATABASE_URL: 'postgresql://runtime.invalid/example',
        PUBLIC_SITE_URL: 'https://lasclottes.com',
        STRIPE_SUCCESS_URL: 'https://staging.example/payment-complete',
        STRIPE_CANCEL_URL: 'https://staging.example/payment-cancelled',
        WIX_BOOKING_BRIDGE_TOKEN: 'wix-bridge-token-value-that-is-long-enough',
        WIX_SITE_BASE_URLS: 'https://example.wixsite.com/lasclottes-draft, https://lasclottes.com',
        WIX_BOOKING_TEST_MODE: 'true',
        WIX_LIVE_PAYMENTS: 'true',
        STRIPE_LIVE_WEBHOOKS_ON_SHARED_ENDPOINT: 'true',
        STRIPE_LIVE_SECRET_KEY: 'rk_live_runtime_example',
        STRIPE_LIVE_WEBHOOK_SECRET: 'whsec_live_runtime_example',
        BOOKING_MONITOR_EMAILS: 'sally@example.com, dan@example.com'
    });
    try {
        assert.equal(config.paymentsEnabled(), true);
        assert.equal(config.databaseUrl(), 'postgresql://runtime.invalid/example');
        assert.equal(config.stripeSuccessUrl(), 'https://staging.example/payment-complete');
        assert.equal(config.stripeCancelUrl(), 'https://staging.example/payment-cancelled');
        assert.equal(config.wixBridgeToken(), 'wix-bridge-token-value-that-is-long-enough');
        assert.deepEqual(config.wixSiteBaseUrls(), [
            'https://example.wixsite.com/lasclottes-draft',
            'https://lasclottes.com'
        ]);
        assert.equal(config.wixTestMode(), true);
        assert.equal(config.wixLivePayments(), true);
        assert.equal(config.liveStripeWebhooksOnSharedEndpoint(), true);
        assert.equal(config.stripeLiveSecretKey(), 'rk_live_runtime_example');
        assert.equal(config.stripeLiveWebhookSecret(), 'whsec_live_runtime_example');
        assert.deepEqual(config.monitorEmails(), ['sally@example.com', 'dan@example.com']);
        assert.equal(configuredOrigins()[0], 'https://lasclottes.com');
    } finally {
        setRuntimeConfig({});
    }
    assert.notEqual(config.databaseUrl(), 'postgresql://runtime.invalid/example');
});

test('test-price mode is restricted to the dedicated test origins', () => {
    assert.equal(isStagingOrigin('https://lasclottes.super-bread-8b96.workers.dev'), true);
    assert.equal(isStagingOrigin('https://test.lasclottes.com'), true);
    assert.equal(isStagingOrigin('https://lasclottes.com'), false);
    assert.equal(isStagingOrigin('https://lasclottes.super-bread-8b96.workers.dev.evil.example'), false);
    assert.equal(isStagingHostname('lasclottes.super-bread-8b96.workers.dev'), true);
    assert.equal(isStagingHostname('lasclottes.super-bread-8b96.workers.dev:443'), true);
    assert.equal(isStagingHostname('test.lasclottes.com'), true);
    assert.equal(isStagingHostname('lasclottes.super-bread-8b96.workers.dev.evil.example'), false);
});
