'use strict';

const crypto = require('node:crypto');
const AVAILABILITY = require('../data/availability.json');

const DAY_MS = 24 * 60 * 60 * 1000;

const BOOKING_RULES = Object.freeze({
    maxGuests: 12,
    maxStayNights: 366,
    highSeasonWeeklyRate: 3500,
    midSeasonNightlyRate: 250,
    midSeasonReducedNightlyRate: 200,
    touristTaxStatus: 'pending_owner_confirmation',
    refundableDamageDeposit: 500,
    depositRate: 0.20,
    fullPaymentWindowDays: 60
});

class BookingValidationError extends Error {
    constructor(message, code = 'invalid_booking') {
        super(message);
        this.name = 'BookingValidationError';
        this.code = code;
    }
}

const safeString = (value, max = 120) => {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, max);
};

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const toMinorUnits = (amount) => Math.round(roundMoney(amount) * 100);

const parseDate = (value, fieldName) => {
    const normalized = safeString(value, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) throw new BookingValidationError(`Invalid ${fieldName}.`, `invalid_${fieldName}`);

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        throw new BookingValidationError(`Invalid ${fieldName}.`, `invalid_${fieldName}`);
    }
    return date;
};

const todayUtc = (now = new Date()) => new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
));

const requireInteger = (value, fieldName, min, max) => {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
        throw new BookingValidationError(`Invalid ${fieldName}.`, `invalid_${fieldName}`);
    }
    return numeric;
};

const blockedDateRange = (arrival, departure, blocked = AVAILABILITY.blocked) => {
    const ranges = Array.isArray(blocked) ? blocked : [];
    return ranges.find((range) => {
        const blockStart = parseDate(range.start, 'availability_start');
        const blockEnd = parseDate(range.end, 'availability_end');
        return arrival < blockEnd && departure > blockStart;
    });
};

const calculateQuote = (input, now = new Date(), blocked = AVAILABILITY.blocked, options = {}) => {
    const testMode = options?.testMode === true;
    const arrival = parseDate(input.arrivalDate, 'arrival_date');
    const departure = parseDate(input.departureDate, 'departure_date');
    const currentDay = todayUtc(now);

    if (arrival < currentDay) {
        throw new BookingValidationError('Arrival date cannot be in the past.', 'arrival_in_past');
    }

    const nights = Math.round((departure - arrival) / DAY_MS);
    if (nights <= 0 || nights > BOOKING_RULES.maxStayNights) {
        throw new BookingValidationError('Invalid stay length.', 'invalid_stay_length');
    }

    if (!testMode && blockedDateRange(arrival, departure, blocked)) {
        throw new BookingValidationError(
            'Those dates are already booked or unavailable. Please choose different dates.',
            'dates_unavailable'
        );
    }

    const adults = requireInteger(input.adults, 'adults', 1, BOOKING_RULES.maxGuests);
    const children = requireInteger(input.children ?? 0, 'children', 0, BOOKING_RULES.maxGuests);
    const guests = adults + children;
    if (guests > BOOKING_RULES.maxGuests) {
        throw new BookingValidationError(
            `Maximum occupancy is ${BOOKING_RULES.maxGuests} guests.`,
            'maximum_occupancy'
        );
    }

    const months = new Set();
    for (let offset = 0; offset < nights; offset += 1) {
        months.add(new Date(arrival.getTime() + offset * DAY_MS).getUTCMonth());
    }

    if (!testMode && [...months].some((month) => [9, 10, 11, 0, 1, 2, 3].includes(month))) {
        throw new BookingValidationError('October to April is currently closed.', 'closed_season');
    }

    const isHighSeason = [...months].some((month) => [6, 7].includes(month));
    let stayTotal;
    let season;

    if (testMode) {
        season = 'test';
        stayTotal = 1;
    } else if (isHighSeason) {
        if (nights < 7 || nights % 7 !== 0 || arrival.getUTCDay() !== 6 || departure.getUTCDay() !== 6) {
            throw new BookingValidationError(
                'July and August bookings must run Saturday to Saturday in weekly blocks.',
                'invalid_high_season_dates'
            );
        }
        season = 'high';
        stayTotal = BOOKING_RULES.highSeasonWeeklyRate * (nights / 7);
    } else {
        if (nights < 4) {
            throw new BookingValidationError(
                'The minimum stay is four nights in May, June and September.',
                'minimum_stay'
            );
        }
        season = 'mid';
        stayTotal = (guests <= 6
            ? BOOKING_RULES.midSeasonReducedNightlyRate
            : BOOKING_RULES.midSeasonNightlyRate) * nights;
    }

    // The 2026 Fumel Vallée du Lot tariff depends on the property's valid
    // Atout France classification. Keep the amount unknown until Sally's
    // classification and tax treatment have been professionally confirmed.
    const touristTaxEur = null;
    let damageDeposit = BOOKING_RULES.refundableDamageDeposit;
    const daysUntilArrival = Math.ceil((arrival - currentDay) / DAY_MS);
    const fullPaymentDueNow = daysUntilArrival <= BOOKING_RULES.fullPaymentWindowDays;
    let amountDueNow = roundMoney(fullPaymentDueNow
        ? stayTotal + damageDeposit
        : stayTotal * BOOKING_RULES.depositRate);
    let balanceDueLater = roundMoney(fullPaymentDueNow
        ? 0
        : (stayTotal - amountDueNow) + damageDeposit);

    // Used only by the dedicated workers.dev staging origin for an end-to-end test purchase.
    const testPriceGbp = Number(options?.testPriceGbp);
    if (Number.isFinite(testPriceGbp) && testPriceGbp > 0) {
        stayTotal = roundMoney(testPriceGbp);
        damageDeposit = 0;
        amountDueNow = stayTotal;
        balanceDueLater = 0;
    }

    return {
        arrivalDate: safeString(input.arrivalDate, 10),
        departureDate: safeString(input.departureDate, 10),
        adults,
        children,
        guests,
        nights,
        season,
        stayTotal: roundMoney(stayTotal),
        touristTaxEur,
        touristTaxStatus: BOOKING_RULES.touristTaxStatus,
        damageDeposit,
        amountDueNow,
        balanceDueLater,
        paymentStage: testMode || fullPaymentDueNow ? 'full_payment_now' : 'deposit_now_balance_later'
    };
};

const validateContact = (input) => {
    const firstName = safeString(input.firstName, 80);
    const lastName = safeString(input.lastName, 80);
    const email = safeString(input.email, 150).toLowerCase();
    const phone = safeString(input.phone, 60);
    const message = safeString(input.message, 1500);
    const requestedLang = safeString(input.lang, 2).toLowerCase();
    const lang = ['en', 'fr', 'nl'].includes(requestedLang) ? requestedLang : 'en';

    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone) {
        throw new BookingValidationError('Please provide valid contact details.', 'invalid_contact');
    }
    if (input.agreementAccepted !== true) {
        throw new BookingValidationError(
            'Please accept the equipment and safety agreement.',
            'agreement_required'
        );
    }
    return { firstName, lastName, email, phone, message, lang };
};

const normalizeRequestId = (value) => {
    const candidate = safeString(value, 80);
    return /^[A-Za-z0-9_-]{16,80}$/.test(candidate) ? candidate : crypto.randomUUID();
};

const publicReference = () => `LC-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

module.exports = {
    AVAILABILITY,
    BOOKING_RULES,
    BookingValidationError,
    calculateQuote,
    normalizeRequestId,
    publicReference,
    safeString,
    toMinorUnits,
    validateContact
};
