'use strict';

const { config } = require('./config');
const {
    claimEmailDelivery,
    completeEmailDelivery,
    failEmailDelivery
} = require('./database');

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const money = (pence, currency = 'GBP') => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency
}).format(Number(pence || 0) / 100);

const copyForLanguage = (language) => {
    if (language === 'fr') {
        return {
            subject: 'Confirmation de réservation Lasclottes',
            heading: 'Votre paiement a été reçu',
            intro: 'Merci. Votre réservation à Lasclottes est confirmée pour les dates ci-dessous.',
            dates: 'Dates', guests: 'Voyageurs', paid: 'Payé maintenant',
            balance: 'Solde à payer plus tard', reference: 'Référence',
            tax: 'La taxe de séjour est payable séparément selon les conditions de réservation.'
        };
    }
    if (language === 'nl') {
        return {
            subject: 'Bevestiging van uw Lasclottes-boeking',
            heading: 'Uw betaling is ontvangen',
            intro: 'Bedankt. Uw boeking bij Lasclottes is bevestigd voor de onderstaande data.',
            dates: 'Datums', guests: 'Gasten', paid: 'Nu betaald',
            balance: 'Later te betalen saldo', reference: 'Referentie',
            tax: 'Toeristenbelasting wordt afzonderlijk betaald volgens de boekingsvoorwaarden.'
        };
    }
    return {
        subject: 'Your Lasclottes booking confirmation',
        heading: 'Your payment has been received',
        intro: 'Thank you. Your booking at Lasclottes is confirmed for the dates below.',
        dates: 'Dates', guests: 'Guests', paid: 'Paid now',
        balance: 'Balance due later', reference: 'Reference',
        tax: 'Tourist tax is payable separately as described in the booking terms.'
    };
};

const sendBookingConfirmationOnce = async (booking) => {
    if (!config.emailsEnabled()) return { skipped: true, reason: 'emails_disabled' };
    const apiKey = config.resendApiKey();
    const domain = config.emailDomain();
    if (!apiKey || !domain) throw new Error('Booking email is not configured.');

    const kind = 'payment_confirmation';
    const claimed = await claimEmailDelivery(booking.id, kind);
    if (!claimed) return { skipped: true, reason: 'already_sent' };

    const copy = copyForLanguage(booking.language);
    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    const html = `
        <div style="font-family:Arial,sans-serif;color:#243127;max-width:620px;margin:auto">
            <h1 style="font-family:Georgia,serif">${escapeHtml(copy.heading)}</h1>
            <p>${escapeHtml(copy.intro)}</p>
            <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(copy.reference)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(booking.public_reference)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(copy.dates)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(booking.arrival)} – ${escapeHtml(booking.departure)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(copy.guests)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(booking.guests)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(copy.paid)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${money(booking.amount_due_now_pence)}</td></tr>
                <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(copy.balance)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${money(booking.balance_due_later_pence)}</td></tr>
            </table>
            <p>${escapeHtml(copy.tax)}</p>
            <p>Lasclottes · <a href="https://lasclottes.com">lasclottes.com</a></p>
        </div>`;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': `booking-confirmation/${booking.id}`
            },
            body: JSON.stringify({
                from: `Lasclottes <bookings@${domain}>`,
                to: [booking.email],
                bcc: [config.ownerEmail()],
                subject: copy.subject,
                html,
                text: `${copy.heading}\n\n${copy.intro}\n${copy.reference}: ${booking.public_reference}\n${copy.dates}: ${booking.arrival} - ${booking.departure}\n${copy.guests}: ${booking.guests}\n${copy.paid}: ${money(booking.amount_due_now_pence)}\n${copy.balance}: ${money(booking.balance_due_later_pence)}\n\n${copy.tax}`,
                tags: [
                    { name: 'category', value: 'booking-confirmation' },
                    { name: 'booking', value: booking.public_reference.toLowerCase() }
                ]
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.id) throw new Error(`Resend request failed (${response.status}).`);
        await completeEmailDelivery(booking.id, kind, data.id);
        return { sent: true, id: data.id, customerName };
    } catch (error) {
        await failEmailDelivery(booking.id, kind, error?.message);
        throw error;
    }
};

module.exports = { sendBookingConfirmationOnce };
