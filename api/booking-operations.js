'use strict';

const { config } = require('../lib/config');
const { listEmailDeliveryIssues } = require('../lib/database');
const { EMAIL_DELIVERY_KINDS, retryBookingEmailDelivery } = require('../lib/email');
const { configuredOperationsToken, operationsAuthorized } = require('../lib/operations-auth');

const responseHeaders = (res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');
};

const parseBody = (body) => {
    if (body && typeof body === 'object') return body;
    if (typeof body !== 'string' || body.length > 2_000) throw new Error('Invalid request body.');
    const parsed = JSON.parse(body || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid request body.');
    return parsed;
};

const normalizeReference = (value) => {
    const reference = String(value || '').trim().toUpperCase();
    return /^LC-[A-Z0-9]{6,20}$/.test(reference) ? reference : '';
};

const publicIssue = (row) => ({
    reference: String(row.public_reference || ''),
    guestName: `${String(row.first_name || '').trim()} ${String(row.last_name || '').trim()}`.trim(),
    guestEmail: String(row.email || ''),
    guestPhone: String(row.phone || ''),
    arrival: String(row.arrival || '').slice(0, 10),
    departure: String(row.departure || '').slice(0, 10),
    kind: String(row.kind || ''),
    status: String(row.provider_status || row.status || 'failed'),
    attempts: Number(row.attempts || 0),
    detail: String(row.provider_status_detail || row.last_error || '').slice(0, 250),
    updatedAt: row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at || '')
});

const handler = async (req, res) => {
    responseHeaders(res);
    const expectedToken = configuredOperationsToken(config.operationsToken());
    if (!expectedToken) {
        return res.status(503).json({ error: 'Booking operations access is not configured.' });
    }
    if (!await operationsAuthorized(req.headers?.authorization, expectedToken)) {
        res.setHeader('WWW-Authenticate', 'Bearer realm="Lasclottes booking operations"');
        return res.status(401).json({ error: 'Access denied.' });
    }

    if (req.method === 'GET') {
        try {
            const rows = await listEmailDeliveryIssues();
            return res.status(200).json({ issues: rows.map(publicIssue) });
        } catch (error) {
            console.error('Booking operations could not list email issues.', error?.code || error?.name || 'Error');
            return res.status(503).json({ error: 'Booking operations are temporarily unavailable.' });
        }
    }

    if (req.method === 'POST') {
        let body;
        try {
            body = parseBody(req.body);
        } catch (_) {
            return res.status(400).json({ error: 'Invalid request body.' });
        }
        const reference = normalizeReference(body.reference);
        const kind = String(body.kind || '');
        if (body.action !== 'retry_email' || !reference || !EMAIL_DELIVERY_KINDS.has(kind)) {
            return res.status(400).json({ error: 'Invalid email retry request.' });
        }
        try {
            const result = await retryBookingEmailDelivery(reference, kind);
            if (!result) {
                return res.status(409).json({ error: 'This email is not currently retryable or has reached its retry limit.' });
            }
            return res.status(200).json({ retried: true, reference: result.reference, kind: result.kind });
        } catch (error) {
            console.error('Booking operations could not retry an email.', error?.code || error?.name || 'Error');
            return res.status(503).json({ error: 'The email could not be retried safely.' });
        }
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
};

module.exports = handler;
module.exports.normalizeReference = normalizeReference;
module.exports.parseBody = parseBody;
module.exports.publicIssue = publicIssue;
