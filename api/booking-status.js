'use strict';

const { config } = require('../lib/config');
const { cancelBooking, getBookingBySessionId } = require('../lib/database');
const { json } = require('../lib/http');
const { confirmPaidSession } = require('../lib/payments');
const { retrieveCheckoutSession } = require('../lib/stripe');

const publicStatus = (booking) => {
    if (booking.status === 'paid') return 'confirmed';
    if (['expired', 'checkout_failed', 'cancelled'].includes(booking.status)) return 'not_confirmed';
    return 'processing';
};

const publicDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const candidate = String(value || '');
    const isoDate = /^(\d{4}-\d{2}-\d{2})/.exec(candidate);
    return isoDate ? isoDate[1] : '';
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
            else if (session.status === 'expired') {
                await cancelBooking(booking.id, 'expired');
                booking = { ...booking, status: 'expired' };
            }
        }

        return json(res, 200, {
            status: publicStatus(booking),
            reference: booking.public_reference,
            arrivalDate: publicDate(booking.arrival),
            departureDate: publicDate(booking.departure)
        });
    } catch (error) {
        console.error('Booking status lookup failed.', error?.code || error?.name || 'Error');
        return json(res, 503, { error: 'Booking status is temporarily unavailable.' });
    }
};

module.exports.publicDate = publicDate;
