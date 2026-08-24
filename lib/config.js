'use strict';

const firstValue = (...names) => {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
};

const isEnabled = (name) => process.env[name] === 'true';

const config = {
    databaseUrl: () => firstValue('BOOKINGS_DATABASE_URL', 'DATABASE_URL'),
    stripeSecretKey: () => firstValue('TEST_STRIPE_SECRET_KEY', 'STRIPE_SECRET_KEY'),
    stripeWebhookSecret: () => firstValue('TEST_STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET'),
    resendApiKey: () => firstValue('TEST_EMAIL_RESEND_API_KEY', 'RESEND_API_KEY'),
    resendWebhookSecret: () => firstValue('TEST_EMAIL_RESEND_WEBHOOK_SECRET', 'RESEND_WEBHOOK_SECRET'),
    emailDomain: () => firstValue('TEST_EMAIL_RESEND_EMAIL_DOMAIN', 'RESEND_EMAIL_DOMAIN'),
    ownerEmail: () => firstValue('BOOKING_OWNER_EMAIL') || 'info@lasclottes.com',
    paymentsEnabled: () => isEnabled('BOOKING_PAYMENTS_ENABLED'),
    emailsEnabled: () => isEnabled('BOOKING_EMAILS_ENABLED')
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

module.exports = { config, configuredOrigins, firstValue, requestOriginAllowed, trustedOrigin };
