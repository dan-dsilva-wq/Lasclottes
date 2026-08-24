const STRIPE_CHECKOUT_URL = 'https://api.stripe.com/v1/checkout/sessions';
const DAY_MS = 24 * 60 * 60 * 1000;
const AVAILABILITY = require('../data/availability.json');

const BOOKING_RULES = Object.freeze({
    maxGuests: 12,
    maxStayNights: 366,
    highSeasonWeeklyRate: 3300,
    midSeasonNightlyRate: 250,
    midSeasonReducedNightlyRate: 200,
    touristTaxEurPerAdultNight: 1.41,
    refundableDamageDeposit: 500,
    depositRate: 0.25,
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

const blockedDateRange = (arrival, departure) => {
    const blocked = Array.isArray(AVAILABILITY.blocked) ? AVAILABILITY.blocked : [];
    return blocked.find((range) => {
        const blockStart = parseDate(range.start, 'availability_start');
        const blockEnd = parseDate(range.end, 'availability_end');
        return arrival < blockEnd && departure > blockStart;
    });
};

const calculateQuote = (input, now = new Date()) => {
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

    if (blockedDateRange(arrival, departure)) {
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

    if ([...months].some((month) => [9, 10, 11, 0, 1, 2, 3].includes(month))) {
        throw new BookingValidationError(
            'October to April is currently closed.',
            'closed_season'
        );
    }

    const isHighSeason = [...months].some((month) => [6, 7].includes(month));
    let stayTotal;
    let season;

    if (isHighSeason) {
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
        const nightlyRate = guests <= 6
            ? BOOKING_RULES.midSeasonReducedNightlyRate
            : BOOKING_RULES.midSeasonNightlyRate;
        stayTotal = nightlyRate * nights;
    }

    const touristTaxEur = roundMoney(adults * nights * BOOKING_RULES.touristTaxEurPerAdultNight);
    const damageDeposit = BOOKING_RULES.refundableDamageDeposit;
    const daysUntilArrival = Math.ceil((arrival - currentDay) / DAY_MS);
    const fullPaymentDueNow = daysUntilArrival <= BOOKING_RULES.fullPaymentWindowDays;
    const amountDueNow = roundMoney(fullPaymentDueNow
        ? stayTotal + damageDeposit
        : stayTotal * BOOKING_RULES.depositRate);
    const balanceDueLater = roundMoney(fullPaymentDueNow
        ? 0
        : (stayTotal - amountDueNow) + damageDeposit);

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
        damageDeposit,
        amountDueNow,
        balanceDueLater,
        paymentStage: fullPaymentDueNow ? 'full_payment_now' : 'deposit_now_balance_later'
    };
};

const trustedOrigin = () => {
    const configured = safeString(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '', 200);
    const vercelHost = safeString(
        process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '',
        200
    );
    const candidate = configured || (vercelHost ? `https://${vercelHost}` : '');
    if (!candidate) throw new Error('A trusted public site URL is not configured.');

    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('The configured public site URL is invalid.');
    }
    return parsed.origin;
};

const parseBody = (req) => {
    if (!req.body) return {};
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (_) {
            return {};
        }
    }
    return {};
};

const handler = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed.' });
    }

    if (process.env.BOOKING_PAYMENTS_ENABLED !== 'true') {
        return res.status(503).json({
            error: 'Online booking payments are being prepared. Please contact us to reserve.',
            code: 'payments_disabled'
        });
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
        return res.status(503).json({ error: 'Secure card checkout is not configured yet.' });
    }

    const body = parseBody(req);
    const firstName = safeString(body.firstName, 80);
    const lastName = safeString(body.lastName, 80);
    const fullName = safeString(`${firstName} ${lastName}`.trim(), 120);
    const email = safeString(body.email, 150);
    const phone = safeString(body.phone, 60);
    const requestedLang = safeString(body.lang, 2).toLowerCase();
    const lang = ['en', 'fr', 'nl'].includes(requestedLang) ? requestedLang : 'en';

    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || !phone) {
        return res.status(400).json({ error: 'Please provide valid contact details.' });
    }
    if (body.agreementAccepted !== true) {
        return res.status(400).json({ error: 'Please accept the equipment and safety agreement.' });
    }

    let quote;
    try {
        quote = calculateQuote(body);
    } catch (error) {
        if (error instanceof BookingValidationError) {
            return res.status(400).json({ error: error.message, code: error.code });
        }
        return res.status(400).json({ error: 'Invalid booking details.' });
    }

    let origin;
    try {
        origin = trustedOrigin();
    } catch (_) {
        return res.status(503).json({ error: 'Secure card checkout is not configured yet.' });
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL
        || `${origin}/payment-success.html?lang=${encodeURIComponent(lang)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL
        || `${origin}/payment-cancelled.html?lang=${encodeURIComponent(lang)}`;

    const paymentTitle = quote.paymentStage === 'full_payment_now'
        ? 'Lasclottes booking payment (full amount due now)'
        : 'Lasclottes booking payment (deposit due now)';

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', successUrl);
    params.set('cancel_url', cancelUrl);
    params.append('payment_method_types[]', 'card');
    params.set('billing_address_collection', 'auto');
    params.set('phone_number_collection[enabled]', 'true');
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'gbp');
    params.set('line_items[0][price_data][unit_amount]', String(toMinorUnits(quote.amountDueNow)));
    params.set('line_items[0][price_data][product_data][name]', paymentTitle);
    params.set(
        'line_items[0][price_data][product_data][description]',
        `${quote.arrivalDate} to ${quote.departureDate} · ${quote.guests} guests · ${quote.nights} nights`
    );
    params.set('customer_email', email);

    const metadata = {
        booking_name: fullName,
        booking_email: email,
        booking_phone: phone,
        arrival_date: quote.arrivalDate,
        departure_date: quote.departureDate,
        nights: String(quote.nights),
        guests: String(quote.guests),
        adults: String(quote.adults),
        children: String(quote.children),
        stay_total_gbp: quote.stayTotal.toFixed(2),
        tourist_tax_eur: quote.touristTaxEur.toFixed(2),
        damage_deposit_gbp: quote.damageDeposit.toFixed(2),
        amount_due_now_gbp: quote.amountDueNow.toFixed(2),
        balance_due_later_gbp: quote.balanceDueLater.toFixed(2),
        payment_stage: quote.paymentStage,
        safety_agreement: 'accepted',
        language: lang
    };

    Object.entries(metadata).forEach(([key, value]) => {
        params.set(`metadata[${key}]`, value);
        params.set(`payment_intent_data[metadata][${key}]`, value);
    });

    try {
        const stripeResponse = await fetch(STRIPE_CHECKOUT_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${stripeSecretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        const stripeData = await stripeResponse.json();
        if (!stripeResponse.ok || !stripeData?.url) {
            console.error('Stripe checkout session creation failed.', stripeData?.error?.type || stripeResponse.status);
            return res.status(502).json({ error: 'Unable to start secure card checkout. Please try again.' });
        }

        return res.status(200).json({
            id: stripeData.id,
            url: stripeData.url,
            quote
        });
    } catch (error) {
        console.error('Stripe checkout request failed.', error?.name || 'Error');
        return res.status(502).json({ error: 'Unable to start secure card checkout. Please try again.' });
    }
};

handler.calculateQuote = calculateQuote;
handler.BOOKING_RULES = BOOKING_RULES;
handler.BookingValidationError = BookingValidationError;

module.exports = handler;
