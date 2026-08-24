'use strict';

const crypto = require('node:crypto');

const headerValue = (headers, name) => {
    if (!headers) return '';
    const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
};

const requestAddress = (headers) => {
    const candidate = headerValue(headers, 'cf-connecting-ip')
        || headerValue(headers, 'x-real-ip')
        || headerValue(headers, 'x-forwarded-for').split(',')[0];
    return candidate.trim().slice(0, 80);
};

const checkoutFingerprint = (req, secret) => {
    const key = String(secret || '');
    const address = requestAddress(req?.headers);
    const userAgent = headerValue(req?.headers, 'user-agent').trim().slice(0, 240);
    if (!key || !address) throw new Error('Checkout abuse protection is not configured.');
    return crypto
        .createHmac('sha256', key)
        .update(`booking-checkout-v1\n${address}\n${userAgent}`, 'utf8')
        .digest('hex');
};

module.exports = { checkoutFingerprint, headerValue, requestAddress };
