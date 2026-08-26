# Lasclottes launch runbook

This file is the operational checklist for replacing the Wix website. It deliberately contains no passwords, API keys or other secrets.

## Current position

- The public Wix site stays live until every pre-launch gate below has passed.
- Development work is isolated on `codex/site-review-2026-08-24` and is automatically deployed to a Vercel preview.
- The domain is registered at Wix and currently uses Wix nameservers.
- Google Workspace email uses the domain's existing MX and TXT records. Those records must not be removed or replaced during the website cutover.
- Vercel Hobby is the review host only. It must not serve the commercial live site under Vercel's current non-commercial Hobby terms.
- The stable `lasclottes.vercel.app` alias formerly served an obsolete indexable March 2026 deployment with an old checkout route. On 26 August 2026 it was replaced with the current fail-closed build, given an explicit `X-Robots-Tag: noindex, nofollow, noarchive` header, and verified to return `payments_disabled` before any booking, database or Stripe work. It remains a review/quarantine alias only; `lasclottes.com` still points to Wix.
- Cloudflare Workers with Static Assets is the selected no-monthly-fee production target. The public domain will still be `lasclottes.com`. The Free zone has been prepared with the current Wix and Google Workspace records in DNS-only mode, but Cloudflare is not authoritative yet.
- A permanent Free-plan staging Worker is deployed at `https://lasclottes.super-bread-8b96.workers.dev` with encrypted test-only Stripe, Neon and Resend settings. Production online payments remain disabled; the payment switch is enabled only on the isolated Vercel Preview and Cloudflare staging environments.
- Until Resend can verify `lasclottes.com` after the DNS move, Cloudflare staging uses Resend's provider test sender and the provider account's permitted test inbox. Production remains configured conceptually for `bookings@lasclottes.com` to guests and `info@lasclottes.com` to the owner.
- A private, noindex booking-operations page is staged at `/booking-operations.html`. It lists only paid-booking email failures and can retry one email without creating a booking or charge. Booking data remains unavailable unless a separate encrypted operations key is configured and supplied.
- `npm run readiness` is the fail-closed pre-launch check. It compares the recorded owner decisions in `data/launch-approvals.json` with the actual published terms and legal pages, checks review freshness, and exits successfully only when all 15 pre-launch gates agree.
- The temporary `workers.dev` hostname sends a host-specific `X-Robots-Tag: noindex` header. That rule does not apply to the future `lasclottes.com` custom domain, so staging cannot compete with the public site in search results.

## Owner decisions required before payments are enabled

- [x] Use the owner-confirmed public name and verified operator details: Sally Spencer, a sole trader (entrepreneure individuelle) using the business name Lasclottes Holidays, registered in the French Registre national des entreprises (RNE), SIREN 521 892 992, SIRET 521 892 992 00012, Lieu-dit Las Clottes, 47140 Saint-Sylvestre-sur-Lot, France. Lasclottes Holidays is not presented as a limited company.
- [ ] Approve the booking terms, especially the cancellation outcome within 60 days of arrival.
- [x] Remove the old Wix site's unsupported EUR 1.41 flat tourist-tax estimate from the new quote. The official Fumel Vallée du Lot 2026 notice sets EUR 1.44 for a valid three-star property, while an unclassified or pending-classification property uses 5.76% of the pre-tax nightly accommodation cost per person capped at EUR 3.60. Until Sally's classification and calculation method are confirmed, the review build shows “to be confirmed” and never adds tourist tax to the GBP card charge.
- [x] Use the owner-confirmed GBP pricing rules, 20% initial payment, GBP 500 refundable damage deposit and 60-day balance deadline.
- [x] Use the website's maximum occupancy of 12 and its current five-bedroom/four-bathroom description.
- [x] Use the website's `info@lasclottes.com` inbox for new-booking notifications and `bookings@lasclottes.com` as the verified transactional sender once Resend DNS is active.
- [x] Use the currently blocked dates in `data/availability.json`: they were rechecked month by month against the live Lasclottes Wix calendar through May 2028 on 26 August 2026 and match exactly. Sally should still review any bookings or closures added after that date before launch.
- [ ] Provide the current mairie registration number for the meublé de tourisme and confirm it appears on every direct and third-party listing. Since 20 May 2026, French town halls must issue a registration number for declared tourist accommodation.
- [x] Check the owner-supplied `14004*02`: this is an older Cerfa form reference, not Lasclottes's unique mairie registration number, so it has not been published as the property number.
- [ ] Sally appoints a consumer mediator listed by the CECMC and provides its official name, postal address and website. Add those exact details to the website, booking terms and booking confirmation before accepting payment.
- [x] Confirm the operator's SIRET and RNE registration from the official French register: SIRET 521 892 992 00012, active entrepreneur individuel, tourist and other short-stay accommodation activity.
- [ ] Confirm the VAT position, whether any RCS wording is appropriate, the property's current tourist-accommodation classification and the matching 2026 tourist-tax treatment with Sally or her French accountant; then approve the complete legal notice and the presentation of GBP accommodation prices and EUR tourist tax.

