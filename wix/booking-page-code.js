import wixLocationFrontend from 'wix-location-frontend';
import {
    createLasclottesCheckout,
    getLasclottesAvailability
} from 'backend/booking-bridge.web';

// Keep true only while testing the unpublished Wix replacement.
const WIX_DRAFT_TEST_MODE = true;

$w.onReady(() => {
    const bookingWidget = $w('#bookingWidget');
    let working = false;
    let widgetReady = false;
    let availabilityData = null;
    let availabilityRequest = null;

    const send = (message) => bookingWidget.postMessage(message);
    const sendConfig = () => send({ type: 'lasclottes-config', testMode: WIX_DRAFT_TEST_MODE });
    const configTimer = setInterval(() => {
        if (widgetReady) return clearInterval(configTimer);
        sendConfig();
    }, 500);
    sendConfig();

    bookingWidget.onMessage(async (event) => {
        const message = event.data;
        if (!message || typeof message !== 'object') return;

        if (message.type === 'lasclottes-ready') {
            widgetReady = true;
            clearInterval(configTimer);
            sendConfig();
            if (availabilityData) {
                send({ type: 'lasclottes-availability', availability: availabilityData });
                return;
            }
            if (!availabilityRequest) {
                availabilityRequest = getLasclottesAvailability()
                    .then((availability) => {
                        availabilityData = availability;
                        send({ type: 'lasclottes-availability', availability });
                    })
                    .catch(() => {
                        send({
                            type: 'lasclottes-error',
                            message: 'Availability is temporarily unavailable. Please contact Sally before booking.'
                        });
                    });
            }
            await availabilityRequest;
            return;
        }

        if (message.type !== 'lasclottes-checkout' || working) return;
        working = true;
        send({ type: 'lasclottes-working' });
        try {
            const checkout = await createLasclottesCheckout(
                message.payload,
                wixLocationFrontend.baseUrl
            );
            if (!checkout || !checkout.url) throw new Error('Stripe did not return a checkout address.');
            wixLocationFrontend.to(checkout.url);
        } catch (error) {
            working = false;
            send({
                type: 'lasclottes-error',
                message: error?.message || 'Could not open secure card checkout. Please try again.'
            });
        }
    });
});
