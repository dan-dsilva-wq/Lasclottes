'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    balanceDueDate,
    buildGuestEmail,
    buildOwnerEmail,
    dateOnly,
    validDomain
} = require('../lib/email');

const booking = {
    id: '00000000-0000-4000-8000-000000000001',
    public_reference: 'LC-EMAIL001',
    first_name: 'Test',
    last_name: 'Guest',
    email: 'guest@example.test',
    phone: '+44 7000 000 000',
    guest_message: 'Please prepare a cot & keep <script> out.',
    language: 'en',
    arrival: new Date('2027-07-17T00:00:00.000Z'),
    departure: '2027-07-24',
    adults: 8,
    children: 2,
    guests: 10,
    amount_due_now_pence: 82500,
    balance_due_later_pence: 297500,
    damage_deposit_pence: 50000,
    tourist_tax_eur_cents: 7896,
    payment_stage: 'deposit_now_balance_later'
};

test('confirmation email shows exact amounts and the 60-day balance deadline', () => {
    const content = buildGuestEmail(booking);
    assert.equal(balanceDueDate(booking), '2027-05-18');
    assert.match(content.text, /2027-07-17 – 2027-07-24/);
    assert.match(content.text, /£825\.00/);
    assert.match(content.text, /£2,975\.00/);
    assert.match(content.text, /€78\.96/);
    assert.match(content.text, /2027-05-18/);
    assert.match(content.html, /guest@example\.test/);
    assert.match(content.text, /Please prepare a cot & keep <script> out\./);
    assert.match(content.html, /Please prepare a cot &amp; keep &lt;script&gt; out\./);
    assert.doesNotMatch(content.html, /<script> out/);
});

test('owner notification contains booking and contact details', () => {
    const content = buildOwnerEmail(booking);
    assert.match(content.subject, /LC-EMAIL001/);
    assert.match(content.text, /Test Guest/);
    assert.match(content.text, /guest@example\.test/);
    assert.match(content.text, /deposit_now_balance_later/);
    assert.match(content.text, /Please prepare a cot & keep <script> out\./);
});

test('email helpers normalize dates and reject unsafe sender domains', () => {
    assert.equal(dateOnly(new Date('2027-07-17T12:00:00Z')), '2027-07-17');
    assert.equal(dateOnly('2027-07-24'), '2027-07-24');
    assert.equal(validDomain('Lasclottes.com'), 'lasclottes.com');
    assert.equal(validDomain('bad domain.example'), '');
    assert.equal(validDomain('example.com\r\nBcc:attacker@example.com'), '');
});
