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
