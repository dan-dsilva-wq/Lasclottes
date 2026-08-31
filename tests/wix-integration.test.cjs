'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'wix', name), 'utf8');

test('Wix frontend never contains the booking bridge secret value', () => {
    const widget = read('booking-widget.html');
    const pageCode = read('booking-page-code.js');
    assert.doesNotMatch(widget, /Bearer\s+[A-Za-z0-9._~-]{32,}/);
    assert.doesNotMatch(pageCode, /Bearer\s+[A-Za-z0-9._~-]{32,}/);
    assert.match(pageCode, /createLasclottesCheckout/);
});

test('Wix backend uses Secrets Manager and an authenticated server-to-server request', () => {
    const bridge = read('booking-bridge.web.js');
    assert.match(bridge, /getSecret\(BRIDGE_SECRET_NAME\)/);
    assert.match(bridge, /Authorization: `Bearer \$\{bridgeToken\}`/);
    assert.match(bridge, /X-Lasclottes-Site-Base-Url/);
    assert.doesNotMatch(bridge, /sk_(?:test|live)_/);
    assert.doesNotMatch(bridge, /whsec_/);
});

test('Wix widget collects the agreement and sends only the expected checkout event', () => {
    const widget = read('booking-widget.html');
    assert.match(widget, /id="agreement"[^>]+required/);
    assert.match(widget, /agreementAccepted:true/);
    assert.match(widget, /type:'lasclottes-checkout'/);
    assert.match(widget, /event\.origin !== parentOrigin/);
    assert.doesNotMatch(widget, /postMessage\([^\n]+,\s*['"]\*['"]/);
});

test('Wix draft mode is explicit and must be switched off before final publication', () => {
    const pageCode = read('booking-page-code.js');
    const instructions = read('README.md');
    assert.match(pageCode, /const WIX_DRAFT_TEST_MODE = true;/);
    assert.match(instructions, /Before Sally publishes/);
    assert.match(instructions, /switch both test flags to `false`/);
});
