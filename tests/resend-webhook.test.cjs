'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
    SIGNATURE_TOLERANCE_SECONDS,
    resendEventRecord,
    verifyResendSignature
} = require('../lib/resend-webhook');

const secretBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const secret = `whsec_${Buffer.from(secretBytes).toString('base64')}`;

const sign = async ({ rawBody, messageId, timestamp }) => {
    const key = await globalThis.crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`)
    );
    return `v1,${Buffer.from(signature).toString('base64')}`;
};

test('Resend webhook verification accepts an authentic fresh raw body', async () => {
    const nowSeconds = 1_800_000_000;
    const timestamp = String(nowSeconds - 10);
    const rawBody = '{"type":"email.delivered","data":{"email_id":"email-123"}}';
    const messageId = 'msg_test_123';
    const signature = await sign({ rawBody, messageId, timestamp });
    assert.equal(await verifyResendSignature({
        rawBody,
        messageId,
        timestamp,
        signature,
        secret,
        nowSeconds
    }), true);
});

test('Resend webhook verification rejects body changes and stale messages', async () => {
    const nowSeconds = 1_800_000_000;
    const timestamp = String(nowSeconds - 10);
    const rawBody = '{"type":"email.delivered"}';
    const messageId = 'msg_test_456';
    const signature = await sign({ rawBody, messageId, timestamp });
    assert.equal(await verifyResendSignature({
        rawBody: `${rawBody} `,
        messageId,
        timestamp,
        signature,
        secret,
        nowSeconds
    }), false);
    assert.equal(await verifyResendSignature({
        rawBody,
        messageId,
        timestamp: String(nowSeconds - SIGNATURE_TOLERANCE_SECONDS - 1),
        signature,
        secret,
        nowSeconds
    }), false);
});

test('Resend delivery events normalize to auditable provider records', () => {
    assert.deepEqual(resendEventRecord({
        type: 'email.bounced',
        created_at: '2026-08-24T12:00:00.000Z',
        data: {
            email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
            bounce: { message: 'Mailbox rejected the message.' }
        }
    }), {
        eventType: 'email.bounced',
        providerId: '56761188-7520-42d8-8898-ff6fc54ce618',
        providerStatus: 'bounced',
        eventCreatedAt: '2026-08-24T12:00:00.000Z',
        detail: 'Mailbox rejected the message.'
    });
    assert.equal(resendEventRecord({ type: 'email.opened' }), null);
});

test('Resend delivery records reject missing provider identifiers', () => {
    assert.throws(() => resendEventRecord({
        type: 'email.delivered',
        created_at: '2026-08-24T12:00:00.000Z',
        data: {}
    }), /Invalid Resend email event/);
});
