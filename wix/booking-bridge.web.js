import { webMethod, Permissions } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';

const API_BASE_URL = 'https://lasclottes.super-bread-8b96.workers.dev';
const BRIDGE_SECRET_NAME = 'LAS_CLOTTES_BOOKING_BRIDGE_TOKEN';

const jsonResponse = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || `Lasclottes booking service returned ${response.status}.`);
        error.code = data.code || 'booking_service_error';
        throw error;
    }
    return data;
};

export const getLasclottesAvailability = webMethod(Permissions.Anyone, async () => {
    const response = await fetch(`${API_BASE_URL}/api/availability`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
    });
    return jsonResponse(response);
});

export const getLasclottesBookingStatus = webMethod(Permissions.Anyone, async (sessionId) => {
    const normalized = String(sessionId || '').slice(0, 200);
    if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(normalized)) {
        throw new Error('The Stripe checkout reference is invalid.');
    }
    const response = await fetch(
        `${API_BASE_URL}/api/booking-status?session_id=${encodeURIComponent(normalized)}`,
        { method: 'GET', headers: { Accept: 'application/json' } }
    );
    return jsonResponse(response);
});

export const createLasclottesCheckout = webMethod(Permissions.Anyone, async (payload, siteBaseUrl) => {
    const bridgeToken = await getSecret(BRIDGE_SECRET_NAME);
    if (!bridgeToken) throw new Error('The booking bridge secret is not configured.');

    const response = await fetch(`${API_BASE_URL}/api/create-stripe-checkout`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bridgeToken}`,
            'X-Lasclottes-Site-Base-Url': siteBaseUrl
        },
        body: JSON.stringify(payload)
    });
    return jsonResponse(response);
});
