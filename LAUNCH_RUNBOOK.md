# Lasclottes launch runbook

This file is the operational checklist for replacing the Wix website. It deliberately contains no passwords, API keys or other secrets.

## Current position

- The public Wix site stays live until every pre-launch gate below has passed.
- Development work is isolated on `codex/site-review-2026-08-24` and is automatically deployed to a Vercel preview.
- The domain is registered at Wix and currently uses Wix nameservers.
- Google Workspace email uses the domain's existing MX and TXT records. Those records must not be removed or replaced during the website cutover.
- Vercel Hobby is the review host only. It must not serve the commercial live site under Vercel's current non-commercial Hobby terms.
- Cloudflare Workers with Static Assets is the selected no-monthly-fee production target. The public domain will still be `lasclottes.com`; no production Cloudflare account, deployment or DNS change has been made yet.
- Production online payments remain disabled. The payment switch is enabled only on the isolated Preview environment for sandbox acceptance testing.

## Owner decisions required before payments are enabled

- [ ] Confirm the legal name of the person or business taking bookings and the postal address that must appear in the privacy notice and booking confirmation.
- [ ] Approve the booking terms, especially the cancellation outcome within 60 days of arrival.
- [ ] Confirm that the public tourist-tax figure of EUR 1.41 per adult per night is current, who is exempt, and how it will be collected.
- [ ] Confirm the GBP pricing rules, 25% initial payment, GBP 500 refundable damage deposit, 60-day balance deadline and bank-transfer process.
- [ ] Confirm the maximum occupancy of 12 and the current bedroom/bathroom description.
- [ ] Choose the inbox that receives new-booking notifications and the verified sender address used for guest confirmations.
- [ ] Confirm the currently blocked dates in `data/availability.json` against the authoritative booking diary.

The legal pages are a practical working draft, not legal advice. The accommodation owner should approve them before accepting a payment.

## Vercel project gates

- [x] Sign in to the Vercel project dashboard.
- [x] In Project Settings > Git, enable Git Large File Storage (LFS), redeploy the review branch, and confirm hosted media contains real image bytes.
- [x] Provision the `lasclottes-stripe-test` Stripe sandbox for Preview and Development only. Its credentials use the `TEST_` prefix.
- [x] Provision the `lasclottes-bookings` Neon Free database in Frankfurt for Preview and Development only, with preview branching and the `BOOKINGS_` prefix.
- [x] Provision the `lasclottes-email-test` Resend Free service in Ireland for Preview and Development only, with the `TEST_EMAIL_` prefix.
- [x] Configure a Preview-only Stripe webhook and verify signed callbacks, rejected invalid signatures and retry idempotency.
- [x] Configure the Preview-only Resend delivery webhook for sent, delivered, delayed, bounced, complained, failed and suppressed events; keep its signing secret scoped to the review branch.
- [x] Keep Vercel on Hobby and restrict it to non-live review deployments; do not upgrade to Pro.
- [x] Pull the provisioned Preview environment locally into the ignored `.vercel` directory without displaying or committing secret values.
- [x] Apply the reviewed booking schema automatically to the isolated Preview database branch.
- [ ] Confirm and seed the authoritative blocked-date ranges once from the owner's booking diary.
- [ ] Move authoritative DNS from Wix to Cloudflare Free while initially preserving every Wix website and Google Workspace record. Resend reports that Wix cannot create the required subdomain MX record, so Resend verification cannot finish while Wix hosts DNS.
- [ ] After the Cloudflare DNS zone is active, add only Resend's DKIM TXT, `send` MX and `send` SPF TXT records, then verify the domain. Keep all root Google Workspace MX, SPF and verification records unchanged.
- [ ] Set the booking-notification inbox and verified sender address as encrypted Vercel environment variables.
- [x] Keep `BOOKING_PAYMENTS_ENABLED` true only in Preview for sandbox testing and absent/false in Production.

## Payment and booking acceptance tests

- [x] A quote for May, June or September enforces four nights and applies GBP 200/night for up to six guests or GBP 250/night for seven to twelve guests.
- [x] A July or August quote only accepts Saturday-to-Saturday weekly blocks at GBP 3,300/week.
- [x] October through April cannot be booked unless the owner explicitly changes the rule.
- [x] More than 60 days before arrival charges 25% of accommodation now and states the later balance and damage-deposit due date.
- [x] Within 60 days charges the full accommodation price plus the GBP 500 damage deposit.
- [x] Tourist tax remains clearly separate in EUR and is never silently added to a GBP card charge.
- [x] The server rejects altered browser prices, invalid dates, excessive occupancy and blocked dates.
- [x] Two simultaneous attempts for overlapping dates cannot both create payable reservations.
- [x] The public checkout rejects requests from untrusted origins, rate-limits repeated attempts without retaining raw visitor addresses, and releases the test dates after checkout expiry.
- [x] A pending checkout hold expires and releases its dates after the documented timeout.
- [x] Stripe's successful test card marks the reservation paid exactly once, even if the webhook is retried.
- [x] Stripe declined-card and expiry flows leave the booking unconfirmed and release the dates.
- [ ] Define and test the owner-approved cancellation and refund workflow before launch.
- [x] Record partial and full Stripe refund events for audit without automatically cancelling the booking or releasing its dates.
- [x] The return page checks the server-side payment state; it never treats a URL visit alone as proof of payment.
- [ ] The guest and the owner each receive one confirmation email containing dates, guests, amount paid, later balance/due date, tourist tax and contact details.
- [ ] Failed email delivery is visible to the owner and retryable without creating a duplicate booking or charge.
- [x] Signed Resend delivery callbacks are verified against the raw body, protected from replay, de-duplicated and stored as delivered, delayed, bounced, complained, failed or suppressed audit outcomes.
- [x] Concurrent webhook retries and email-delivery claims use leases so they cannot send the same notification twice while another attempt is still running.
- [x] No card details, secrets or unnecessary personal information appear in logs or public availability responses.
- [ ] Only after all the above pass, set `BOOKING_PAYMENTS_ENABLED=true` in the production environment and redeploy.

