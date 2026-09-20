# Invitation-only Quran onboarding — server migration applied; frontend release pending

## Behaviour
- Creating a real organization automatically prepares an owner invitation and sends an activation email. Its licence remains controlled by the administrator.
- Existing accounts receive a one-use login proof; new accounts choose their password after email proof verification. Proofs go only to the recipient, never to the inviter/API response/logs.
- Invitations for school teachers and real pupils also send email. Demo capabilities remain independent and do not send email.
- An already-open administrator session no longer silently determines the recipient account. Explicit activation switches to the emailed identity.
- Generic Coran registration and self-service organization provisioning are removed. Family-site Supabase signup remains unchanged.
- Admin can resend; an email-provider acceptance is reported as sent, not delivered.

## Deployment prerequisites (still outstanding)
1. User authorization received. Existing server key stored as a non-revealable Production secret in Vercel. No key in files, repository or outputs. Brevo configuration retained.
2. Apply `supabase/quran-invitation-onboarding.sql` after existing Quran migrations. Production function anchors and UUID helper were read-only checked successfully. Migration applied successfully. Transaction-rolled-back tests passed: self-signup denied, trusted recipient, rate limit, delivery status privilege, destination, replay rejection, wrong email rejection, anonymous info minimality and delivery denial, expiry. No fixture data persisted.
3. Release targeted files from current remote main, preserving newer unrelated work. `classroom.mjs` contains preexisting unpublished Moushaf changes: apply ONLY the invite import/dialog changes to remote main, never upload the whole local file.
4. Deploy API, auth pages, shared invitation helper, real admin/school/classroom invite UI, Vercel API route together.
5. Verify one authorized test invitation through the real mail provider and actual database, plus expiry, wrong-session, role isolation and existing-password preservation. Never claim delivered before delivery evidence.

## Completed tests
- `node --test scripts/quran-invitation.test.cjs`: 7 mocked API tests (recipient cannot be overridden; origins/permission failures; no secret in response; existing-user preservation; provider failure; missing secrets fail closed).
- `scripts/quran-invitation.browser-check.cjs`: 6 isolated mocked browser scenarios, including password mismatch and correct organization redirect, phone overflow check.
- `scripts/classroom-auth-loading.browser-check.cjs` with local overrides: existing delayed-JavaScript credential protection and 390/820 px layout checks pass.
- JS syntax checks for changed API, activation, school, classroom and administration modules pass.

No actual invitation was sent and no account was created during automated tests. Production invitation migration and server secret are configured; billing and global family-site Auth settings are unchanged.
