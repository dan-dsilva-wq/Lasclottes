'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    BookingValidationError,
    calculateQuote,
    normalizeRequestId,
    validateContact
} = require('../lib/booking');

test('high-season weekly booking is priced by the server', () => {
    const quote = calculateQuote({
        arrivalDate: '2027-07-17',
        departureDate: '2027-07-24',
        adults: 8,
        children: 2
    }, new Date('2026-08-24T12:00:00Z'));
    assert.equal(quote.stayTotal, 3300);
    assert.equal(quote.amountDueNow, 825);
    assert.equal(quote.balanceDueLater, 2975);
    assert.equal(quote.touristTaxEur, 78.96);
});

test('near-term bookings charge the full stay and refundable damage deposit', () => {
    const quote = calculateQuote({
        arrivalDate: '2027-05-20',
        departureDate: '2027-05-24',
        adults: 4,
        children: 0
    }, new Date('2027-04-01T12:00:00Z'));
    assert.equal(quote.stayTotal, 800);
    assert.equal(quote.amountDueNow, 1300);
    assert.equal(quote.balanceDueLater, 0);
    assert.equal(quote.paymentStage, 'full_payment_now');
    assert.equal(quote.touristTaxEur, 22.56);
});

test('blocked dates and invalid seasonal patterns are rejected', () => {
    assert.throws(() => calculateQuote({
        arrivalDate: '2027-07-10',
        departureDate: '2027-07-17',
        adults: 2,
        children: 0
    }, new Date('2026-08-24T12:00:00Z')), BookingValidationError);

    assert.throws(() => calculateQuote({
        arrivalDate: '2027-07-18',
        departureDate: '2027-07-25',
        adults: 2,
        children: 0
    }, new Date('2026-08-24T12:00:00Z')), /Saturday to Saturday/);
});

test('contact data and checkout request IDs are normalized', () => {
    const contact = validateContact({
        firstName: ' Sally ',
        lastName: ' Spencer ',
        email: 'SALLY@EXAMPLE.COM',
        phone: '+44 123',
        message: '  Please prepare the cot.  ',
        agreementAccepted: true,
        lang: 'fr'
    });
    assert.deepEqual(contact, {
        firstName: 'Sally',
        lastName: 'Spencer',
        email: 'sally@example.com',
        phone: '+44 123',
        message: 'Please prepare the cot.',
        lang: 'fr'
    });
    assert.equal(validateContact({
        firstName: 'Sally',
        lastName: 'Spencer',
        email: 'sally@example.com',
        phone: '+44 123',
        message: 'x'.repeat(1600),
        agreementAccepted: true,
        lang: 'en'
    }).message.length, 1500);
    assert.equal(normalizeRequestId('abcdefghijklmnop'), 'abcdefghijklmnop');
    assert.match(normalizeRequestId('bad'), /^[0-9a-f-]{36}$/);
});
