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
- `WIX_BOOKING_TEST_MODE` controls only the temporary £1 quote and open-date behaviour. `WIX_LIVE_PAYMENTS` separately chooses the restricted live Stripe key, so the owner-approved £1 real-card test can run without losing the private test pricing.
- Store the restricted key as the encrypted Cloudflare secret `STRIPE_LIVE_SECRET_KEY` and its live endpoint signing secret as `STRIPE_LIVE_WEBHOOK_SECRET`. Keep the existing test secrets in place for staging checks.
- Set `STRIPE_LIVE_WEBHOOKS_ON_SHARED_ENDPOINT=true` only after the live Stripe endpoint targets the signed Worker webhook URL. Test and live deliveries remain isolated by their separate signing secrets.
- Configure `WIX_STRIPE_SUCCESS_URL` and `WIX_STRIPE_CANCEL_URL` to the Wix thank-you and retry pages before testing checkout. This prevents Stripe from returning a guest to a missing page.
- Keep the cancelled-payment page explicit: state that no reservation was made, offer a return to the booking page, and show `info@lasclottes.com` for help. It does not need access to booking data.
- For the owner-approved £1 real-card test, keep both test-price flags `true`, set `WIX_LIVE_PAYMENTS=true`, approve the reviewed booking terms gate, and verify the payment, database record, webhook and all guest/owner emails. After that test, restore real pricing by switching both test-price flags to `false`; leave `WIX_LIVE_PAYMENTS=true` for ordinary live bookings.

Before Sally publishes, switch both test flags to `false`, complete the verified screenshots and owner/legal approvals, and rerun the full acceptance checklist. Do not publish the draft from Wix; Sally will perform the final publish/replace action herself.
