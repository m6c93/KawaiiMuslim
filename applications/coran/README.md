# Mon Coran · Complete Quran / V2

Native static app integrated into Applications.dc.html. No build dependency.
Preserves existing application links and membership access gate. Local preview
inherits preview=1 only on localhost. No public deployment performed here.

## Content and reciter

- 114 local chapter files, 6,236 verses, each aligned by chapter, within-chapter
  verse number and global verse number across three upstream editions.
- Arabic: quran-uthmani, Tanzil via Al Quran Cloud. Strings are stored verbatim.
  The provider includes a basmala prefix on the first verse of most chapters.
  The UI presents that exact prefix separately from the numbered verse; their
  concatenation equals the original string. Al-Fatiha and At-Tawba are unchanged.
- French translation of meaning: Muhammad Hamidullah (fr.hamidullah), attributed.
- Real reciter: Ali Al-Hudhaify (ar.hudhaify). MP3s stream on demand from Islamic
  Network; none are downloaded into the repository. Bounded fallback between
  the documented 128, 64 and 32 kbps versions of the same reciter and verse.
- Provenance, upstream SHA-256 hashes and retrieval date: data/sources.json.
  Copyright notice is in data/NOTICE.txt and every chapter's licenseNotice field.
  Regenerate with node --use-system-ca scripts/import-coran.mjs from repo root.

The CDN documentation explicitly supports app integration. Provider terms
(https://alquran.cloud/terms-and-conditions, checked 2026-09-11) retain reciter
copyrights and permit educational streaming; their commercial bundling guidance
does not transfer ownership or guarantee rights indefinitely. This app streams
only, and the present work is local. Review commercial release rights with the
provider before production use. No licence-granting emails have been sent.

## Experience

Four primary destinations: read, listen, learn, journey. The illustrated home
leads to a short session, last-read bookmark and a few beginner chapters.
All 114 chapters are searchable by transliteration, Arabic or chapter number.
Readers use 10-verse pages, direct verse jump, adjustable Arabic size, optional
French translation, favorites and real verse audio. Continuous audio advances
within the chosen chapter. A persistent player offers pause, seek, previous/next
verse, 0.75x/1x speed, stop and retry. Navigation out of a lesson stops audio.

Guided sessions contain at most one due review and one new verse, then Listen →
Repeat → Understand → Recite. Repeats: 1/3/5/10, with 4–12 second response gaps.
Saved step survives reload. Activity completion schedules review after 1/3/7/14/30
days; no missed-day penalties. The constellation lights a chapter on first
exploration, not on memorization. Reader/listener goals open those modes directly.
Parent mode offers a selected chapter divided into up to five contiguous moments,
each opening its first verse; users continue subsequent verses at their own pace.

One shared, device-local course under km-coran-progress-v2. V1 exploration and
last-read reference migrate; original key remains untouched. Invalid saved state
is sanitized and blocked storage falls back to memory. No profile/cloud syncing,
microphone recording, AI text generation or pronunciation assessment.

Audio highlights the current verse only. Word timing data is not available from
this source and is never approximated. Source copies and Arabic are not fed to
speech synthesis. Quran puzzles and automatic recitation correction remain
outside this release; they are not presented as completed features.

## Verification

Run node --test scripts/coran-v2.test.mjs. Tests cover complete corpus alignment,
state migration, search, review scheduling, parent segmentation, repeat/queue
behavior, cancellation and playback errors. Native browser QA must additionally
check actual remote playback, responsive layouts, source attributions, navigation
and long-chapter pagination. Availability depends on the external CDN; failures
remain visible with retry controls, never recorded as successful playback.
