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

const money = (minorUnits, currency = 'GBP') => new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency
}).format(Number(minorUnits || 0) / 100);

const dateOnly = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''));
    return match ? match[1] : '';
};

const balanceDueDate = (booking) => {
    if (Number(booking.balance_due_later_pence || 0) <= 0) return '';
    const arrival = new Date(`${dateOnly(booking.arrival)}T00:00:00.000Z`);
    if (Number.isNaN(arrival.getTime())) return '';
    arrival.setUTCDate(arrival.getUTCDate() - 60);
    return arrival.toISOString().slice(0, 10);
};

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const validDomain = (value) => {
    const domain = String(value || '').trim().toLowerCase();
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
        ? domain
        : '';
};

const senderAddress = (configuredEmail, domain) => {
    const configured = String(configuredEmail || '').trim().toLowerCase();
    if (configured) return validEmail(configured) ? configured : '';
    const safeDomain = validDomain(domain);
    return safeDomain ? `bookings@${safeDomain}` : '';
};

const copyForLanguage = (language) => {
    if (language === 'fr') {
        return {
            subject: 'Confirmation de réservation Lasclottes',
            heading: 'Votre paiement a été reçu',
            greeting: (name) => `Bonjour ${name},`,
            intro: 'Merci. Votre réservation à Lasclottes est confirmée pour les dates ci-dessous.',
            dates: 'Dates', guests: 'Voyageurs', paid: 'Payé maintenant',
            balance: 'Solde à payer plus tard', balanceDue: 'Date limite du solde',
            reference: 'Référence', damage: 'Dépôt de garantie remboursable',
            tax: 'Taxe de séjour séparée', message: 'Demandes particulières', contact: 'Vos coordonnées',
            termsHeading: 'Conditions acceptées',
            termsIntro: 'La version anglaise des conditions acceptées lors du paiement est reproduite ci-dessous.',
            balanceReminder: (date) => `Merci de régler le solde restant au plus tard le ${date}.`,
            paidInFull: 'Aucun solde restant sur le prix de l’hébergement.'
        };
    }
    if (language === 'nl') {
        return {
            subject: 'Bevestiging van uw Lasclottes-boeking',
            heading: 'Uw betaling is ontvangen',
            greeting: (name) => `Beste ${name},`,
            intro: 'Bedankt. Uw boeking bij Lasclottes is bevestigd voor de onderstaande data.',
            dates: 'Datums', guests: 'Gasten', paid: 'Nu betaald',
            balance: 'Later te betalen saldo', balanceDue: 'Uiterste betaaldatum saldo',
            reference: 'Referentie', damage: 'Terugbetaalbare waarborg',
            tax: 'Afzonderlijke toeristenbelasting', message: 'Speciale verzoeken', contact: 'Uw contactgegevens',
            termsHeading: 'Geaccepteerde voorwaarden',
            termsIntro: 'De Engelse versie van de bij betaling geaccepteerde voorwaarden staat hieronder.',
            balanceReminder: (date) => `Betaal het resterende saldo uiterlijk op ${date}.`,
            paidInFull: 'Er is geen resterend saldo voor de accommodatie.'
        };
    }
    return {
        subject: 'Your Lasclottes booking confirmation',
        heading: 'Your payment has been received',
        greeting: (name) => `Hello ${name},`,
        intro: 'Thank you. Your booking at Lasclottes is confirmed for the dates below.',
        dates: 'Dates', guests: 'Guests', paid: 'Paid now',
        balance: 'Balance due later', balanceDue: 'Balance due date',
        reference: 'Reference', damage: 'Refundable damage deposit',
        tax: 'Separate tourist tax', message: 'Special requests', contact: 'Your contact details',
        termsHeading: 'Terms accepted',
        termsIntro: 'The terms accepted at checkout are reproduced below.',
        balanceReminder: (date) => `Please pay the remaining balance by ${date}.`,
        paidInFull: 'There is no remaining accommodation balance.'
    };
};

