# Shared presentation trials

The public presentation can now be tried across devices without creating real accounts. On a pupil card, “Copier le lien élève” explicitly creates a remote copy of the browser’s fictional classes. Existing local data is preserved. The teacher session is remembered on that browser; “Retrouver mon espace professeur” provides its recovery link. Pupil links are scoped to one pupil and expire with the session after 14 days. Sharing the same pupil again preserves its link.

## Isolation and limits

- Only `quran_demo_sessions`, `quran_demo_links` and `quran_demo_audio` hold shared trials. `quran_demo` is a separate capability-based RPC. Real profiles, licences, classes and private messages are never connected.
- Random 256-bit teacher capability; derived per-pupil capability; only hashes stored server-side. Links use fragments and no-referrer. No real authentication token is sent by this adapter.
- Pupil reads contain only its own record; pupil writes merge only placement, review/read state, requests and received recordings. Teacher validations, identity and messages cannot be forged. Revisions prevent concurrent overwrites.
- Private chat stays separate from class snapshots, teacher-enabled only, with idempotent sends and bounded read cursors. Local chat history remains in its original local store; a shared trial starts new conversations with the same class settings.
- Existing local recitations/verse-note audio are copied when available; unavailable demo audio references are omitted from the remote copy. Local originals stay intact.
- Each session supports 10 classes, up to 100 pupils/class, 2 MB learning JSON and 2 MB chat JSON. Audio: 6 MB/file, 40 MB/session, 500 MB global. Session creation bounded to 20/hour and 100 active sessions. Expired sessions are denied immediately; new session creation cleans expired rows and audio via cascade.
- No email is sent. Teacher copies the pupil link into their preferred channel. This is a demonstration, not production pupil onboarding.

## Verification

Run `node --test scripts/classroom-shared-demo.test.mjs` alongside classroom, motion, cloud and messaging tests. Run the migration followed by `scripts/classroom-shared-demo-security.sql` in one transaction ending in ROLLBACK first. This tests with the anonymous database role: pupil isolation, separate sessions, teacher-only validation/settings/invites, unread counts, idempotency, audio transfer, stale writes, expired capabilities and denial of direct table reads.

Browser QA uses two distinct capabilities against the remote service. The temporary, excluded `qa-shared.html` uses actual MediaRecorder with an oscillator input to verify recording/upload/teacher playback without accessing the user's microphone.
