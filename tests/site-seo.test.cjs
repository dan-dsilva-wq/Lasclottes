'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const origin = 'https://lasclottes.com';
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const attributes = (tag) => {
    const result = {};
    const pattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
    for (const match of tag.matchAll(pattern)) result[match[1].toLowerCase()] = match[3];
    return result;
};

const pageMetadata = (html) => {
    const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '';
    const meta = new Map();
    for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
        const attrs = attributes(tag);
        const key = attrs.name || attrs.property;
        if (key) meta.set(key.toLowerCase(), attrs.content || '');
    }

    const links = (head.match(/<link\b[^>]*>/gi) || []).map(attributes);
    const title = head.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() || '';
    return { head, links, meta, title };
};

const pagePathFromUrl = (url) => {
    const pathname = new URL(url).pathname;
    return pathname === '/' ? 'index.html' : pathname.slice(1);
};

const jpegDimensions = (filePath) => {
    const data = fs.readFileSync(filePath);
    assert.equal(data.readUInt16BE(0), 0xffd8, `${filePath} is not a JPEG`);
    let offset = 2;
    while (offset + 9 < data.length) {
        if (data[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        while (data[offset] === 0xff) offset += 1;
        const marker = data[offset];
        offset += 1;
        if (marker === 0xd8 || marker === 0xd9) continue;
        if (marker === 0xda) break;
        const length = data.readUInt16BE(offset);
        const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]
            .includes(marker);
        if (isStartOfFrame) {
            return {
                height: data.readUInt16BE(offset + 3),
                width: data.readUInt16BE(offset + 5)
            };
        }
        offset += length;
    }
    throw new Error(`Could not read JPEG dimensions for ${filePath}`);
};

const sitemap = read('sitemap.xml');
const sitemapUrls = Array.from(sitemap.matchAll(/<loc>(https:\/\/lasclottes\.com[^<]*)<\/loc>/g), (match) => match[1]);

test('the sitemap contains every intended indexable page once', () => {
    const expectedPaths = [
        '/',
        '/fr.html',
        '/nl.html',
        ...fs.readdirSync(path.join(root, 'activities'))
            .filter((file) => file.endsWith('.html'))
            .sort()
            .map((file) => `/activities/${file}`),
        '/booking-terms.html',
        '/privacy.html'
    ];
    const actualPaths = sitemapUrls.map((url) => new URL(url).pathname);
    assert.equal(new Set(actualPaths).size, actualPaths.length, 'duplicate sitemap URL');
    assert.deepEqual([...actualPaths].sort(), [...expectedPaths].sort());
});

test('every indexable page has complete canonical and social metadata', () => {
    for (const url of sitemapUrls) {
        const relativePath = pagePathFromUrl(url);
        const html = read(relativePath);
        const { links, meta, title } = pageMetadata(html);
        const canonical = links.find((link) => link.rel === 'canonical')?.href;

        assert.ok(title.length >= 10 && title.length <= 75, `${relativePath}: title length ${title.length}`);
        assert.ok((meta.get('description') || '').length >= 50, `${relativePath}: short description`);
        assert.equal(meta.get('robots'), 'index, follow', `${relativePath}: robots`);
        assert.equal(canonical, url, `${relativePath}: canonical`);
        assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${relativePath}: h1 count`);

        for (const key of [
            'og:type', 'og:site_name', 'og:locale', 'og:title', 'og:description', 'og:url',
            'og:image', 'og:image:type', 'og:image:width', 'og:image:height', 'og:image:alt',
            'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt'
        ]) assert.ok(meta.get(key), `${relativePath}: missing ${key}`);

        assert.equal(meta.get('og:url'), url, `${relativePath}: og:url`);
        assert.equal(meta.get('twitter:image'), meta.get('og:image'), `${relativePath}: image mismatch`);
        assert.equal(meta.get('og:image:type'), 'image/jpeg', `${relativePath}: image type`);
        assert.equal(meta.get('og:image:width'), '1200', `${relativePath}: image width metadata`);
        assert.equal(meta.get('og:image:height'), '630', `${relativePath}: image height metadata`);
        assert.ok(meta.get('og:image').startsWith(`${origin}/Media/social/`), `${relativePath}: image host`);

        const socialPath = decodeURIComponent(new URL(meta.get('og:image')).pathname).slice(1);
        const localSocialPath = path.join(root, socialPath);
        assert.ok(fs.statSync(localSocialPath).size > 10_000, `${relativePath}: social image is too small`);
        assert.deepEqual(jpegDimensions(localSocialPath), { width: 1200, height: 630 }, `${relativePath}: social dimensions`);

        for (const jsonText of Array.from(html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi), (match) => match[1])) {
            assert.doesNotThrow(() => JSON.parse(jsonText), `${relativePath}: invalid JSON-LD`);
        }
    }
});

test('localized home pages describe the current accommodation with honest lodging structured data', () => {
    for (const relativePath of ['index.html', 'fr.html', 'nl.html']) {
        const html = read(relativePath);
        const jsonBlocks = Array.from(
            html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi),
            (match) => JSON.parse(match[1])
        );
        const lodging = jsonBlocks.find((value) => value['@type'] === 'LodgingBusiness');

        assert.ok(lodging, `${relativePath}: LodgingBusiness JSON-LD`);
        assert.equal(lodging['@id'], `${origin}/#lodging`, `${relativePath}: stable lodging ID`);
        assert.equal(lodging.identifier?.propertyID, 'SIREN', `${relativePath}: business identifier type`);
        assert.equal(lodging.identifier?.value, '521892992', `${relativePath}: business identifier`);
        assert.equal(lodging.containsPlace?.['@type'], 'Accommodation', `${relativePath}: accommodation entity`);
        assert.equal(lodging.containsPlace?.numberOfBedrooms, 5, `${relativePath}: bedrooms`);
        assert.equal(lodging.containsPlace?.numberOfBathroomsTotal, 4, `${relativePath}: bathrooms`);
        assert.equal(lodging.containsPlace?.occupancy?.value, 12, `${relativePath}: occupancy`);
        assert.match(lodging.containsPlace?.name || '', /Granary|Grange|graanschuur/i, `${relativePath}: current property name`);
        assert.ok(String(lodging.sameAs || '').startsWith('https://www.gites.com/'), `${relativePath}: verified listing`);
        assert.ok(!jsonBlocks.some((value) => value['@type'] === 'VacationRental'), `${relativePath}: incomplete gated rich-result markup`);
    }
});

test('every local responsive image candidate used by an indexable page exists', () => {
    for (const url of sitemapUrls) {
        const relativePath = pagePathFromUrl(url);
        const html = read(relativePath);
        const imageTags = html.match(/<(?:img|source)\b[^>]*>/gi) || [];

        for (const tag of imageTags) {
            const attrs = attributes(tag);
            const candidates = [
                ...(attrs.src ? [attrs.src] : []),
                ...(attrs.srcset || '').split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean)
            ];

            for (const candidate of candidates) {
                if (/^(?:data:|https?:|\/\/)/i.test(candidate)) continue;
                const resolvedUrl = new URL(candidate, `https://local.invalid/${relativePath}`);
                const localPath = path.join(root, decodeURIComponent(resolvedUrl.pathname).slice(1));
                assert.ok(fs.existsSync(localPath), `${relativePath}: missing responsive image ${candidate}`);
                assert.ok(fs.statSync(localPath).size > 0, `${relativePath}: empty responsive image ${candidate}`);
            }
        }
    }
});

