'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pagePaths = [
    '404.html',
    'booking-terms.html',
    'fr.html',
    'index.html',
    'nl.html',
    'payment-cancelled.html',
    'payment-success.html',
    'privacy.html',
    ...fs.readdirSync(path.join(root, 'activities'))
        .filter((file) => file.endsWith('.html'))
        .map((file) => path.join('activities', file))
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('public pages do not automatically load third-party fonts or photographs', () => {
    for (const pagePath of pagePaths) {
        const html = read(pagePath);
        assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i, pagePath);
        assert.doesNotMatch(html, /<img\b[^>]*\bsrc=["']https?:\/\//i, pagePath);
    }
});

test('location maps require an explicit visitor choice in every language', () => {
    for (const pagePath of ['index.html', 'fr.html', 'nl.html']) {
        const html = read(pagePath);
        assert.match(html, /class=["'][^"']*map-consent[^"']*["']/i, pagePath);
        assert.match(html, /class=["'][^"']*map-consent__load[^"']*["']/i, pagePath);
        assert.doesNotMatch(html, /<iframe\b[^>]*\b(?:src|data-src)=/i, pagePath);
    }

    const script = read('js/main_old.js');
    assert.match(script, /map-consent\[data-map-src\]/);
    assert.match(script, /loadButton\.addEventListener\('click'/);
});

test('fonts and the content security policy are fully self-hosted', () => {
    const stylesheet = read('css/style_old.css');
    const headers = read(path.join('cloudflare', '_headers'));

    for (const font of [
        'dm-sans-latin-variable.woff2',
        'dm-sans-latin-italic-variable.woff2',
        'playfair-display-latin-variable.woff2'
    ]) {
        assert.match(stylesheet, new RegExp(font.replace('.', '\\.')));
        assert.ok(fs.statSync(path.join(root, 'Media', 'fonts', font)).size > 0, font);
    }

    assert.match(headers, /font-src 'self'/);
    assert.match(headers, /img-src 'self' data:/);
    assert.doesNotMatch(headers, /fonts\.(?:googleapis|gstatic)\.com|z-animoland|destination-agen/i);
});

test('legal pages identify the verified accommodation operator', () => {
    for (const pagePath of ['privacy.html', 'booking-terms.html']) {
        const html = read(pagePath);
        assert.match(html, /Sally Spencer/);
        assert.match(html, /SIREN 521 892 992/);
        assert.match(html, /Lieu-dit Las Clottes, 47140 Saint-Sylvestre-sur-Lot, France/);
    }
});

test('booking terms and database preserve the agreement accepted at checkout', () => {
    const termsPage = read('booking-terms.html');
    const databaseSource = read(path.join('lib', 'database.js'));
    const checkoutSource = read(path.join('api', 'create-stripe-checkout.js'));

    assert.match(termsPage, /data-terms-version="2026-08-25-draft-1"/);
    assert.match(termsPage, /five bedrooms, four bathrooms and a maximum occupancy of 12 people/i);
    assert.match(termsPage, /Farmhouse[^.]*not included in a current booking/i);
    assert.match(databaseSource, /agreement_version text/);
    assert.match(databaseSource, /agreement_accepted_at timestamptz/);
    assert.match(databaseSource, /agreement_snapshot jsonb/);
    assert.match(checkoutSource, /bookingAgreementSnapshot/);
    assert.ok(fs.existsSync(path.join(root, 'migrations', '003_booking_agreement.sql')));
});

test('booking details never fall back to an unnecessary third-party form service', () => {
    for (const pagePath of ['index.html', 'fr.html', 'nl.html']) {
        const html = read(pagePath);
        const form = html.match(/<form\b[^>]*\bid=["']bookingForm["'][\s\S]*?<\/form>/i)?.[0] || '';
        assert.match(form, /\baction=["']\/api\/create-stripe-checkout["']/i, pagePath);
        assert.match(form, /<textarea\b[^>]*\bid=["']message["'][^>]*\bmaxlength=["']1500["']/i, pagePath);
        assert.match(form, /<button\b[^>]*\btype=["']submit["'][^>]*\bdisabled\b|<button\b[^>]*\bdisabled\b[^>]*\btype=["']submit["']/i, pagePath);
        assert.doesNotMatch(form, /formsubmit\.co|name=["']_(?:subject|captcha|template|next)["']/i, pagePath);
    }

    const mainScript = read(path.join('js', 'main_old.js'));
    assert.match(mainScript, /message:\s*document\.getElementById\('message'\)/);
    assert.match(mainScript, /payload\.message/);
    assert.match(mainScript, /submitButton\.disabled\s*=\s*false/);
});

test('guest special requests are validated, persisted, and included in both booking emails', () => {
    const bookingSource = read(path.join('lib', 'booking.js'));
    const databaseSource = read(path.join('lib', 'database.js'));
    const emailSource = read(path.join('lib', 'email.js'));

    assert.match(bookingSource, /safeString\(input\.message,\s*1500\)/);
    assert.match(databaseSource, /guest_message text NOT NULL DEFAULT ''/);
    assert.match(databaseSource, /contact\.message/);
    assert.match(emailSource, /booking\.guest_message/);
    assert.ok(fs.existsSync(path.join(root, 'migrations', '002_guest_message.sql')));
});

test('executable scripts are external and the CSP does not allow inline JavaScript', () => {
    for (const pagePath of pagePaths) {
        const html = read(pagePath);
        for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
            const attributes = match[1];
            assert.ok(
                /\bsrc=["'][^"']+["']/i.test(attributes)
                    || /\btype=["']application\/ld\+json["']/i.test(attributes),
                `${pagePath}: inline executable script`
            );
            if (/\bsrc=["'][^"']+["']/i.test(attributes)) {
                assert.match(attributes, /\bdefer\b/i, `${pagePath}: external script must be deferred`);
            }
        }
    }

    const cloudflareHeaders = read(path.join('cloudflare', '_headers'));
    const vercelConfig = read('vercel.json');
    for (const configText of [cloudflareHeaders, vercelConfig]) {
        assert.match(configText, /script-src 'self'[;"\\]/);
        assert.match(configText, /connect-src 'self'[;"\\]/);
        assert.match(configText, /form-action 'self'[;"\\]/);
        assert.doesNotMatch(configText, /script-src[^;"\\]*'unsafe-inline'|formsubmit\.co/i);
    }

    assert.match(read('payment-success.html'), /src=["']js\/payment-status\.js\?v=20260824f["']/);
    assert.match(read(path.join('scripts', 'build-cloudflare.cjs')), /'payment-status\.js'/);
    assert.doesNotMatch(read('privacy.html'), /FormSubmit/i);
});

test('Cloudflare staging stays out of search and repeat visits use efficient browser caches', () => {
    const headers = read(path.join('cloudflare', '_headers'));
    assert.match(
        headers,
        /https:\/\/lasclottes\.super-bread-8b96\.workers\.dev\/\*[\s\S]*?X-Robots-Tag:\s*noindex/i
    );
    for (const assetPath of ['/css/*', '/js/*', '/Media/*']) {
        const escaped = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(headers, new RegExp(`${escaped}[\\s\\S]*?max-age=(?:2592000|31536000)`, 'i'));
    }
});
