'use strict';

const { config } = require('../lib/config');
const { getBookingBySessionId } = require('../lib/database');
const { json } = require('../lib/http');
const { confirmPaidSession } = require('../lib/payments');
const { retrieveCheckoutSession } = require('../lib/stripe');

const publicStatus = (booking) => {
    if (booking.status === 'paid') return 'confirmed';
    if (['expired', 'checkout_failed', 'cancelled'].includes(booking.status)) return 'not_confirmed';
    return 'processing';
};

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }
    const sessionId = String(req.query?.session_id || '').slice(0, 200);
    if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
        return json(res, 400, { error: 'Invalid checkout session.' });
    }

    try {
        let booking = await getBookingBySessionId(sessionId);
        if (!booking) return json(res, 404, { error: 'Booking not found.' });

        if (booking.status !== 'paid' && config.stripeSecretKey()) {
            const session = await retrieveCheckoutSession(config.stripeSecretKey(), sessionId);
            if (session.payment_status === 'paid') booking = await confirmPaidSession(session);
        }

        return json(res, 200, {
            status: publicStatus(booking),
            reference: booking.public_reference,
            arrivalDate: String(booking.arrival).slice(0, 10),
            departureDate: String(booking.departure).slice(0, 10)
        });
    } catch (error) {
        console.error('Booking status lookup failed.', error?.code || error?.name || 'Error');
        return json(res, 503, { error: 'Booking status is temporarily unavailable.' });
    }
};
