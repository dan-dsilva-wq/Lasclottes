'use strict';

const json = (res, status, payload) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(status).json(payload);
};

const parseBody = (req) => {
    if (!req.body) return {};
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try {
            return JSON.parse(req.body.toString('utf8'));
        } catch (_) {
            return {};
        }
    }
    return {};
};

const readRawBody = async (req) => {
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    if (typeof req.body === 'string') return req.body;
    if (req.body && typeof req.body === 'object') {
        throw new Error('Webhook body was parsed before signature verification.');
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
};

module.exports = { json, parseBody, readRawBody };
