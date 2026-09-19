# Shared presentation trials

The public presentation can now be tried across devices without creating real accounts. On a pupil card, “Copier le lien élève” explicitly creates a remote copy of the browser’s fictional classes. Existing local data is preserved. The teacher session is remembered on that browser; “Retrouver mon espace professeur” provides its recovery link. Pupil links are scoped to one pupil. Every shared pupil expires 48 hours after server-side creation; the 19 September migration also starts a fresh 48-hour clock for all existing shared pupils, as explicitly requested. Sharing the same pupil again preserves its link and original deadline. The deadline is returned by the server and shown on the pupil card and share dialog.

## Isolation and limits

- Only `quran_demo_sessions`, `quran_demo_links` and `quran_demo_audio` hold shared trials. `quran_demo` is a separate capability-based RPC. Real profiles, licences, classes and private messages are never connected.
- Random 256-bit teacher capability; derived per-pupil capability; only hashes stored server-side. Links use fragments and no-referrer. No real authentication token is sent by this adapter.
- Pupil reads contain only its own record; pupil writes merge only placement, review/read state, requests and received recordings. Teacher validations, identity and messages cannot be forged. Revisions prevent concurrent overwrites.
- Private chat stays separate from class snapshots, teacher-enabled only, with idempotent sends and bounded read cursors. Local chat history remains in its original local store; a shared trial starts new conversations with the same class settings.
- Existing local recitations/verse-note audio are copied when available; unavailable demo audio references are omitted from the remote copy. Local originals stay intact.
- Each session supports 10 classes, up to 100 pupils/class, 2 MB learning JSON and 2 MB chat JSON. Audio: 6 MB/file, 40 MB/session, 500 MB global. Session creation bounded to 20/hour and 100 active sessions. Teacher sessions last 14 days, extended when a new pupil is added so the pupil gets its full 48 hours. Expired pupil links are denied on every RPC. `quran_demo_purge` removes expired pupils, their tree data, chat threads, links and audio while retaining classes and unexpired pupils. It also invalidates stale class revisions. `quran-demo-expiry-job.sql` runs this cleanup every minute via pg_cron, even with no browser open; physical deletion is within one scheduler interval. Local pre-sharing copies stay local and are not part of the shared account.
- No email is sent. Teacher copies the pupil link into their preferred channel. This is a demonstration, not production pupil onboarding.

## Verification

Run `node --test scripts/classroom-shared-demo.test.mjs` alongside classroom, motion, cloud and messaging tests. Run the migration followed by `scripts/classroom-shared-demo-security.sql` in one transaction ending in ROLLBACK first. This tests with the anonymous database role: pupil isolation, separate sessions, teacher-only validation/settings/invites, unread counts, idempotency, audio transfer, stale writes, expired capabilities and denial of direct table reads.

Browser QA uses two distinct capabilities against the remote service. The temporary, excluded `qa-shared.html` uses actual MediaRecorder with an oscillator input to verify recording/upload/teacher playback without accessing the user's microphone.

## Expiry verification

`scripts/classroom-demo-expiry.sql`, in a rolled-back transaction, verifies exact 48-hour creation deadlines, tamper-resistant lifetimes, unchanged deadlines on re-sharing, new pupils created later, targeted cleanup, deletion of links/messages/audio, stale revision invalidation and no anonymous direct cleanup permission. Expired clients stop playback/recording and show the expired-account screen.
