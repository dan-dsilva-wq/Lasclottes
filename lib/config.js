'use strict';

let runtimeValues = {};

const setRuntimeConfig = (values) => {
    runtimeValues = values && typeof values === 'object' ? values : {};
};

const valueFor = (name) => {
    const runtimeValue = runtimeValues[name];
    if (typeof runtimeValue === 'string') return runtimeValue;
    return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
};

const firstValue = (...names) => {
    for (const name of names) {
        const value = valueFor(name);
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const isEnabled = (name) => valueFor(name) === 'true';

const config = {
    databaseUrl: () => firstValue('BOOKINGS_DATABASE_URL', 'DATABASE_URL'),
    stripeSecretKey: () => firstValue('TEST_STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY'),
    stripeWebhookSecret: () => firstValue('TEST_STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET'),
    stripeSuccessUrl: () => firstValue('STRIPE_SUCCESS_URL'),
    stripeCancelUrl: () => firstValue('STRIPE_CANCEL_URL'),
    resendApiKey: () => firstValue('TEST_EMAIL_RESEND_API_KEY', 'RESEND_API_KEY'),
    resendWebhookSecret: () => firstValue('TEST_EMAIL_RESEND_WEBHOOK_SECRET', 'RESEND_WEBHOOK_SECRET'),
    emailDomain: () => firstValue('TEST_EMAIL_RESEND_EMAIL_DOMAIN', 'RESEND_EMAIL_DOMAIN'),
    senderEmail: () => firstValue('BOOKING_SENDER_EMAIL'),
    ownerEmail: () => firstValue('BOOKING_OWNER_EMAIL') || 'info@lasclottes.com',
    paymentsEnabled: () => isEnabled('BOOKING_PAYMENTS_ENABLED'),
    emailsEnabled: () => isEnabled('BOOKING_EMAILS_ENABLED'),
    bookingTermsApproved: () => isEnabled('BOOKING_TERMS_APPROVED')
};

const configuredOrigins = () => {
    const candidates = [
        firstValue('PUBLIC_SITE_URL', 'SITE_URL'),
        firstValue('VERCEL_BRANCH_URL'),
        firstValue('VERCEL_URL'),
        firstValue('VERCEL_PROJECT_PRODUCTION_URL')
    ];
    const origins = [];
    for (const candidate of candidates) {
        if (!candidate) continue;
        try {
            const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
            const parsed = new URL(withProtocol);
            if (['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password) {
                origins.push(parsed.origin);
            }
        } catch (_) {}
    }
    return [...new Set(origins)];
};

const trustedOrigin = () => {
    const [origin] = configuredOrigins();
    if (!origin) throw new Error('A trusted public site URL is not configured.');
    return origin;
};

const requestOriginAllowed = (value) => {
    try {
        const origin = new URL(String(value || '')).origin;
        return configuredOrigins().includes(origin);
    } catch (_) {
        return false;
    }
};

module.exports = {
    config,
    configuredOrigins,
    firstValue,
    requestOriginAllowed,
    setRuntimeConfig,
    trustedOrigin
};
