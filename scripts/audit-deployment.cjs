'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LIVE_ORIGIN = 'https://lasclottes.com';
const ROOT = path.resolve(__dirname, '..');
const REQUIRED_SECURITY_HEADERS = [
    'content-security-policy',
    'referrer-policy',
    'x-content-type-options',
    'x-frame-options',
    'permissions-policy',
    'strict-transport-security'
];
const REQUIRED_SOCIAL_META = [
    'og:type',
    'og:site_name',
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:alt',
    'twitter:card',
    'twitter:title',
    'twitter:description',
    'twitter:image',
    'twitter:image:alt'
];

const attributes = (tag) => {
    const result = {};
    const pattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
    for (const match of tag.matchAll(pattern)) result[match[1].toLowerCase()] = match[3];
    return result;
};

const metadata = (html) => {
    const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
    const meta = new Map();
    for (const tag of head.match(/<meta\b[^>]*>/gi) || []) {
        const attrs = attributes(tag);
        const key = attrs.name || attrs.property;
        if (key) meta.set(key.toLowerCase(), attrs.content || '');
    }
    const links = (head.match(/<link\b[^>]*>/gi) || []).map(attributes);
    return {
        title: head.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim() || '',
        meta,
        links
    };
};

const sitemapPaths = (xml) => Array.from(
    xml.matchAll(/<loc>(https:\/\/lasclottes\.com[^<]*)<\/loc>/g),
    (match) => new URL(match[1]).pathname
);

const localTargets = (html, pageUrl, baseOrigin) => {
    const pages = new Set();
    const assets = new Set();
    const anchors = [];
    const tags = html.match(/<(?:a|img|source|script|link|video)\b[^>]*>/gi) || [];

    const add = (rawValue, type) => {
        if (!rawValue || /^(?:data:|mailto:|tel:|javascript:)/i.test(rawValue)) return;
        let url;
        try {
            url = new URL(rawValue, pageUrl);
        } catch {
            return;
        }
        if (url.origin !== baseOrigin) return;
        const hash = url.hash;
        url.hash = '';
        if (type === 'page') {
            pages.add(url.href);
            if (hash) anchors.push({ url: url.href, hash: decodeURIComponent(hash.slice(1)) });
        } else {
            assets.add(url.href);
        }
    };

    for (const tag of tags) {
        const attrs = attributes(tag);
        const tagName = tag.match(/^<([a-z]+)/i)?.[1].toLowerCase();
        if (tagName === 'a') add(attrs.href, 'page');
        if (tagName === 'script') add(attrs.src, 'asset');
        if (tagName === 'img') add(attrs.src, 'asset');
        if (tagName === 'video') {
            add(attrs.src, 'asset');
            add(attrs.poster, 'asset');
        }
        if (tagName === 'source') add(attrs.src, 'asset');
        if (tagName === 'link' && /^(?:stylesheet|icon|preload)$/i.test(attrs.rel || '')) add(attrs.href, 'asset');

        for (const candidate of (attrs.srcset || '').split(',')) {
            add(candidate.trim().split(/\s+/)[0], 'asset');
        }
    }

    return { pages, assets, anchors };
};

const deployedUrl = (base, pathname) => new URL(pathname, `${base.origin}/`).href;

const request = async (url, options = {}) => {
    const response = await fetch(url, {
        redirect: options.redirect || 'follow',
        method: options.method || 'GET',
        headers: options.headers,
        signal: AbortSignal.timeout(options.timeout || 20_000)
    });
    return response;
};

const textResponse = async (url, options) => {
    const response = await request(url, options);
    return { response, text: await response.text() };
};

const probe = async (url) => {
    let response = await request(url, { method: 'HEAD' });
    if (response.status === 405 || response.status === 501) {
        response = await request(url, { headers: { Range: 'bytes=0-0' } });
    }
    return response;
};

const mapConcurrent = async (items, limit, operation) => {
    const queue = [...items];
    const workers = Array.from(
        { length: Math.min(Math.max(1, limit), queue.length) },
        async () => {
            while (queue.length) {
                const item = queue.shift();
                await operation(item);
            }
        }
    );
    await Promise.all(workers);
};

const redirectCases = () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    return config.redirects.map((entry) => ({
        source: entry.source.includes(':path*') ? entry.source.replace(':path*', 'release-audit') : entry.source,
        destination: entry.destination
    }));
};

const pagePath = (url) => {
    const pathname = new URL(url).pathname;
    return pathname === '/' ? '/' : pathname;
};

const findAnchor = (html, id) => {
    if (!id) return true;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:id|name)=["']${escaped}["']`, 'i').test(html);
};