const table = (rows) => `<table style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `
    <tr><td style="padding:8px;border-bottom:1px solid #ddd"><strong>${escapeHtml(label)}</strong></td><td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}
</table>`;

const bookingDetails = (booking, copy) => {
    const dueDate = balanceDueDate(booking);
    const rows = [
        [copy.reference, booking.public_reference],
        [copy.dates, `${dateOnly(booking.arrival)} – ${dateOnly(booking.departure)}`],
        [copy.guests, `${booking.guests} (${booking.adults} adults, ${booking.children} children)`],
        [copy.paid, money(booking.amount_due_now_pence)],
        [copy.balance, money(booking.balance_due_later_pence)],
        [copy.damage, money(booking.damage_deposit_pence)],
        [copy.tax, money(booking.tourist_tax_eur_cents, 'EUR')]
    ];
    if (dueDate) rows.splice(5, 0, [copy.balanceDue, dueDate]);
    if (booking.guest_message) rows.push([copy.message, booking.guest_message]);
    return { dueDate, rows };
};

const agreementDetails = (booking) => {
    let snapshot = booking.agreement_snapshot;
    if (typeof snapshot === 'string') {
        try { snapshot = JSON.parse(snapshot); } catch (_) { snapshot = null; }
    }
    if (!snapshot || typeof snapshot !== 'object') snapshot = {};
    return {
        acceptedAt: String(booking.agreement_accepted_at || '').slice(0, 25),
        propertyDescription: String(snapshot.propertyDescription || ''),
        termsText: String(snapshot.termsText || ''),
        version: String(booking.agreement_version || snapshot.termsVersion || '')
    };
};

const buildGuestEmail = (booking) => {
    const copy = copyForLanguage(booking.language);
    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    const { dueDate, rows } = bookingDetails(booking, copy);
    const balanceNote = dueDate
        ? copy.balanceReminder(dueDate)
        : copy.paidInFull;
    const agreement = agreementDetails(booking);
    const agreementHtml = agreement.version && agreement.termsText
        ? `<h2 style="font-family:Georgia,serif">${escapeHtml(copy.termsHeading)}</h2>
            <p>${escapeHtml(copy.termsIntro)}</p>
            <p><strong>Version:</strong> ${escapeHtml(agreement.version)}${agreement.acceptedAt ? ` · <strong>Accepted:</strong> ${escapeHtml(agreement.acceptedAt)}` : ''}</p>
            ${agreement.propertyDescription ? `<p>${escapeHtml(agreement.propertyDescription)}</p>` : ''}
            <div style="white-space:pre-wrap;font-size:13px;line-height:1.5;background:#f6f3ec;padding:16px">${escapeHtml(agreement.termsText)}</div>`
        : '';
    const agreementText = agreement.version && agreement.termsText
        ? `\n\n${copy.termsHeading}\n${copy.termsIntro}\nVersion: ${agreement.version}${agreement.acceptedAt ? ` · Accepted: ${agreement.acceptedAt}` : ''}${agreement.propertyDescription ? `\n\n${agreement.propertyDescription}` : ''}\n\n${agreement.termsText}`
        : '';
    return {
        subject: copy.subject,
        html: `<div style="font-family:Arial,sans-serif;color:#243127;max-width:620px;margin:auto">
            <h1 style="font-family:Georgia,serif">${escapeHtml(copy.heading)}</h1>
            <p>${escapeHtml(copy.greeting(customerName))}</p>
            <p>${escapeHtml(copy.intro)}</p>
            ${table(rows)}
            <p>${escapeHtml(balanceNote)}</p>
            <p>${escapeHtml(copy.contact)}: ${escapeHtml(booking.email)} · ${escapeHtml(booking.phone)}</p>
            ${agreementHtml}
            <p>Lasclottes · <a href="https://lasclottes.com">lasclottes.com</a> · <a href="mailto:info@lasclottes.com">info@lasclottes.com</a></p>
        </div>`,
        text: `${copy.heading}\n\n${copy.greeting(customerName)}\n${copy.intro}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${balanceNote}\n${copy.contact}: ${booking.email} · ${booking.phone}${agreementText}\n\nLasclottes · https://lasclottes.com · info@lasclottes.com`
    };
};

