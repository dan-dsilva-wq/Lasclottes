# Lasclottes Wix replacement integration

This folder is the checked-in source for the unpublished Wix replacement site.

- `booking-widget.html` is pasted into a Wix **Embed HTML** element with ID `bookingWidget`.
- `booking-page-code.js` is the page code for the booking page/section.
- `booking-bridge.web.js` is a backend web module. It keeps the bridge token server-side and calls the existing Neon/Stripe/Resend booking service.
- Wix Secrets Manager must contain `LAS_CLOTTES_BOOKING_BRIDGE_TOKEN` with the same value as Vercel's `WIX_BOOKING_BRIDGE_TOKEN`.
- Vercel must list the exact Wix free-site base URL and final Lasclottes origins in `WIX_SITE_BASE_URLS`.
- During unpublished draft testing, both `WIX_DRAFT_TEST_MODE` in the Wix page code and `WIX_BOOKING_TEST_MODE` in Vercel are `true`.
- Before Sally publishes the replacement, switch both test flags to `false`, replace Stripe test credentials with the restricted live key/webhook, and re-run the complete payment/email test.

Do not publish the draft from Wix. Sally will perform the final publish/replace action after the verified screenshots and owner/legal approvals.
