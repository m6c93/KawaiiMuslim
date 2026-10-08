# Account deletion: deployment and manual processing

This is a request for permanent erasure, not deactivation. No production account
is deleted by the migration, the parent UI, the admin queue, or the tests.
Reference: https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion

## Enable before App Store submission

1. Apply `supabase/migrations/20261008123000_account_deletion_requests.sql`
   after the existing account schema, first on an isolated Supabase test project.
   Deploy the frontend from this same commit. No Edge Function or new secret is needed.
2. Keep Supabase Auth password attempt rate limits enabled. Only email/password
   registration currently exists. Reassess this flow before adding OAuth/Apple login;
   Apple login also requires server-side token revocation.
3. Assign an administrator to check **Admin → Support client → Demandes de
   suppression du compte** every working day, with a replacement for absences.
   This queue requires an active admin and MFA on the server, not only in the UI.
   Do not enable the flow without staffing this queue. Process within 30 days.
4. On test accounts only, verify the signed Supabase `amr` password event and MFA
   flow. Test a subscriber and a nonsubscriber, iPhone and iPad WebViews, wrong
   password, cancelled form, reload, expired session and request retry. Submission
   notes should give the path **Mon compte → Supprimer mon compte**, confirmation,
   password, optional MFA, receipt and manual deadline.

## Processing a verified request

The request's `user_id` comes exclusively from `auth.uid()` in a signed session
with a password event no older than five minutes. No parent can name a different
target or insert/update the queue directly. A duplicate returns the original
receipt and deadline. Do not ask for another email, ID document or password.

Use a protected operator workstation and Supabase service access, never browser
keys. Take the target from the queue UUID. Review a read-only manifest before any
deletion: user UUID, child UUIDs, exact owned record IDs and storage paths,
payment references, and external dependencies. Compare with the live database
catalog: repository SQL does not prove which migrations exist in production.
Stop on unknown dependencies; expand the manifest rather than disabling foreign
keys or deleting another family's data. Do not export names, religious progress
or drawings into a general log. Mark `status = 'processing'` with service access
without changing `requested_at`/`due_at`; errors must leave the request open.

1. **Billing first.** Identify all Stripe subscriptions for the target customer,
   including active, trialing, past-due and incomplete subscriptions. Stop them
   immediately so no future renewal can occur, reconcile scheduled invoices,
   and verify the provider result. Do not rely on the single locally stored
   subscription ID. This operation is separate from a refund. For Apple purchases,
   the parent receives the Apple cancellation link in the UI; erasure must not
   wait for cancellation or the end of the paid period. If Apple login is added,
   revoke its tokens before completing erasure.
2. **Retained records.** Document the specific legal basis, record category,
   minimum fields, restricted custodian and expiration for any required invoice,
   accounting record or litigation evidence. Keep those records separately from
   the app, with their provider/authorized accounting archive. No blanket
   retention of a parent profile, children's progress or drawings. Do not copy
   the account into a 'legal archive' by default. Remove unnecessary Stripe
   customer metadata/contact details, subject to actual billing obligations.
3. **Files before cascading records.** Inventory `child-artworks` objects under
   the exact `user UUID/` prefix, plus every image path referenced by the owned
   artwork rows. Remove them using the Storage API (paginate and verify empty),
   not SQL against `storage.objects`. Never delete a whole bucket. For any school
   recordings/messages, resolve the exact class/student paths from the manifest;
   do not use a broad class prefix. Remove support attachments and other uploaded
   personal files with the same scoped procedure. A storage failure is not success.
4. **Family data.** The repository declares `ON DELETE CASCADE` for profiles,
   child_profiles, planner_days, reading_progress, quran_verse_progress,
   quran_surah_validations, child_artworks, star wallets/transactions/rewards,
   subscriptions and support_tickets. Verify these constraints in the live schema.
   They remove database rows, not storage files or third-party data.
5. **Noncascading/shared records.** Inventory Quran platform student entries
   linked by `profile_id`, invitations (including email/token), organization
   memberships, personal garden snapshots, recordings, messages and read state.
   Remove target-linked personal records/files and contributions without deleting
   other pupils/classes. `SET NULL` on `quran_platform_students.profile_id` alone
   would leave the pupil's name and garden. `quran_direct_messages.sender_id`,
   `quran_audit.actor_id` and attendance `updated_by` can block deletion; remove
   the target's messages/audio and remove or anonymize other references according
   to their actual purpose. Check audit `detail` JSON for embedded personal data,
   not just actor IDs. Review newsletters/marketing contacts by the verified
   email, external support correspondence and any additional live tables.
   Administrative/shared published content must be transferred or stripped of
   personal attribution without destroying the service for other users.
6. **Authentication last.** Once external erasure and the dependency checks are
   complete, use Supabase Auth Admin `deleteUser(targetUUID, false)` for a hard
   deletion (never a soft deletion or `is_active=false`). Verify the user, family
   rows, owned files and personal shared records are gone. The request cascades
   away with the auth user. Repeated processing must tolerate already absent
   files/records and already cancelled subscriptions; resume after a partial
   failure without touching other users. Existing access tokens can remain valid
   until expiry, but must not authorize any surviving personal record; verify
   this in staging, and revoke sessions where applicable before the final step.
7. **Confirmation.** Hold the verified email only for the time needed to send the
   completion notice. State completion date, erased categories, any narrowly
   retained records and their reasons/periods, plus Apple subscription guidance.
   If sending fails, keep a protected minimal delivery task until sent, not a copy
   of the family data. Retain evidence only when justified by a concrete legal
   obligation/litigation, with expiry. Never report completion after an error.
8. **Copies.** Record the provider backup/log expiration schedules and make
   restored backups reapply erasures before reopening service. Tell the parent
   that other-device local copies require clearing KMW data on those devices.
   The receipt does not claim that submitting a request erases data instantly.

## Verification without real accounts

`npm install` then `npm run test:account-deletion` runs the migration against an
in-memory PostgreSQL database with fictional users and signed-claim fixtures.
Alternatively set `PGLITE_MODULE` to an existing PGlite `dist/index.js`. The tests never read
`km-config.js`, use production credentials, or contact production Supabase.
Browser checks use a mocked KMAuth and intercept every network request.

Run `node scripts/account-deletion.browser-check.cjs` with Playwright installed
and a Chromium browser available (`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` may
point to existing installations). It checks confirmation, cancellation, wrong
password, MFA, network failures, receipts/reloads and widths 390/820/1280.
These mocks do not replace the final Supabase staging and iOS WebView checks.
