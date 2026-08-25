# Lasclottes launch runbook

This file is the operational checklist for replacing the Wix website. It deliberately contains no passwords, API keys or other secrets.

## Current position

- The public Wix site stays live until every pre-launch gate below has passed.
- Development work is isolated on `codex/site-review-2026-08-24` and is automatically deployed to a Vercel preview.
- The domain is registered at Wix and currently uses Wix nameservers.
- Google Workspace email uses the domain's existing MX and TXT records. Those records must not be removed or replaced during the website cutover.
- Vercel Hobby is the review host only. It must not serve the commercial live site under Vercel's current non-commercial Hobby terms.
- Cloudflare Workers with Static Assets is the selected no-monthly-fee production target. The public domain will still be `lasclottes.com`. The Free zone has been prepared with the current Wix and Google Workspace records in DNS-only mode, but Cloudflare is not authoritative yet and no permanent Worker has been deployed.
- Production online payments remain disabled. The payment switch is enabled only on the isolated Preview environment for sandbox acceptance testing.

## Owner decisions required before payments are enabled

- [x] Use the verified public operator details: Sally Spencer, trading as Lasclottes / French Riverside Holidays, SIREN 521 892 992, Lieu-dit Las Clottes, 47140 Saint-Sylvestre-sur-Lot, France.
- [ ] Approve the booking terms, especially the cancellation outcome within 60 days of arrival.
- [x] Use the website's public tourist-tax figure of EUR 1.41 per adult per night; it remains separate from the GBP card charge and its collection method is confirmed with the booking.
- [x] Use the website's GBP pricing rules, 25% initial payment, GBP 500 refundable damage deposit and 60-day balance deadline.
- [x] Use the website's maximum occupancy of 12 and its current five-bedroom/four-bathroom description.
- [x] Use the website's `info@lasclottes.com` inbox for new-booking notifications and `bookings@lasclottes.com` as the verified transactional sender once Resend DNS is active.
- [ ] Confirm the currently blocked dates in `data/availability.json` against the authoritative booking diary.
- [ ] Provide the current mairie registration number for the meublé de tourisme and confirm it appears on every direct and third-party listing. Since 20 May 2026, French town halls must issue a registration number for declared tourist accommodation.
- [ ] Sally appoints a consumer mediator listed by the CECMC and provides its official name, postal address and website. Add those exact details to the website, booking terms and booking confirmation before accepting payment.
- [ ] Confirm the operator's SIRET/RCS and VAT position with Sally or her French accountant, then approve the complete legal notice and the presentation of GBP accommodation prices and EUR tourist tax.

The legal pages are a practical working draft, not legal advice. The accommodation owner should approve them before accepting a payment.

## French direct-booking compliance gates

- [ ] Publish a legal notice containing the final operator, contact, registration and hosting details required for a French professional website.
- [ ] Give every guest, before payment, a written seasonal-rental agreement and sufficiently detailed property description containing the specific accommodation, dates, guests, complete price and applicable conditions.
- [x] Preserve the server-generated property description, quote, exact terms text, terms version and acceptance time for each checkout, and reproduce that record in the guest confirmation. The current version remains marked as a draft until the cancellation policy is approved.
- [ ] State clearly whether the initial 25% payment is an `acompte` or `arrhes`; those terms have different consequences under French law. Do not use an ambiguous translation of “deposit”.
- [ ] Complete a qualified French legal/accounting review before enabling production checkout. Official starting points: [DGCCRF seasonal-rental guidance](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/location-immobiliere-saisonniere), [professional website notices](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter), and [consumer-mediation duties](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0).

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
- [ ] The Cloudflare Free zone has been prepared and all three Wix A records, the Wix `www` and `m` CNAMEs, and Google Workspace MX/TXT records were imported in DNS-only mode. Change authoritative nameservers only during the controlled DNS step; Resend verification cannot finish while Wix hosts DNS.
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
- [x] A hosted test checkout records the agreement version in Stripe and the isolated booking database, and the exact deployment passed the date, amount and acceptance-metadata check.
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
- [x] The hosted Preview Resend endpoint rejects forged signatures and accepts a valid synthetic delivery exactly once; the disposable booking, delivery and event rows were removed after verification.
- [x] Concurrent webhook retries and email-delivery claims use leases so they cannot send the same notification twice while another attempt is still running.
- [x] No card details, secrets or unnecessary personal information appear in logs or public availability responses.
- [ ] Only after all the above pass, set both `BOOKING_TERMS_APPROVED=true` and `BOOKING_PAYMENTS_ENABLED=true` in the production environment and redeploy. The live domain rejects checkout independently if the terms-approval flag is absent.

Use Stripe test mode for all pre-launch tests. Do not submit a real card payment merely to test the website.

## Website acceptance tests

- [x] All English, French and Dutch home-page links, navigation, forms and language switches work in the hosted responsive browser checks.
- [x] All activity pages load and display their current-information warnings.
- [ ] The owner reviews time-sensitive activity details and external providers immediately before launch.
- [x] Every referenced image and video loads from the hosted review deployment.
- [x] Every sitemap page has a canonical URL plus complete Open Graph and X/Twitter metadata backed by a verified local 1200x630 sharing image.
- [x] All local responsive-image candidates exist; desktop and phone layouts were rechecked after repairing the missing children's hero size.
- [x] Time-sensitive activity links were rechecked on 24 August 2026 and obsolete destinations were replaced with current official or tourism-authority pages.
- [x] A no-secret temporary Cloudflare Workers deployment passed HTTPS page, language, activity, redirect, 404, security-header, gallery and video checks on Cloudflare's real network. A permanent account deployment with test service secrets remains pending.
- [x] The Cloudflare Worker explicitly consumes its own runtime bindings; a temporary deployment recognized the payment switch and still failed closed when the required secrets were absent.
- [x] Full-screen gallery links use web-sized images and the 100-second walkthrough uses a 640x360 web copy instead of downloading 5–24 MiB originals.
- [x] Typography and photographs are self-hosted, and Google Maps makes no request until a visitor explicitly chooses to load it; this is checked in English, French, Dutch, desktop and mobile layouts.
- [x] Booking forms submit only to the same-origin booking API; the obsolete third-party form fallback was removed and checkout remains disabled if the booking script does not initialize.
- [x] Optional guest messages are limited, server-normalized, stored with the booking and safely included in both guest and owner confirmation emails.
- [x] English, French and Dutch price tables use GBP consistently, omit obsolete crossed-out rates and are regression-checked against the server and browser quote rules.
- [x] Executable JavaScript is served from local files and the production content-security policy no longer permits inline scripts.
- [x] Keyboard navigation, focus visibility, labels, alternative text, headings and colour contrast pass the automated/static checks.
- [x] There are no browser console errors, mixed-content requests, missing files or broken internal anchors.
- [x] The custom 404 page is returned with HTTP 404, not 200.
- [x] Security headers, caching rules, robots.txt and sitemap.xml are correct on the hosted deployment.
- [x] Each former Wix URL returns a permanent redirect to its closest new equivalent.
- [x] Production and development dependency audits report no known vulnerabilities.
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
8. Add production-only secrets to Cloudflare, leaving `BOOKING_PAYMENTS_ENABLED` and `BOOKING_TERMS_APPROVED` false until all owner decisions and data checks pass.
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
