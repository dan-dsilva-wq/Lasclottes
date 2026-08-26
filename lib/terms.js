'use strict';

const BOOKING_TERMS_VERSION = '2026-08-26-draft-3';

const PROPERTY_DESCRIPTION = [
    'The booking covers the Lasclottes Granary and, where included in the quotation, the adjoining Annex at Lieu-dit Las Clottes, 47140 Saint-Sylvestre-sur-Lot, France.',
    'The currently bookable accommodation has five bedrooms, four bathrooms and a maximum occupancy of 12 people.',
    'The main Farmhouse is under renovation, is planned to open in 2028 and is not included in a current booking.',
    'The stay includes the facilities stated on the website and booking confirmation, subject to any written property-specific safety or operating instructions.'
].join(' ');

const BOOKING_TERMS_TEXT = [
    'Making a booking: An online quote or checkout session does not by itself reserve the property. A booking is confirmed only after the required payment has cleared and Lasclottes has issued written confirmation. Availability is checked again before confirmation.',
    'Guests and length of stay: The maximum occupancy is 12 people in total. May, June and September bookings have a four-night minimum. July and August bookings are in weekly blocks from Saturday to Saturday. The property is currently closed from October to April unless agreed otherwise in writing.',
    'Price and payment: The accommodation price is shown in pounds sterling (GBP). If arrival is more than 60 days away, a non-refundable 25% booking payment is due on confirmation. The remaining accommodation balance and the refundable GBP 500 damage deposit are due 60 days before arrival. When booking within 60 days of arrival, the full accommodation price and damage deposit are due on confirmation.',
    'Tourist tax: The current public tourist-tax estimate is shown separately in euros at EUR 1.41 per adult per night. It is not included in the GBP card figures. The final amount depends on the accommodation classification and the rate then in force; Lasclottes will confirm the amount and payment method before the balance is due.',
    'Cancellation: If the guest cancels more than 60 days before arrival, the 25% booking payment is not refundable and no further accommodation payment is due. The position for a cancellation, curtailment or failure to arrive within 60 days will be stated in the booking confirmation. Suitable travel insurance is strongly recommended.',
    'Damage deposit and care: A refundable GBP 500 damage deposit is required. It is normally returned within 14 days after departure, less any reasonable amount for damage, loss, exceptional cleaning or other costs attributable to the booking party. Damage or faults should be reported promptly.',
    'Safety and supervision: The lead guest is responsible for appropriate use of the property and equipment and for the conduct of the group. Children must be supervised at all times, particularly around the swimming pool, river, grounds, sports equipment and appliances. Property-specific instructions supplied before or during the stay form part of the terms.',
    'Changes outside our control: If a serious problem outside Lasclottes\' reasonable control makes the accommodation unavailable, Lasclottes will contact the guest as soon as possible and offer the practical options available, which may include alternative dates or a refund of amounts paid to Lasclottes for the affected stay. Separate travel or other third-party costs are not covered except where the law requires otherwise.',
    'Problems during a stay: The guest should report a problem promptly during the stay so Lasclottes has a reasonable opportunity to help.'
].join('\n\n');

const bookingAgreementSnapshot = ({ quote, publicReference }) => ({
    schemaVersion: 1,
    termsVersion: BOOKING_TERMS_VERSION,
    operator: {
        name: 'Sally Spencer',
        tradingAs: 'Lasclottes / French Riverside Holidays',
        register: 'Registre national des entreprises (RNE)',
        siren: '521 892 992',
        siret: '521 892 992 00012',
        address: 'Lieu-dit Las Clottes, 47140 Saint-Sylvestre-sur-Lot, France',
        email: 'info@lasclottes.com'
    },
    propertyDescription: PROPERTY_DESCRIPTION,
    booking: {
        reference: publicReference,
        arrival: quote.arrivalDate,
        departure: quote.departureDate,
        adults: quote.adults,
        children: quote.children,
        guests: quote.guests,
        nights: quote.nights,
        season: quote.season,
        paymentStage: quote.paymentStage
    },
    price: {
        accommodationCurrency: 'GBP',
        accommodationTotalMinorUnits: Math.round(quote.stayTotal * 100),
        amountDueNowMinorUnits: Math.round(quote.amountDueNow * 100),
        balanceDueLaterMinorUnits: Math.round(quote.balanceDueLater * 100),
        refundableDamageDepositMinorUnits: Math.round(quote.damageDeposit * 100),
        touristTaxCurrency: 'EUR',
        touristTaxMinorUnits: Math.round(quote.touristTaxEur * 100)
    },
    termsText: BOOKING_TERMS_TEXT
});

module.exports = {
    BOOKING_TERMS_TEXT,
    BOOKING_TERMS_VERSION,
    PROPERTY_DESCRIPTION,
    bookingAgreementSnapshot
};
