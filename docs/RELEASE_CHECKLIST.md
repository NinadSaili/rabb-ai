# Release checklist

Mark each item `done`, `blocked (reason)` or `owner-pending`. Nothing is `done` without evidence.

## Engineering gates

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass on Node 20
- [ ] `supabase db reset` and `supabase test db` pass
- [ ] Deno function tests pass
- [ ] AI eval set passes against the real provider
- [ ] Secrets scan clean, `pnpm audit` reviewed
- [ ] Release build excludes DEV ONLY fixtures
- [ ] Every shipped translation has `license_verified_at`
- [ ] Sentry scrubbing test passes, analytics allow list test passes

## Apple

- [ ] Family Controls distribution entitlement approved for 4 bundle IDs (owner-pending)
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) with required reason API declarations
- [ ] App Privacy labels: contact info (email, optional), identifiers (user id), usage data (analytics, not linked to advertising), diagnostics. Draft only until counsel review.
- [ ] Sign in with Apple present because Google sign in is offered
- [ ] In app account deletion
- [ ] Subscription disclosures on paywall, restore purchases, terms and privacy links
- [ ] Review notes for Family Controls and a demo path
- [ ] Age rating questionnaire answers (religious content, no user generated public content, AI chat)
- [ ] TestFlight internal then external testing

## Google Play

- [ ] Data safety form: data types collected (email optional, user ids, app interactions, crash logs), selected apps not collected
- [ ] Permission declarations: usage access, display over other apps, foreground service `specialUse`
- [ ] Prominent disclosure screens screenshotted for review
- [ ] Target SDK meets the current Play requirement
- [ ] Content rating questionnaire
- [ ] Account deletion URL and in app path
- [ ] Internal testing track, then closed testing

## Store listing

- [ ] Copy describes restriction honestly: asks the user to restrict their own chosen apps, can be turned off, Android enforcement depends on device settings
- [ ] Support URL and privacy policy URL live
- [ ] Screenshots from real builds, no fabricated reviews

## Device checklist

- [ ] iOS spike table complete on a physical device
- [ ] Android spike table complete on a Pixel and a Samsung or Xiaomi
- [ ] Accessibility audit complete
- [ ] Performance budget measured
- [ ] Emergency bypass tested offline

## Beta plan

Phase 1: 10 internal testers, 1 week, Android first. Phase 2: 50 external testers, 2 weeks. Feedback capture through an in app feedback link that opens a pre filled email or form with app version and device model only. Review weekly: time to first completed ritual, permission grant rate, D1 and D7 completion, crash free sessions.
