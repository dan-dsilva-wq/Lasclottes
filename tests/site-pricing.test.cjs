'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { BOOKING_RULES } = require('../lib/booking');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const pricingSection = (relativePath) => {
    const html = read(relativePath);
    return html.match(/<section\b[^>]*\bid=["']pricing["'][\s\S]*?<\/section>/i)?.[0] || '';
};

test('all localized price tables agree with the server currency and rates', () => {
    const pages = {
        'index.html': {
            weekly: `&pound;${BOOKING_RULES.highSeasonWeeklyRate.toLocaleString('en-GB')} per week`,
            standard: `&pound;${BOOKING_RULES.midSeasonNightlyRate}/night`,
            reduced: `&pound;${BOOKING_RULES.midSeasonReducedNightlyRate}/night`
        },
        'fr.html': {
            weekly: `&pound;${BOOKING_RULES.highSeasonWeeklyRate.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/g, ' ')} par semaine`,
            standard: `&pound;${BOOKING_RULES.midSeasonNightlyRate}/nuit`,
            reduced: `&pound;${BOOKING_RULES.midSeasonReducedNightlyRate}/nuit`
        },
        'nl.html': {
            weekly: `£ ${BOOKING_RULES.highSeasonWeeklyRate.toLocaleString('nl-NL')} per week`,
            standard: `£ ${BOOKING_RULES.midSeasonNightlyRate}/nacht`,
            reduced: `£ ${BOOKING_RULES.midSeasonReducedNightlyRate}/nacht`
        }
    };

    for (const [pagePath, expected] of Object.entries(pages)) {
        const pricing = pricingSection(pagePath);
        assert.ok(pricing, `${pagePath} has a pricing section`);
        assert.ok(pricing.includes(expected.weekly), `${pagePath} shows the server high-season weekly rate`);
        assert.ok(pricing.includes(expected.standard), `${pagePath} shows the server standard nightly rate`);
        assert.ok(pricing.includes(expected.reduced), `${pagePath} shows the server reduced nightly rate`);
        assert.doesNotMatch(pricing, /price-was|text-decoration\s*:\s*line-through/i, `${pagePath} does not expose obsolete prices`);
        assert.doesNotMatch(pricing, /€\s*3[,. ]?300|3[,. ]?300\s*€/i, `${pagePath} does not label GBP rates as euros`);
    }
});

test('browser-side quote constants mirror the authoritative server rules', () => {
    const script = read('js/main_old.js');

    assert.match(script, new RegExp(`const touristTaxStatus = '${BOOKING_RULES.touristTaxStatus}'`));
    assert.match(script, new RegExp(`const refundableDamageDeposit = ${BOOKING_RULES.refundableDamageDeposit}`));
    assert.match(script, new RegExp(`const depositRate = ${BOOKING_RULES.depositRate}`));
    assert.match(script, new RegExp(`const fullPaymentWindowDays = ${BOOKING_RULES.fullPaymentWindowDays}`));
    assert.match(script, new RegExp(`const maxGuests = ${BOOKING_RULES.maxGuests}`));
    assert.match(script, new RegExp(`rate: ${BOOKING_RULES.highSeasonWeeklyRate} / 7`));
    assert.match(script, new RegExp(`rate: ${BOOKING_RULES.midSeasonNightlyRate}`));
    assert.match(script, new RegExp(`reducedRate: ${BOOKING_RULES.midSeasonReducedNightlyRate}`));
    assert.match(script, /stayTotal \* depositRate/);
});

test('unverified tourist tax is never presented as a fixed quote', () => {
    for (const pagePath of ['index.html', 'fr.html', 'nl.html', 'booking-terms.html']) {
        const page = read(pagePath);
        assert.doesNotMatch(page, /(?:€|&euro;|EUR)\s*1[,.]41/i, `${pagePath}: obsolete flat tourist tax`);
    }
    assert.match(read('index.html'), /Tourist tax[^.]*separate[^.]*classification/i);
    assert.match(read('fr.html'), /taxe de séjour[^.]*séparée[^.]*classement/i);
    assert.match(read('nl.html'), /toeristenbelasting[^.]*classificatie/i);
});

test('owner-confirmed initial payment is consistently twenty percent', () => {
    for (const pagePath of ['index.html', 'fr.html', 'nl.html', 'booking-terms.html']) {
        const page = read(pagePath);
        assert.match(page, /20\s*%/, `${pagePath}: missing 20% initial payment`);
        assert.doesNotMatch(page, /25\s*%/, `${pagePath}: obsolete 25% initial payment`);
    }
    assert.equal(BOOKING_RULES.depositRate, 0.20);
});
