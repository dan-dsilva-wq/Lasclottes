'use strict';

const { AVAILABILITY } = require('../lib/booking');
const { isStagingHostname } = require('../lib/config');
const { DatabaseUnavailableError, getDatabaseBlockedRanges } = require('../lib/database');
const { json } = require('../lib/http');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }
    if (isStagingHostname(req.headers?.host || req.headers?.['x-forwarded-host'])) {
        return json(res, 200, {
            ...AVAILABILITY,
            updated: new Date().toISOString().slice(0, 10),
            source: 'Lasclottes booking system',
            blocked: []
        });
    }
    try {
        const dynamic = await getDatabaseBlockedRanges();
        return json(res, 200, {
            ...AVAILABILITY,
            updated: new Date().toISOString().slice(0, 10),
            source: 'Lasclottes booking system',
            blocked: [...AVAILABILITY.blocked, ...dynamic]
        });
    } catch (error) {
        if (!(error instanceof DatabaseUnavailableError)) {
            console.error('Dynamic availability lookup failed.', error?.code || error?.name || 'Error');
        }
        return json(res, 200, AVAILABILITY);
    }
};
