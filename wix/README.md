# Lasclottes Wix replacement integration

This folder is the checked-in source for the unpublished Wix replacement site.

- `booking-widget.html` is pasted into a Wix **Embed HTML** element with ID `bookingWidget`.
- `booking-page-code.js` is the page code for the booking page/section.
- `booking-bridge.web.js` is a backend web module. It keeps the bridge token server-side and calls the existing Neon/Stripe/Resend booking service.
- `payment-status-widget.html` and `payment-status-page-code.js` form the Wix payment-success page. The widget ID must be `paymentStatusWidget`; it verifies the Stripe session before telling a guest that the booking is confirmed.
- Wix Secrets Manager must contain `LAS_CLOTTES_BOOKING_BRIDGE_TOKEN` with the same value as the Cloudflare Worker's encrypted `WIX_BOOKING_BRIDGE_TOKEN` secret.
- The Cloudflare Worker must list the exact Wix free-site base URL and final Lasclottes site base URLs in `WIX_SITE_BASE_URLS`.
- Set `BOOKING_OWNER_EMAIL=sallyaspencer@icloud.com` and `BOOKING_MONITOR_EMAILS=dan-dsilva@outlook.com`. Checkout-started and paid-booking alerts are delivered and audited separately for the two recipients.
- Keep a native Wix enquiry form on the contact section. Its automation must both show the submission in Wix Inbox and send the complete submission independently to Sally and Daniel.
- During unpublished draft testing, both `WIX_DRAFT_TEST_MODE` in the Wix page code and the Cloudflare Worker's `WIX_BOOKING_TEST_MODE` are `true`.
- Configure `WIX_STRIPE_SUCCESS_URL` and `WIX_STRIPE_CANCEL_URL` to the Wix thank-you and retry pages before testing checkout. This prevents Stripe from returning a guest to a missing page.
- Keep the cancelled-payment page explicit: state that no reservation was made, offer a return to the booking page, and show `info@lasclottes.com` for help. It does not need access to booking data.
- Before Sally publishes the replacement, switch both test flags to `false`, replace Stripe test credentials with the restricted live key/webhook, point the return URLs at the final Wix pages, and re-run the complete payment/email test.

Do not publish the draft from Wix. Sally will perform the final publish/replace action after the verified screenshots and owner/legal approvals.