The legal pages are a practical working draft, not legal advice. The accommodation owner should approve them before accepting a payment.

## Automated launch control

- Never fill an approval date or decision in `data/launch-approvals.json` speculatively. Each value must come from Sally or the named qualified adviser.
- Run `npm run readiness` after every legal or owner-review update. A red result is an intentional production stop, not a test failure to bypass.
- Run `npm run audit:deployment -- <https-url> --expect-noindex` against every Vercel or Workers staging deployment. After cutover, run the same command against `https://lasclottes.com` with `--expect-index`. It rechecks the deployed sitemap pages, internal destinations, assets, legacy redirects, security headers, private-operations protection, public availability API and real 404 response.
- The readiness command currently reports the exact outstanding owner/legal, review, acceptance and publication items in plain language. Its automated test proves both the current fail-closed state and a complete 15/15 green state.
- The separate DNS, Resend-domain, production-secret, live-payment and post-launch SEO steps below remain required even after the pre-launch readiness command turns green.

## French direct-booking compliance gates

- [ ] Publish a legal notice containing the final operator, contact, registration and hosting details required for a French professional website.
- [x] Prepare the host identification required by the legal notice from Cloudflare's official current contact information: Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA, +1 650 319 8930. Rechecked 26 August 2026; the qualified final review must still confirm its use in Sally's notice.
- [ ] Give every guest, before payment, a written seasonal-rental agreement and sufficiently detailed property description containing the specific accommodation, dates, guests, complete price and applicable conditions.
- [x] Preserve the server-generated property description, quote, exact terms text, terms version and acceptance time for each checkout, and reproduce that record in the guest confirmation. The current version remains marked as a draft until the cancellation policy is approved.
- [x] Record the owner's selection that the initial 20% payment is `arrhes` and state its reciprocal withdrawal consequences in the draft contract. Keep the legal label off ordinary marketing copy, but retain it in the agreement presented before payment. Qualified review of the exact wording is still required.
- [ ] Complete a qualified French legal/accounting review before enabling production checkout. Official starting points: [DGCCRF seasonal-rental guidance](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/location-immobiliere-saisonniere), [professional website notices](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter), and [consumer-mediation duties](https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0).

## Hosting and service gates

- [x] Sign in to the Vercel project dashboard.
- [x] In Project Settings > Git, enable Git Large File Storage (LFS), redeploy the review branch, and confirm hosted media contains real image bytes.
- [x] Provision the `lasclottes-stripe-test` Stripe sandbox for Preview and Development only. Its credentials use the `TEST_` prefix.
- [x] Provision the `lasclottes-bookings` Neon Free database in Frankfurt for Preview and Development only, with preview branching and the `BOOKINGS_` prefix.
- [x] Provision the `lasclottes-email-test` Resend Free service in Ireland for Preview and Development only, with the `TEST_EMAIL_` prefix.
- [x] Configure a Preview-only Stripe webhook and verify signed callbacks, rejected invalid signatures and retry idempotency.
- [x] Configure the Preview-only Resend delivery webhook for sent, delivered, delayed, bounced, complained, failed and suppressed events; keep its signing secret scoped to the review branch.
- [x] Keep Vercel on Hobby and restrict it to non-live review deployments; do not upgrade to Pro.
- [x] Replace the obsolete indexable `lasclottes.vercel.app` production alias with the current no-index, payments-disabled review build.
- [x] Pull the provisioned Preview environment locally into the ignored `.vercel` directory without displaying or committing secret values.
- [x] Apply the reviewed booking schema automatically to the isolated Preview database branch.
- [x] Seed the blocked-date ranges from the current public Lasclottes calendar and recheck every month through May 2028. Recheck once more immediately before launch for subsequent owner updates.
- [x] The Cloudflare Free zone has been prepared and all three Wix A records, the Wix `www` and `m` CNAMEs, and Google Workspace MX/TXT records were imported in DNS-only mode. Authoritative nameservers have not been changed; Resend verification cannot finish while Wix hosts DNS.
- [x] Authorize Wrangler for the Cloudflare account, deploy the permanent staging Worker and store all test service settings as encrypted Worker secrets.
- [x] Configure a test-only encrypted operations key on the Cloudflare staging Worker and review branch. The authenticated staging page connected to Neon successfully and reported zero current email issues; invalid or missing credentials fail closed.
- [ ] After the Cloudflare DNS zone is active, add only Resend's DKIM TXT, `send` MX and `send` SPF TXT records, then verify the domain. Keep all root Google Workspace MX, SPF and verification records unchanged.
- [ ] After Resend verifies the domain, set `info@lasclottes.com` and `bookings@lasclottes.com` in the encrypted Cloudflare production settings and remove the staging-only provider sender override.
- [x] Keep `BOOKING_PAYMENTS_ENABLED` true only in Preview for sandbox testing and absent/false in Production.
- [x] Enforce Stripe environment separation in code: review and `workers.dev` hosts accept only `sk_test_` checkout credentials and test webhook events; `lasclottes.com` and `www.lasclottes.com` accept only `sk_live_` checkout credentials and live webhook events. Stripe API requests are pinned to `2026-02-25.clover` and both Stripe and Resend requests have a 15-second timeout.