const buildOwnerEmail = (booking) => {
    const copy = copyForLanguage('en');
    const customerName = `${booking.first_name} ${booking.last_name}`.trim();
    const { rows } = bookingDetails(booking, copy);
    const ownerRows = [
        ...rows,
        ['Guest', customerName],
        ['Email', booking.email],
        ['Phone', booking.phone],
        ['Language', booking.language],
        ['Payment stage', booking.payment_stage],
        ['Terms version', agreementDetails(booking).version || 'legacy / not recorded']
    ];
    return {
        subject: `Paid Lasclottes booking ${booking.public_reference}: ${dateOnly(booking.arrival)} to ${dateOnly(booking.departure)}`,
        html: `<div style="font-family:Arial,sans-serif;color:#243127;max-width:620px;margin:auto">
            <h1 style="font-family:Georgia,serif">New paid Lasclottes booking</h1>
            <p>Stripe has confirmed the payment recorded below.</p>
            ${table(ownerRows)}
            <p>Review the booking in Stripe and the Lasclottes booking database before making any manual changes.</p>
        </div>`,
        text: `New paid Lasclottes booking\n\nStripe has confirmed the payment recorded below.\n\n${ownerRows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nReview the booking in Stripe and the Lasclottes booking database before making any manual changes.`
    };
};

const resendHeaders = (apiKey, idempotencyKey) => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
    'User-Agent': 'Lasclottes-Booking/1.0 (+https://lasclottes.com)'
});

const resendBody = ({ booking, kind, from, to, replyTo, content }) => ({
    from,
    to: [to],
    reply_to: replyTo,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
        { name: 'category', value: kind.replaceAll('_', '-') },
        { name: 'booking', value: booking.public_reference.toLowerCase() }
    ]
});

const sendEmailOnce = async ({ booking, kind, apiKey, from, to, replyTo, content }) => {
    const claimed = await claimEmailDelivery(booking.id, kind);
    if (!claimed) return { skipped: true, reason: 'already_sent' };
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: resendHeaders(apiKey, `${kind}/${booking.id}`),
            body: JSON.stringify(resendBody({ booking, kind, from, to, replyTo, content }))
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.id) throw new Error(`Resend request failed (${response.status}).`);
        await completeEmailDelivery(booking.id, kind, data.id);
        return { sent: true, id: data.id };
    } catch (error) {
        await failEmailDelivery(booking.id, kind, error?.message);
        throw error;
    }
};

const sendBookingConfirmationOnce = async (booking) => {
    if (!config.emailsEnabled()) return { skipped: true, reason: 'emails_disabled' };
    const apiKey = config.resendApiKey();
    const senderEmail = senderAddress(config.senderEmail(), config.emailDomain());
    const ownerEmail = String(config.ownerEmail() || '').trim().toLowerCase();
    if (!apiKey || !senderEmail || !validEmail(booking.email) || !validEmail(ownerEmail)) {
        throw new Error('Booking email is not configured.');
    }

    const from = `Lasclottes <${senderEmail}>`;
    const guest = await sendEmailOnce({
        booking,
        kind: 'guest_payment_confirmation',
        apiKey,
        from,
        to: booking.email,
        replyTo: ownerEmail,
        content: buildGuestEmail(booking)
    });
    const owner = await sendEmailOnce({
        booking,
        kind: 'owner_booking_notification',
        apiKey,
        from,
        to: ownerEmail,
        replyTo: booking.email,
        content: buildOwnerEmail(booking)
    });
    return { guest, owner };
};

module.exports = {
    balanceDueDate,
    buildGuestEmail,
    buildOwnerEmail,
    dateOnly,
    agreementDetails,
    resendBody,
    resendHeaders,
    senderAddress,
    sendBookingConfirmationOnce,
    validDomain
};
