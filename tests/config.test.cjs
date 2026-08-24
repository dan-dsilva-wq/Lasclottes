'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    config,
    configuredOrigins,
    setRuntimeConfig
} = require('../lib/config');

test('Cloudflare runtime bindings are read explicitly and can be cleared safely', () => {
    setRuntimeConfig({
        BOOKING_PAYMENTS_ENABLED: 'true',
        BOOKINGS_DATABASE_URL: 'postgresql://runtime.invalid/example',
        PUBLIC_SITE_URL: 'https://lasclottes.com'
    });
    try {
        assert.equal(config.paymentsEnabled(), true);
        assert.equal(config.databaseUrl(), 'postgresql://runtime.invalid/example');
        assert.equal(configuredOrigins()[0], 'https://lasclottes.com');
    } finally {
        setRuntimeConfig({});
    }
    assert.notEqual(config.databaseUrl(), 'postgresql://runtime.invalid/example');
});