## Payment and booking acceptance tests

- [x] A quote for May, June or September enforces four nights and applies GBP 200/night for up to six guests or GBP 250/night for seven to twelve guests.
- [x] A July or August quote only accepts Saturday-to-Saturday weekly blocks at GBP 3,500/week.
- [x] October through April cannot be booked unless the owner explicitly changes the rule.
- [x] More than 60 days before arrival charges 20% of accommodation now and states the later balance and damage-deposit due date.
- [x] Within 60 days charges the full accommodation price plus the GBP 500 damage deposit.
- [x] Tourist tax remains clearly separate in EUR and is never silently added to a GBP card charge.
- [x] A hosted test checkout records the agreement version in Stripe and the isolated booking database, and the exact deployment passed the date, amount and acceptance-metadata check.
- [x] The server rejects altered browser prices, invalid dates, excessive occupancy and blocked dates.
- [x] Two simultaneous attempts for overlapping dates cannot both create payable reservations.
- [x] The public checkout rejects requests from untrusted origins, rate-limits repeated attempts without retaining raw visitor addresses, and releases the test dates after checkout expiry.
- [x] Stripe Checkout returns to the exact trusted hostname that initiated the booking, uses the guest's selected language and labels the action as “Book”.
- [x] A pending checkout hold expires and releases its dates after the documented timeout.
- [x] Stripe's successful test card marks the reservation paid exactly once, even if the webhook is retried.
- [x] Stripe declined-card and expiry flows leave the booking unconfirmed and release the dates.
- [ ] Define and test the owner-approved cancellation and refund workflow before launch.
- [x] Record partial and full Stripe refund events for audit without automatically cancelling the booking or releasing its dates.
- [x] The return page checks the server-side payment state; it never treats a URL visit alone as proof of payment.
- [x] On Cloudflare staging, the guest and owner confirmation paths each send exactly one message containing dates, guests, amount paid, later balance/due date, tourist tax and contact details. The test payment, both delivery webhooks and the full test refund were verified, then the test dates were released.
- [ ] Complete the final failed-email recovery acceptance test: the authenticated operations page, delivery-failure listing, retry limits, generation-specific Resend idempotency and charge/booking isolation are implemented and tested, but deliberately triggering the final external retry email still requires action-time confirmation. Create a separate production operations key and give it to Sally through a secure channel before launch.
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
- [x] The permanent Cloudflare staging Worker passed HTTPS page, language, activity, redirect, 404, security-header, gallery, video, responsive review, booking, Stripe test payment/refund, Neon agreement and signed Resend/Stripe webhook checks on Cloudflare's real network.
- [x] A hosted crawler rechecked all 15 sitemap pages, 21 unique internal destinations and 13 former-Wix redirects on 25 August 2026: all sitemap pages and internal destinations returned successfully, every redirect was permanent, and the custom missing-page response remained a real HTTP 404.
- [x] The English, French and Dutch home pages each expose parseable `LodgingBusiness` structured data for the current accommodation, with a stable identity, operator registration, verified public listing, capacity and amenities. The incomplete, ineligible `VacationRental` rich-result markup was removed.
- [x] Lighthouse on the final Cloudflare staging build scored 90 performance, 100 accessibility and 100 best practices on simulated mobile, and 100/100/100 on desktop. The only failed SEO audit is the intentional staging-only `noindex`; every other audited SEO check passes.
- [x] The Cloudflare Worker explicitly consumes its own runtime bindings; a temporary deployment recognized the payment switch and still failed closed when the required secrets were absent.
- [x] Full-screen gallery links use web-sized images and the 100-second walkthrough uses a 640x360 web copy instead of downloading 5–24 MiB originals.
- [x] Typography and photographs are self-hosted, and Google Maps makes no request until a visitor explicitly chooses to load it; this is checked in English, French, Dutch, desktop and mobile layouts.
- [x] Booking forms submit only to the same-origin booking API; the obsolete third-party form fallback was removed and checkout remains disabled if the booking script does not initialize.
- [x] Optional guest messages are limited, server-normalized, stored with the booking and safely included in both guest and owner confirmation emails.
- [x] English, French and Dutch price tables use GBP consistently, omit obsolete crossed-out rates and are regression-checked against the server and browser quote rules.
- [x] Executable JavaScript is served from local files and the production content-security policy no longer permits inline scripts.
- [x] Draft booking terms are visibly marked, carry `noindex` and stay out of the sitemap until the approved final version replaces them.
- [x] Keyboard navigation, focus visibility, labels, alternative text, headings and colour contrast pass the automated/static checks.
- [x] There are no browser console errors, mixed-content requests, missing files or broken internal anchors.
- [x] The custom 404 page is returned with HTTP 404, not 200.
- [x] Security headers, caching rules, robots.txt and sitemap.xml are correct on the hosted deployment.
- [x] Each former Wix URL returns a permanent redirect to its closest new equivalent.
- [x] Production and development dependency audits report no known vulnerabilities.
- [ ] The owner reviews the final wording, prices, photographs, telephone numbers and any booking-calendar changes made after 26 August 2026.

