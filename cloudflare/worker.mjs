import availabilityHandler from '../api/availability.js';
import bookingStatusHandler from '../api/booking-status.js';
import checkoutHandler from '../api/create-stripe-checkout.js';
import { POST as stripeWebhookHandler } from '../api/stripe-webhook.mjs';

const API_ROUTES = new Map([
    ['/api/availability', availabilityHandler],
    ['/api/booking-status', bookingStatusHandler],
    ['/api/create-stripe-checkout', checkoutHandler]
]);

const responseHeaders = (headers = new Headers()) => {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return headers;
};

const nodeHandlerResponse = async (handler, request) => {
    const url = new URL(request.url);
    const headers = new Headers();
    let statusCode = 200;
    let response;
    const res = {
        setHeader(name, value) {
            headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
        },
        status(code) {
            statusCode = Number(code) || 500;
            return this;
        },
        json(payload) {
            response = new Response(JSON.stringify(payload), {
                status: statusCode,
                headers: responseHeaders(headers)
            });
            return response;
        }
    };
    const req = {
        method: request.method,
        headers: Object.fromEntries(request.headers),
        query: Object.fromEntries(url.searchParams),
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
    };

    const result = await handler(req, res);
    if (result instanceof Response) return result;
    if (response) return response;
    return new Response(null, { status: statusCode, headers: responseHeaders(headers) });
};

const assetRewrite = (request, pathname) => {
    const url = new URL(request.url);
    url.pathname = pathname;
    return new Request(url, request);
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/api/stripe-webhook') {
            return stripeWebhookHandler(request);
        }
        const nodeHandler = API_ROUTES.get(url.pathname);
        if (nodeHandler) return nodeHandlerResponse(nodeHandler, request);

        if (url.pathname === '/') return env.ASSETS.fetch(assetRewrite(request, '/index.html'));
        if (url.pathname === '/fr') return env.ASSETS.fetch(assetRewrite(request, '/fr.html'));
        if (url.pathname === '/nl') return env.ASSETS.fetch(assetRewrite(request, '/nl.html'));
        return env.ASSETS.fetch(request);
    }
};
