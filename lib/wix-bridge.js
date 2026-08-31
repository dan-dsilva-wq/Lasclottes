'use strict';

const { headerValue } = require('./abuse');
const { config } = require('./config');
const { operationsAuthorized } = require('./operations-auth');

const normalizeSiteBaseUrl = (value) => {
    try {
        const parsed = new URL(String(value || '').trim());
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
        if (parsed.search || parsed.hash) return '';
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    } catch (_) {
        return '';
    }
};

const configuredSiteBaseUrls = () => config.wixSiteBaseUrls()
    .map(normalizeSiteBaseUrl)
    .filter(Boolean);

const wixBridgeContext = async (req) => {
    const authorization = headerValue(req?.headers, 'authorization');
    const authorized = await operationsAuthorized(authorization, config.wixBridgeToken());
    if (!authorized) return { authenticated: false, siteBaseUrl: '', testMode: false };

    const suppliedBaseUrl = normalizeSiteBaseUrl(headerValue(req?.headers, 'x-lasclottes-site-base-url'));
    if (!suppliedBaseUrl || !configuredSiteBaseUrls().includes(suppliedBaseUrl)) {
        return { authenticated: false, siteBaseUrl: '', testMode: false };
    }
    return {
        authenticated: true,
        siteBaseUrl: suppliedBaseUrl,
        testMode: config.wixTestMode()
    };
};

const wixReturnUrl = (explicitUrl, siteBaseUrl, fallbackPath) => {
    const configured = normalizeSiteBaseUrl(explicitUrl);
    if (configured) return configured;
    const base = normalizeSiteBaseUrl(siteBaseUrl);
    if (!base) return '';
    return `${base}${fallbackPath}`;
};

module.exports = {
    configuredSiteBaseUrls,
    normalizeSiteBaseUrl,
    wixBridgeContext,
    wixReturnUrl
};
