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
    emailDomain: () => firstValue('TEST_EMAIL_RESEND_EMAIL_DOMAIN', 'RESEND_EMAIL_DOMAIN'),
    ownerEmail: () => firstValue('BOOKING_OWNER_EMAIL') || 'info@lasclottes.com',
    paymentsEnabled: () => isEnabled('BOOKING_PAYMENTS_ENABLED'),
    emailsEnabled: () => isEnabled('BOOKING_EMAILS_ENABLED')
};

const trustedOrigin = () => {
    const configured = firstValue('PUBLIC_SITE_URL', 'SITE_URL');
    const providerHost = firstValue(
        'VERCEL_BRANCH_URL',
        'VERCEL_URL',
        'VERCEL_PROJECT_PRODUCTION_URL'
    );
    const candidate = configured || (providerHost ? `https://${providerHost}` : '');
    if (!candidate) throw new Error('A trusted public site URL is not configured.');

    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('The configured public site URL is invalid.');
    }
    return parsed.origin;
};

module.exports = { config, firstValue, trustedOrigin };
