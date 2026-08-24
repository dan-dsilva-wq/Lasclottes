'use strict';

const { AVAILABILITY } = require('../lib/booking');
const { DatabaseUnavailableError, getDatabaseBlockedRanges } = require('../lib/database');
const { json } = require('../lib/http');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
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