Use Stripe test mode for all pre-launch tests. Do not submit a real card payment merely to test the website.

## Website acceptance tests

- [x] All English, French and Dutch home-page links, navigation, forms and language switches work in the hosted responsive browser checks.
- [x] All activity pages load and display their current-information warnings.
- [ ] The owner reviews time-sensitive activity details and external providers immediately before launch.
- [x] Every referenced image and video loads from the hosted review deployment.
- [x] Keyboard navigation, focus visibility, labels, alternative text, headings and colour contrast pass the automated/static checks.
- [x] There are no browser console errors, mixed-content requests, missing files or broken internal anchors.
- [x] The custom 404 page is returned with HTTP 404, not 200.
- [x] Security headers, caching rules, robots.txt and sitemap.xml are correct on the hosted deployment.
- [x] Each former Wix URL returns a permanent redirect to its closest new equivalent.
- [ ] The owner reviews the final wording, prices, photographs, telephone numbers and booking availability.

## Domain and email cutover

The domain registration can remain at Wix, but authoritative DNS must move to Cloudflare Free. This is required both for the free Cloudflare production host and because Wix cannot create Resend's required MX record on the `send` subdomain. The DNS move and website launch should be separate changes: first move DNS while keeping the Wix website records, then switch the website only after all records and email have been verified.

1. Record screenshots/exports of the complete Wix DNS zone and the current Vercel production deployment.
2. Add `lasclottes.com` to a Cloudflare Free account and review Cloudflare's imported zone before changing nameservers. Add any missing records manually.
3. Confirm the Cloudflare zone contains all three Wix apex A records, the Wix `www` CNAME, every Google Workspace MX/TXT record, Google verification, and any existing DKIM/DMARC records.
4. Change only the nameservers at Wix to the exact pair assigned by Cloudflare. Do not transfer or cancel the Wix domain registration.
5. While the site still points to Wix, verify the current website and inbound/outbound email for both known Lasclottes mailboxes from more than one network.
6. Add Resend's exact DKIM TXT, `send` MX and `send` SPF TXT records in Cloudflare, verify the Resend domain, and send an isolated test message. These subdomain records do not replace Google's root-domain mail records.
7. Deploy the reviewed branch to a Cloudflare Workers staging hostname with test Stripe, test Resend and the isolated Neon branch. Run the full browser, payment, webhook and email acceptance suite there.
8. Add production-only secrets to Cloudflare, leaving `BOOKING_PAYMENTS_ENABLED` false until all owner decisions and data checks pass.
9. At least 24 hours before website cutover, lower only the website record TTLs to 300 seconds where possible.
10. Add `lasclottes.com` and `www.lasclottes.com` as Cloudflare Worker custom domains, then replace only the old Wix website A/CNAME routing. Leave all email records unchanged.
11. Verify the apex and `www` site over HTTPS from more than one network and re-test both known Lasclottes mailboxes.
12. Enable production booking payments only after the final gate. Complete one deliberately low-risk owner-approved payment, webhook and confirmation-email test, then refund it if appropriate.
13. Monitor Cloudflare errors, Stripe webhooks, booking notifications, DNS and email for at least seven days.
14. Keep the Wix site/account available as a rollback path for at least fourteen days. Do not cancel the Wix domain registration.

Cloudflare Free has no monthly hosting charge and no automatic paid overage for the Workers Free allowance. It has no service-level guarantee or priority support, so availability and usage must be monitored. The current site fits the documented Free limits: fewer than 20,000 assets, every asset under 25 MiB, and an expected booking API volume far below 100,000 requests per day.

### Recorded pre-cutover website values

- Apex Wix A records: `185.230.63.186`, `185.230.63.107`, `185.230.63.171`
- `www` Wix CNAME: `cdn1.wixdns.net`
- Wix nameservers: `ns10.wixdns.net`, `ns11.wixdns.net`

These values are a rollback record, not instructions for the Vercel configuration. Re-check live DNS immediately before any change.

## SEO handover

- [ ] Verify both domain variants in Google Search Console.
- [ ] Submit `https://lasclottes.com/sitemap.xml` after cutover.
- [ ] Inspect the home page and the principal activity pages in Search Console and request indexing where useful.
- [ ] Check that canonical URLs use the preferred HTTPS apex domain and that `www` redirects to it.
- [ ] Monitor coverage, redirects and 404s weekly during the first month.
- [ ] Update the Google Business Profile and any high-value directory links if they still point at obsolete Wix paths.

## Secret and account hygiene

- [ ] Change the Wix password that was shared during development and enable multi-factor authentication.
- [ ] Use separate named administrator accounts where Wix, Vercel, GitHub, Stripe, Neon, Resend and Google support them.
- [ ] Store production secrets only in the relevant provider/Vercel encrypted environment settings, never in Git or this file.
- [ ] Restrict access to booking/payment dashboards to the people who need it and review access at least annually.
