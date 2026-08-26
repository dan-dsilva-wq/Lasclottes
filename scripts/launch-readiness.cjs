'use strict';

const fs = require('node:fs');
const path = require('node:path');

const defaultRoot = path.resolve(__dirname, '..');
const pendingPattern = /^(?:pending|unknown|todo|tbc|to confirm|not decided)$/i;

const read = (root, relativePath) => {
    try {
        return fs.readFileSync(path.join(root, relativePath), 'utf8');
    } catch (_) {
        return '';
    }
};

const readJson = (root, relativePath) => {
    try {
        return JSON.parse(read(root, relativePath));
    } catch (_) {
        return {};
    }
};

const meaningful = (value, minimumLength = 2) => {
    const text = String(value || '').trim();
    return text.length >= minimumLength && !pendingPattern.test(text);
};

const isoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const recentDate = (value, now, maximumAgeDays) => {
    if (!isoDate(value)) return false;
    const age = Math.floor((now.getTime() - new Date(`${value}T00:00:00.000Z`).getTime()) / 86_400_000);
    return age >= 0 && age <= maximumAgeDays;
};

const escaped = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readinessReport = ({ root = defaultRoot, now = new Date() } = {}) => {
    const approvals = readJson(root, 'data/launch-approvals.json');
    const termsSource = read(root, 'lib/terms.js');
    const termsPage = read(root, 'booking-terms.html');
    const legalNotice = read(root, 'legal-notice.html');
    const publicPages = [
        'index.html',
        'fr.html',
        'nl.html',
        'privacy.html',
        'booking-terms.html'
    ];
    const termsVersion = /BOOKING_TERMS_VERSION\s*=\s*'([^']+)'/.exec(termsSource)?.[1] || '';
    const legalType = String(approvals.initialPaymentLegalType || '').trim().toLowerCase();
    const mediator = approvals.consumerMediator || {};
    const review = approvals.legalAccountingReview || {};
    const checks = [];
    const add = (id, category, ready, message) => checks.push({ id, category, ready: Boolean(ready), message });

    add(
        'booking_terms_approved',
        'Owner and legal decisions',
        isoDate(approvals.bookingTermsApprovedAt),
        'Sally must approve the final booking terms.'
    );
    add(
        'cancellation_policy',
        'Owner and legal decisions',
        meaningful(approvals.cancellationWithin60Days, 20),
        'Record what happens when a guest cancels within 60 days.'
    );
    add(
        'initial_payment_type',
        'Owner and legal decisions',
        ['arrhes', 'acompte'].includes(legalType),
        'Confirm whether the initial 20% payment is arrhes or acompte.'
    );
    add(
        'mairie_registration',
        'Owner and legal decisions',
        meaningful(approvals.mairieRegistrationNumber, 6),
        'Add the mairie tourist-accommodation registration number.'
    );
    add(
        'consumer_mediator',
        'Owner and legal decisions',
        meaningful(mediator.name, 3)
            && meaningful(mediator.address, 10)
            && /^https:\/\//i.test(String(mediator.website || '')),
        'Add Sally’s appointed consumer mediator name, address and HTTPS website.'
    );
    add(
        'tax_and_register_position',
        'Owner and legal decisions',
        meaningful(approvals.vatPosition, 4)
            && meaningful(approvals.rcsWording, 4)
            && meaningful(approvals.touristAccommodationClassification, 3)
            && meaningful(approvals.touristTaxPosition, 12),
        'Confirm VAT and RCS wording, approve the matching tourist-tax treatment, and retain evidence of the tourist-accommodation classification.'
    );
    add(
        'professional_review',
        'Owner and legal decisions',
        meaningful(review.reviewedBy, 3) && isoDate(review.reviewedAt),
        'Record the qualified French legal/accounting review.'
    );
    add(
        'owner_content_review',
        'Owner reviews',
        isoDate(approvals.ownerContentApprovedAt),
        'Sally must approve the final wording, prices, photographs and phone numbers.'
    );
    add(
        'activity_review',
        'Owner reviews',
        recentDate(approvals.activitiesReviewedAt, now, 14),
        'Recheck time-sensitive activities and providers within 14 days of launch.'
    );
    add(
        'availability_review',
        'Owner reviews',
        recentDate(approvals.availabilityReviewedAt, now, 14),
        'Recheck the booking diary within 14 days of launch.'
    );
    add(
        'failed_email_acceptance',
        'Acceptance tests',
        isoDate(approvals.externalEmailRetryTestCompletedAt),
        'Complete the confirmed external failed-email retry test.'
    );
    add(
        'operations_access_handover',
        'Acceptance tests',
        isoDate(approvals.productionOperationsAccessDeliveredAt),
        'Create the separate production operations key and give it to Sally securely.'
    );
    add(
        'final_terms_version',
        'Website publication',
        Boolean(termsVersion)
            && !/draft/i.test(termsVersion)
            && termsPage.includes(`data-terms-version="${termsVersion}"`),
        'Publish a non-draft booking-terms version consistently in the page and server.'
    );

    const noPlaceholders = legalNotice
        && !/(?:TODO|TBC|TO CONFIRM|PENDING OWNER)/i.test(legalNotice);
    const requiredLegalValues = [
        approvals.mairieRegistrationNumber,
        mediator.name,
        mediator.website
    ].filter((value) => meaningful(value, 3));
    const legalValuesPresent = requiredLegalValues.length === 3
        && requiredLegalValues.every((value) => new RegExp(escaped(value), 'i').test(legalNotice));
    add(
        'legal_notice_published',
        'Website publication',
        noPlaceholders
            && legalValuesPresent
            && publicPages.every((file) => /href=["'][^"']*legal-notice\.html["']/i.test(read(root, file))),
        'Publish the complete legal notice and link it from every principal public/legal page.'
    );

    const termsValuesPresent = meaningful(approvals.cancellationWithin60Days, 20)
        && new RegExp(escaped(approvals.cancellationWithin60Days), 'i').test(termsPage)
        && ['arrhes', 'acompte'].includes(legalType)
        && new RegExp(`\\b${legalType}\\b`, 'i').test(termsPage)
        && meaningful(approvals.mairieRegistrationNumber, 6)
        && new RegExp(escaped(approvals.mairieRegistrationNumber), 'i').test(termsPage)
        && meaningful(mediator.name, 3)
        && new RegExp(escaped(mediator.name), 'i').test(termsPage);
    add(
        'approved_values_published',
        'Website publication',
        termsValuesPresent,
        'Publish the approved cancellation, payment type, registration and mediator details in the booking terms.'
    );

    const pending = checks.filter((check) => !check.ready);
    return {
        ready: pending.length === 0,
        checkedAt: now.toISOString(),
        summary: {
            total: checks.length,
            passed: checks.length - pending.length,
            pending: pending.length
        },
        checks
    };
};

const formatReport = (report) => {
    const lines = [
        report.ready
            ? 'Lasclottes pre-launch readiness: GREEN'
            : `Lasclottes pre-launch readiness: ${report.summary.pending} gate${report.summary.pending === 1 ? '' : 's'} remaining`,
        `${report.summary.passed} of ${report.summary.total} pre-launch gates pass.`
    ];
    const categories = [...new Set(report.checks.filter((check) => !check.ready).map((check) => check.category))];
    for (const category of categories) {
        lines.push('', category);
        for (const check of report.checks.filter((item) => item.category === category && !item.ready)) {
            lines.push(`- ${check.message}`);
        }
    }
    return lines.join('\n');
};

if (require.main === module) {
    const report = readinessReport();
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    else console.log(formatReport(report));
    process.exitCode = report.ready ? 0 : 1;
}

module.exports = {
    formatReport,
    meaningful,
    readinessReport,
    recentDate
};
