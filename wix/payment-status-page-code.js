import wixLocationFrontend from 'wix-location-frontend';
import { getLasclottesBookingStatus } from 'backend/booking-bridge.web';

$w.onReady(() => {
    const statusWidget = $w('#paymentStatusWidget');
    const sessionId = String(wixLocationFrontend.query?.session_id || '');
    let request = null;
    let finalResult = null;

    const send = (result) => statusWidget.postMessage({
        type: 'lasclottes-status-result',
        result
    });

    const verify = async () => {
        if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
            return { status: 'problem' };
        }
        let lastResult = { status: 'processing' };
        for (let attempt = 0; attempt < 5; attempt += 1) {
            try {
                lastResult = await getLasclottesBookingStatus(sessionId);
                if (['confirmed', 'not_confirmed'].includes(lastResult.status)) {
                    return lastResult.status === 'not_confirmed'
                        ? { ...lastResult, status: 'problem' }
                        : lastResult;
                }
            } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, 1800));
        }
        return lastResult;
    };

    statusWidget.onMessage(async (event) => {
        if (event.data?.type !== 'lasclottes-status-ready') return;
        if (finalResult) return send(finalResult);
        if (!request) request = verify().then((result) => { finalResult = result; return result; });
        send(await request);
    });
});