const runAudit = async ({ baseUrl, expectNoindex }) => {
    const base = new URL(baseUrl);
    if (base.protocol !== 'https:') throw new Error('The deployment audit requires an HTTPS URL.');

    const failures = [];
    const note = (condition, message) => { if (!condition) failures.push(message); };
    const fetchedHtml = new Map();
    const internalPages = new Set();
    const assets = new Set();
    const anchors = [];

    const sitemapResult = await textResponse(deployedUrl(base, '/sitemap.xml'));
    note(sitemapResult.response.status === 200, `sitemap.xml returned ${sitemapResult.response.status}`);
    const paths = sitemapPaths(sitemapResult.text);
    note(paths.length > 0, 'sitemap.xml did not contain any lasclottes.com URLs');
    note(new Set(paths).size === paths.length, 'sitemap.xml contains duplicate URLs');

    for (const pathname of paths) {
        const url = deployedUrl(base, pathname);
        const { response, text } = await textResponse(url);
        const label = pathname;
        note(response.status === 200, `${label} returned ${response.status}`);
        note((response.headers.get('content-type') || '').includes('text/html'), `${label} is not HTML`);
        const pageMeta = metadata(text);
        const expectedCanonical = new URL(pathname, `${LIVE_ORIGIN}/`).href;
        const canonical = pageMeta.links.find((link) => link.rel === 'canonical')?.href;
        const htmlAttributes = attributes(text.match(/<html\b[^>]*>/i)?.[0] || '');
        note(pageMeta.title.length >= 10 && pageMeta.title.length <= 75, `${label} has an invalid title length`);
        note((pageMeta.meta.get('description') || '').length >= 50, `${label} has a short or missing description`);
        note(pageMeta.meta.get('robots') === 'index, follow', `${label} does not have index, follow page metadata`);
        note(canonical === expectedCanonical, `${label} canonical is ${canonical || 'missing'}`);
        note(Boolean(htmlAttributes.lang), `${label} is missing the document language`);
        note((text.match(/<h1\b/gi) || []).length === 1, `${label} does not have exactly one H1`);
        note(!/\b(?:href|src)=["']http:\/\//i.test(text), `${label} contains mixed-content URLs`);
        for (const tag of text.match(/<img\b[^>]*>/gi) || []) {
            note(Object.hasOwn(attributes(tag), 'alt'), `${label} contains an image without an alt attribute`);
        }
        for (const key of REQUIRED_SOCIAL_META) {
            note(Boolean(pageMeta.meta.get(key)), `${label} is missing ${key}`);
        }
        note(pageMeta.meta.get('og:url') === expectedCanonical, `${label} has an incorrect og:url`);
        note(pageMeta.meta.get('twitter:image') === pageMeta.meta.get('og:image'), `${label} social images do not match`);

        for (const jsonText of Array.from(
            text.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi),
            (match) => match[1]
        )) {
            try {
                JSON.parse(jsonText);
            } catch {
                failures.push(`${label} contains invalid JSON-LD`);
            }
        }

        fetchedHtml.set(url, text);
        const targets = localTargets(text, url, base.origin);
        for (const target of targets.pages) internalPages.add(target);
        for (const target of targets.assets) assets.add(target);
        for (const socialKey of ['og:image', 'twitter:image']) {
            const socialUrl = pageMeta.meta.get(socialKey);
            if (!socialUrl) continue;
            try {
                assets.add(deployedUrl(base, new URL(socialUrl).pathname));
            } catch {
                failures.push(`${label} has an invalid ${socialKey} URL`);
            }
        }
        anchors.push(...targets.anchors);
    }

    for (const url of internalPages) {
        let response;
        let text;
        if (fetchedHtml.has(url)) {
            response = { status: 200 };
            text = fetchedHtml.get(url);
        } else {
            const result = await textResponse(url);
            response = result.response;
            text = result.text;
            if ((response.headers.get('content-type') || '').includes('text/html')) fetchedHtml.set(url, text);
        }
        note(response.status < 400, `${pagePath(url)} returned ${response.status}`);
    }

    for (const target of anchors) {
        const html = fetchedHtml.get(target.url);
        if (html) note(findAnchor(html, target.hash), `${pagePath(target.url)} is missing #${target.hash}`);
    }

    await mapConcurrent(assets, 8, async (url) => {
        const response = await probe(url);
        note(response.status < 400, `${pagePath(url)} asset returned ${response.status}`);
        const type = response.headers.get('content-type') || '';
        note(!type.includes('text/html'), `${pagePath(url)} asset unexpectedly returned HTML`);
    });

    for (const entry of redirectCases()) {
        const response = await request(deployedUrl(base, entry.source), { redirect: 'manual' });
        const location = response.headers.get('location') || '';
        note([301, 308].includes(response.status), `${entry.source} returned ${response.status}, not a permanent redirect`);
        note(location.endsWith(entry.destination), `${entry.source} redirects to ${location || 'nowhere'}`);
    }

    for (const rewrite of ['/fr', '/nl']) {
        const response = await request(deployedUrl(base, rewrite));
        note(response.status === 200, `${rewrite} returned ${response.status}`);
    }

    const root = await request(deployedUrl(base, '/'));
    for (const header of REQUIRED_SECURITY_HEADERS) {
        note(Boolean(root.headers.get(header)), `home page is missing ${header}`);
    }
    const robotsHeader = (root.headers.get('x-robots-tag') || '').toLowerCase();
    if (expectNoindex) note(robotsHeader.includes('noindex'), 'staging host is missing its X-Robots-Tag: noindex protection');
    else note(!robotsHeader.includes('noindex'), 'production host is accidentally blocked by X-Robots-Tag: noindex');

    const robots = await textResponse(deployedUrl(base, '/robots.txt'));
    note(robots.response.status === 200, `robots.txt returned ${robots.response.status}`);
    note(/User-agent:\s*\*/i.test(robots.text), 'robots.txt has no default user-agent policy');
    note(/Disallow:\s*\/api\//i.test(robots.text), 'robots.txt does not protect API routes');
    note(robots.text.includes(`Sitemap: ${LIVE_ORIGIN}/sitemap.xml`), 'robots.txt has the wrong sitemap URL');

    const availability = await request(deployedUrl(base, '/api/availability'));
    note(availability.status === 200, `/api/availability returned ${availability.status}`);
    note((availability.headers.get('content-type') || '').includes('application/json'), '/api/availability is not JSON');
    try {
        const payload = await availability.json();
        note(payload.source === 'Lasclottes booking system', '/api/availability is using its static fallback instead of the booking database');
        note(/^\d{4}-\d{2}-\d{2}$/.test(payload.updated || ''), '/api/availability has no valid update date');
        note(Array.isArray(payload.blocked), '/api/availability has no blocked-date list');
    } catch {
        failures.push('/api/availability returned invalid JSON');
    }

    const operationsPage = await textResponse(deployedUrl(base, '/booking-operations.html'));
    note((operationsPage.response.headers.get('cache-control') || '').includes('no-store'), 'private operations page is not no-store');
    note((operationsPage.response.headers.get('x-robots-tag') || '').includes('noindex'), 'private operations page is not protected from indexing');
    const operationsRobots = (metadata(operationsPage.text).meta.get('robots') || '')
        .split(',')
        .map((value) => value.trim().toLowerCase());
    note(
        operationsRobots.includes('noindex') && operationsRobots.includes('nofollow'),
        'private operations page has incorrect page-level robots metadata'
    );
    const operationsApi = await request(deployedUrl(base, '/api/booking-operations'));
    note(operationsApi.status === 401, `unauthenticated booking operations returned ${operationsApi.status}, not 401`);

    for (const pathname of ['/payment-success.html', '/payment-cancelled.html', '/404.html']) {
        const statePage = await textResponse(deployedUrl(base, pathname));
        note(statePage.response.status < 400, `${pathname} returned ${statePage.response.status}`);
        note(metadata(statePage.text).meta.get('robots') === 'noindex, nofollow', `${pathname} has incorrect robots metadata`);
    }

    const termsPage = await textResponse(deployedUrl(base, '/booking-terms.html'));
    note(termsPage.response.status === 200, `/booking-terms.html returned ${termsPage.response.status}`);
    const termsRobots = metadata(termsPage.text).meta.get('robots') || '';
    const termsIsDraft = /data-terms-version=["'][^"']*draft/i.test(termsPage.text);
    if (termsIsDraft) {
        note(termsRobots.includes('noindex'), 'draft booking terms are indexable');
        note(!paths.includes('/booking-terms.html'), 'draft booking terms appear in the sitemap');
    } else {
        note(termsRobots === 'index, follow', 'final booking terms are not indexable');
        note(paths.includes('/booking-terms.html'), 'final booking terms are missing from the sitemap');
    }

    const missing = await request(deployedUrl(base, '/release-audit-page-that-does-not-exist'));
    note(missing.status === 404, `custom missing page returned ${missing.status}, not 404`);

    return {
        ok: failures.length === 0,
        failures,
        totals: {
            sitemapPages: paths.length,
            internalPages: internalPages.size,
            assets: assets.size,
            redirects: redirectCases().length
        },
        expectNoindex
    };
};

const parseArguments = (argv) => {
    const baseUrl = argv.find((value) => /^https:\/\//i.test(value));
    if (!baseUrl) throw new Error('Usage: npm run audit:deployment -- https://example.test --expect-noindex|--expect-index');
    const hasNoindex = argv.includes('--expect-noindex');
    const hasIndex = argv.includes('--expect-index');
    if (hasNoindex === hasIndex) throw new Error('Choose exactly one of --expect-noindex or --expect-index.');
    return { baseUrl, expectNoindex: hasNoindex };
};

if (require.main === module) {
    (async () => {
        try {
            const result = await runAudit(parseArguments(process.argv.slice(2)));
            if (!result.ok) {
                console.error(`Deployment audit failed with ${result.failures.length} issue(s):`);
                for (const failure of result.failures) console.error(`- ${failure}`);
                process.exitCode = 1;
                return;
            }
            const { sitemapPages, internalPages, assets, redirects } = result.totals;
            console.log(`Deployment audit passed: ${sitemapPages} sitemap pages, ${internalPages} internal destinations, ${assets} assets and ${redirects} legacy redirects.`);
            console.log(result.expectNoindex ? 'Staging no-index protection is active.' : 'Production indexing is enabled.');
        } catch (error) {
            console.error(error.message || error);
            process.exitCode = 1;
        }
    })();
}

module.exports = {
    attributes,
    findAnchor,
    localTargets,
    mapConcurrent,
    metadata,
    parseArguments,
    redirectCases,
    runAudit,
    sitemapPaths
};
