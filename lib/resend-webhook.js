'use strict';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const TRACKED_EVENTS = new Map([
    ['email.sent', 'sent'],
    ['email.delivered', 'delivered'],
    ['email.delivery_delayed', 'delayed'],
    ['email.bounced', 'bounced'],
    ['email.complained', 'complained'],
    ['email.failed', 'failed'],
    ['email.suppressed', 'suppressed']
]);

const decodeBase64 = (value) => {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const verifyResendSignature = async ({ rawBody, messageId, timestamp, signature, secret, nowSeconds }) => {
    if (typeof rawBody !== 'string' || !messageId || !timestamp || !signature || !secret) return false;
    if (!/^\d{1,12}$/.test(String(timestamp))) return false;
    const sentAt = Number(timestamp);
    const now = Number.isFinite(nowSeconds) ? Math.floor(nowSeconds) : Math.floor(Date.now() / 1000);
    if (!Number.isSafeInteger(sentAt) || Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_SECONDS) return false;

    let key;
    try {
        const encodedSecret = String(secret).replace(/^whsec_/, '');
        key = decodeBase64(encodedSecret);
        if (!key.length) return false;
    } catch (_) {
        return false;
    }

    const signedPayload = new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );
    for (const versionedSignature of String(signature).split(/\s+/)) {
        const [version, encodedSignature] = versionedSignature.split(',', 2);
        if (version !== 'v1' || !encodedSignature) continue;
        try {
            if (await globalThis.crypto.subtle.verify(
                'HMAC',
                cryptoKey,
                decodeBase64(encodedSignature),
                signedPayload
            )) return true;
        } catch (_) {}
    }
    return false;
};

const firstDetail = (...values) => {
    const value = values.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return value ? value.trim().slice(0, 250) : '';
};

const resendEventRecord = (event) => {
    const providerStatus = TRACKED_EVENTS.get(event?.type);
    if (!providerStatus) return null;
    const providerId = String(event?.data?.email_id || '');
    const parsedCreatedAt = new Date(event?.created_at);
    if (!providerId || providerId.length > 200 || Number.isNaN(parsedCreatedAt.getTime())) {
        throw new Error('Invalid Resend email event.');
    }
    return {
        eventType: event.type,
        providerId,
        providerStatus,
        eventCreatedAt: parsedCreatedAt.toISOString(),
        detail: firstDetail(
            event?.data?.bounce?.message,
            event?.data?.suppressed?.message,
            event?.data?.failed?.reason,
            event?.data?.complaint?.message
        )
    };
};

module.exports = {
    SIGNATURE_TOLERANCE_SECONDS,
    resendEventRecord,
    verifyResendSignature
};
