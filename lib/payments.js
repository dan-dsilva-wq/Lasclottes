'use strict';

const {
    getBookingById,
    getBookingByPublicReference,
    getBookingBySessionId,
    markBookingPaid
} = require('./database');
const { sendBookingConfirmationOnce } = require('./email');

const bookingForSession = async (session) => {
    const bookingId = session?.metadata?.booking_id || session?.client_reference_id;
    if (bookingId) {
        const byId = await getBookingById(bookingId);
        if (byId) return byId;
    }
    const reference = session?.metadata?.booking_reference;
    if (reference) {
        const byReference = await getBookingByPublicReference(reference);
        if (byReference) return byReference;
    }
    return session?.id ? getBookingBySessionId(session.id) : null;
};

const confirmPaidSession = async (session) => {
    if (!session?.id || session.payment_status !== 'paid') {
        throw new Error('Checkout session is not paid.');
    }
    const booking = await bookingForSession(session);
    if (!booking) throw new Error('Booking record was not found.');

    const amountTotal = Number(session.amount_total);
    const currency = String(session.currency || '').toLowerCase();
    if (!Number.isInteger(amountTotal) || amountTotal !== booking.amount_due_now_pence || currency !== 'gbp') {
        throw new Error('Checkout amount does not match the booking record.');
    }

    const paidBooking = await markBookingPaid({
        bookingId: booking.id,
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amountTotal,
        currency
    });
    if (!paidBooking) throw new Error('Booking payment could not be reconciled.');
    await sendBookingConfirmationOnce(paidBooking);
    return paidBooking;
};

module.exports = { bookingForSession, confirmPaidSession };