## Domain and email cutover

The domain registration can remain at Wix, but authoritative DNS must move to Cloudflare Free. This is required both for the free Cloudflare production host and because Wix cannot create Resend's required MX record on the `send` subdomain. The DNS move and website launch should be separate changes: first move DNS while keeping the Wix website records, then switch the website only after all records and email have been verified.

1. Record screenshots/exports of the complete Wix DNS zone and the current Vercel production deployment.
2. Add `lasclottes.com` to a Cloudflare Free account and review Cloudflare's imported zone before changing nameservers. Add any missing records manually.
3. Confirm the Cloudflare zone contains all three Wix apex A records, the Wix `www` CNAME, every Google Workspace MX/TXT record, Google verification, and any existing DKIM/DMARC records.
4. Change only the nameservers at Wix to the exact pair assigned by Cloudflare. Do not transfer or cancel the Wix domain registration.
5. While the site still points to Wix, verify the current website and inbound/outbound email for both known Lasclottes mailboxes from more than one network.
6. Add Resend's exact DKIM TXT, `send` MX and `send` SPF TXT records in Cloudflare, verify the Resend domain, and send an isolated test message. These subdomain records do not replace Google's root-domain mail records.
7. Completed 25 August 2026: deploy the reviewed branch to the Cloudflare Workers staging hostname with test Stripe, test Resend and the isolated Neon branch, then run the full browser, payment, webhook and email acceptance suite there.
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

- [x] Pre-cutover technical SEO is complete: all indexable pages have unique titles/descriptions, HTTPS apex canonicals, social previews, reciprocal language alternates, current sitemap dates and valid current-accommodation structured data.
- [x] The Cloudflare staging hostname is protected from indexing without placing a `noindex` rule on the future public custom domain.
- [ ] Verify both domain variants in Google Search Console.
- [ ] Submit `https://lasclottes.com/sitemap.xml` after cutover.
- [ ] Inspect the home page and the principal activity pages in Search Console and request indexing where useful.
- [ ] Check that canonical URLs use the preferred HTTPS apex domain and that `www` redirects to it.
- [ ] Monitor coverage, redirects and 404s weekly during the first month.
- [ ] Update the Google Business Profile and any high-value directory links if they still point at obsolete Wix paths.

## Secret and account hygiene

- [ ] Change the Wix password that was shared during development and enable multi-factor authentication.
- [ ] Use separate named administrator accounts where Wix, Vercel, GitHub, Stripe, Neon, Resend and Google support them.
- [ ] Store production secrets only in the relevant provider/Cloudflare encrypted environment settings, never in Git or this file.
- [ ] After the live Stripe credential has been installed and verified in Cloudflare production, remove the legacy encrypted live Stripe variable from Vercel Production. It is currently unable to create checkout sessions because the Vercel production payment and terms gates are both disabled; do not delete it before confirming it is the credential intended for the Cloudflare cutover.
- [ ] Restrict access to booking/payment dashboards to the people who need it and review access at least annually.
