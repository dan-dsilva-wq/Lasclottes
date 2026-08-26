'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    attributes,
    findAnchor,
    localTargets,
    mapConcurrent,
    metadata,
    parseArguments,
    redirectCases,
    sitemapPaths
} = require('../scripts/audit-deployment.cjs');

const root = path.resolve(__dirname, '..');

test('deployment audit parses metadata and exact sitemap paths', () => {
    const page = metadata(`
        <html><head>
            <title>Lasclottes test page</title>
            <meta name="description" content="A useful description">
            <link rel="canonical" href="https://lasclottes.com/fr.html">
        </head></html>
    `);
    assert.equal(page.title, 'Lasclottes test page');
    assert.equal(page.meta.get('description'), 'A useful description');
    assert.equal(page.links[0].href, 'https://lasclottes.com/fr.html');
    assert.deepEqual(
        sitemapPaths('<urlset><loc>https://lasclottes.com/</loc><loc>https://lasclottes.com/fr.html</loc></urlset>'),
        ['/', '/fr.html']
    );
});

test('deployment audit finds only same-origin pages and assets', () => {
    const html = `
        <a href="#welcome">Welcome</a>
        <a href="/privacy.html">Privacy</a>
        <a href="https://outside.example/">Outside</a>
        <img src="/Media/photo.jpg" srcset="/Media/photo-400.jpg 400w, /Media/photo-800.jpg 800w" alt="">
        <script src="/js/main.js"></script>
        <link rel="canonical" href="https://lasclottes.com/">
    `;
    const result = localTargets(html, 'https://preview.example/', 'https://preview.example');
    assert.deepEqual([...result.pages].sort(), [
        'https://preview.example/',
        'https://preview.example/privacy.html'
    ]);
    assert.deepEqual([...result.assets].sort(), [
        'https://preview.example/Media/photo-400.jpg',
        'https://preview.example/Media/photo-800.jpg',
        'https://preview.example/Media/photo.jpg',
        'https://preview.example/js/main.js'
    ]);
    assert.deepEqual(result.anchors, [{ url: 'https://preview.example/', hash: 'welcome' }]);
});

test('deployment audit arguments fail closed on indexing expectations', () => {
    assert.deepEqual(
        parseArguments(['https://preview.example', '--expect-noindex']),
        { baseUrl: 'https://preview.example', expectNoindex: true }
    );
    assert.deepEqual(
        parseArguments(['https://lasclottes.com', '--expect-index']),
        { baseUrl: 'https://lasclottes.com', expectNoindex: false }
    );
    assert.throws(() => parseArguments(['https://preview.example']), /exactly one/);
    assert.throws(
        () => parseArguments(['https://preview.example', '--expect-noindex', '--expect-index']),
        /exactly one/
    );
});

test('deployment audit recognizes anchors and every configured legacy redirect', () => {
    assert.deepEqual(attributes('<a data-x="1" href="/test">'), { 'data-x': '1', href: '/test' });
    assert.equal(findAnchor('<section id="welcome"></section>', 'welcome'), true);
    assert.equal(findAnchor('<section id="welcome"></section>', 'missing'), false);
    assert.equal(redirectCases().length, 13);
    assert.ok(redirectCases().some((entry) => entry.source === '/blog/release-audit'));
});

test('deployment audit limits concurrent network work without losing items', async () => {
    let active = 0;
    let peak = 0;
    const completed = [];
    await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        completed.push(value);
        active -= 1;
    });
    assert.ok(peak <= 2);
    assert.deepEqual(completed.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
});

test('Vercel review deployments exclude internal release material', () => {
    const ignore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
    for (const privatePath of [
        'OWNER_REVIEW_PACKET.md',
        'LAUNCH_RUNBOOK.md',
        'tests/',
        'scripts/',
        'migrations/',
        'cloudflare/',
        'wrangler.jsonc',
        'data/launch-approvals.json',
        '.env*.local'
    ]) assert.match(ignore, new RegExp(`^${privatePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});