test('language alternates are reciprocal and noindex pages stay out of the sitemap', () => {
    const expectedAlternates = {
        en: `${origin}/`,
        fr: `${origin}/fr.html`,
        nl: `${origin}/nl.html`,
        'x-default': `${origin}/`
    };

    for (const relativePath of ['index.html', 'fr.html', 'nl.html']) {
        const { links } = pageMetadata(read(relativePath));
        const alternates = Object.fromEntries(
            links.filter((link) => link.rel === 'alternate').map((link) => [link.hreflang, link.href])
        );
        assert.deepEqual(alternates, expectedAlternates, `${relativePath}: hreflang`);
    }

    for (const relativePath of ['404.html', 'payment-cancelled.html', 'payment-success.html']) {
        const { meta } = pageMetadata(read(relativePath));
        assert.equal(meta.get('robots'), 'noindex, nofollow', `${relativePath}: robots`);
        assert.ok(!sitemap.includes(`/${relativePath}`), `${relativePath}: sitemap`);
    }
});

test('activity guides warn that time-sensitive details must be rechecked', () => {
    for (const file of fs.readdirSync(path.join(root, 'activities')).filter((name) => name.endsWith('.html'))) {
        const html = read(path.join('activities', file));
        assert.match(html, /class=["'][^"']*activity-current-info[^"']*["'][^>]*role=["']note["']/i, file);
        assert.match(html, /Opening times, availability and prices can change\./, file);
    }

    const children = read(path.join('activities', 'children.html'));
    assert.doesNotMatch(children, /destination-agen\.com\/(?:en\/)?fiche\/entertainment-and-leisure/i);
    assert.doesNotMatch(children, /parcdugriffon\.fr\/fr\.html|Aqualand Agen/i);
    for (const currentUrl of [
        'https://k47.fr/',
        'https://destination-agen.com/youpi-parc-agen-bon-encontre/',
        'https://www.pays-bergerac-tourisme.com/fr/diffusio/caubon-saint-sauveur/parc-du-griffon_TFOLOIAQU047V505RZQ',
        'https://www.walygatorparc.com/sudouest/decouvrez-le-parc/'
    ]) assert.match(children, new RegExp(currentUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
