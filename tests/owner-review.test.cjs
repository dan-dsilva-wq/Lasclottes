'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const packet = fs.readFileSync(path.join(root, 'OWNER_REVIEW_PACKET.md'), 'utf8');
const approvals = JSON.parse(fs.readFileSync(path.join(root, 'data', 'launch-approvals.json'), 'utf8'));
const buildScript = fs.readFileSync(path.join(root, 'scripts', 'build-cloudflare.cjs'), 'utf8');

test('the owner packet contains the verified operator and current commercial facts', () => {
    assert.match(packet, /SIREN: 521 892 992/);
    assert.match(packet, /SIRET: 521 892 992 00012/);
    assert.match(packet, /GBP 200 per night/);
    assert.match(packet, /GBP 250 per night/);
    assert.match(packet, /GBP 3,300 per week/);
    assert.match(packet, /EUR 1\.44[^\n]*three-star classification/);
    assert.match(packet, /5\.76%[^\n]*capped at EUR 3\.60/);
    assert.match(packet, /fumelvalleedulot\.taxesejour\.fr/);
    assert.match(packet, /five bedrooms, four bathrooms, maximum 12 guests/i);
});

test('the owner packet asks for every owner-controlled launch approval exactly once', () => {
    const labels = [
        'BOOKING TERMS APPROVED DATE:',
        'CANCELLATION WITHIN 60 DAYS:',
        'INITIAL 25% PAYMENT: arrhes OR acompte',
        'MAIRIE REGISTRATION NUMBER:',
        'CONSUMER MEDIATOR NAME:',
        'CONSUMER MEDIATOR ADDRESS:',
        'CONSUMER MEDIATOR WEBSITE:',
        'VAT POSITION:',
        'RCS WORDING OR NOT-APPLICABLE WORDING:',
        'TOURIST-ACCOMMODATION CLASSIFICATION:',
        'TOURIST-TAX CONFIRMATION:',
        'LEGAL/ACCOUNTING REVIEWER:',
        'LEGAL/ACCOUNTING REVIEW DATE:',
        'FINAL CONTENT APPROVAL DATE:',
        'ACTIVITIES REVIEW DATE:'
    ];
    for (const label of labels) {
        assert.equal(packet.split(label).length - 1, 1, label);
    }
    assert.equal(approvals.bookingTermsApprovedAt, null);
    assert.equal(approvals.mairieRegistrationNumber, null);
    assert.equal(approvals.consumerMediator.name, null);
    assert.equal(approvals.touristTaxPosition, null);
});

test('the owner packet uses official contact routes and is not published by the live Cloudflare build', () => {
    assert.match(packet, /mairie@saintsylvestresurlot\.com/);
    assert.match(packet, /05 53 41 24 58/);
    assert.match(packet, /lannuaire\.service-public\.gouv\.fr/);
    assert.match(packet, /service-public\.fr\/entreprendre\/actualites\/A17883/);
    assert.match(packet, /economie\.gouv\.fr\/mediation-conso/);
    assert.doesNotMatch(packet, /#Nevermind|STRIPE_SECRET|RESEND_API_KEY|BOOKING_OPERATIONS_TOKEN/);
    assert.doesNotMatch(buildScript, /OWNER_REVIEW_PACKET/);
});
