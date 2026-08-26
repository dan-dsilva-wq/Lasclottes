'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
    formatReport,
    readinessReport
} = require('../scripts/launch-readiness.cjs');

const projectRoot = path.resolve(__dirname, '..');

const write = (root, relativePath, contents) => {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
};

test('the current readiness command fails closed and names owner-controlled blockers', () => {
    const report = readinessReport({
        root: projectRoot,
        now: new Date('2026-08-26T12:00:00.000Z')
    });
    const checks = new Map(report.checks.map((check) => [check.id, check]));

    assert.equal(report.ready, false);
    assert.equal(checks.get('availability_review').ready, true);
    assert.equal(checks.get('cancellation_policy').ready, false);
    assert.equal(checks.get('mairie_registration').ready, false);
    assert.equal(checks.get('consumer_mediator').ready, false);
    assert.equal(checks.get('final_terms_version').ready, false);
    assert.match(formatReport(report), /Sally must approve the final booking terms/);
    assert.doesNotMatch(formatReport(report), /BOOKING_OPERATIONS_TOKEN|STRIPE_SECRET/i);
});

test('the readiness gate can turn fully green only when decisions and published pages agree', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lasclottes-readiness-'));
    t.after(() => fs.rmSync(root, { force: true, recursive: true }));
    const cancellation = 'Within 60 days, the full accommodation price remains payable unless the owner rebooks the cancelled dates.';
    const mediatorName = 'Example Consumer Mediation Service';
    const mediatorWebsite = 'https://mediator.example.test';
    const registration = 'REG-47140-123456';
    const approvals = {
        schemaVersion: 1,
        bookingTermsApprovedAt: '2026-08-26',
        cancellationWithin60Days: cancellation,
        initialPaymentLegalType: 'arrhes',
        mairieRegistrationNumber: registration,
        consumerMediator: {
            name: mediatorName,
            address: '1 Example Street, 47000 Agen, France',
            website: mediatorWebsite
        },
        vatPosition: 'Not subject to VAT after professional review',
        rcsWording: 'RCS wording not applicable after professional review',
        touristAccommodationClassification: 'Unclassified furnished tourist accommodation',
        touristTaxPosition: 'Official unclassified-accommodation proportional tariff confirmed by the adviser',
        legalAccountingReview: {
            reviewedBy: 'Qualified French adviser',
            reviewedAt: '2026-08-26'
        },
        ownerContentApprovedAt: '2026-08-26',
        activitiesReviewedAt: '2026-08-26',
        availabilityReviewedAt: '2026-08-26',
        externalEmailRetryTestCompletedAt: '2026-08-26',
        productionOperationsAccessDeliveredAt: '2026-08-26'
    };
    write(root, 'data/launch-approvals.json', JSON.stringify(approvals));
    write(root, 'lib/terms.js', "const BOOKING_TERMS_VERSION = '2026-08-26-final-1';");
    write(root, 'booking-terms.html', `<article data-terms-version="2026-08-26-final-1">${cancellation} The initial payment is arrhes. ${registration} ${mediatorName}<a href="legal-notice.html">Legal notice</a></article>`);
    write(root, 'legal-notice.html', `${registration} ${mediatorName} ${mediatorWebsite}`);
    for (const page of ['index.html', 'fr.html', 'nl.html', 'privacy.html']) {
        write(root, page, '<a href="legal-notice.html">Legal notice</a>');
    }

    const report = readinessReport({ root, now: new Date('2026-08-26T12:00:00.000Z') });
    assert.equal(report.ready, true, formatReport(report));
    assert.deepEqual(report.summary, { total: 15, passed: 15, pending: 0 });
    assert.match(formatReport(report), /GREEN/);
});
