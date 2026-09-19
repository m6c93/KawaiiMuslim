# Mon Coran integration (11 September 2026)

## Quran classroom and presentation
The user explicitly reserves the entire platform administration, licences and
administrative reports to their own authenticated administrator account. Public
demos must expose teacher and pupil learning workflows only. Never reintroduce
an admin demo switch, including through legacy URLs or view=admin parameters.
Keep the real admin RPC authorization and MFA checks; hiding links is not access control.
Keep teacher/student improvements shared through `applications/classroom` so the
real Quran app and `presentation-coran` demonstration stay aligned. The user
explicitly requested parallel updates, not demo-only changes. The public demo at
presentation.coran.kawaiimuslimworld.com must retain fictional data and must never be connected to real classroom accounts.
Since 19 September, the user explicitly requires shareable cross-device demo
links for client presentations. An explicit share action copies local test classes
into isolated quran_demo_* tables, with expiring teacher/student capabilities.
Keep existing local trials intact; never reuse real account, licence, or chat data.
Shared demo pupils must now expire and be deleted after 48 hours. The user explicitly
chose this for ALL current pupils, including Hakim, and every future pupil. Keep
classes/teacher access separate. Re-copying a link must not reset the deadline.
Run server-side cleanup of gardens, chat threads, links and audio even when browsers
are closed; only isolated quran_demo_* data may be deleted by this job.

Classroom messaging is optional for every class, regardless of pupil age. Only a
teacher/authorized class manager enables it, during creation or from class settings.
Enabled pupils get a fourth tab, Messagerie, beside Mon jardin, Coran and Réciter.
Each conversation is private to one pupil and the teaching team; never a class chat.
Disabling preserves history. Tree appreciations remain separate and unchanged.
Real messages use quran_messaging and private audio storage; local demo messages use a separate local-only key; shared demo messages use
the isolated, expiring quran_demo session. Never put private conversations inside garden snapshots.

## Interactive garden
Mon jardin uses one evolving tree per surah. Each verse joins that tree only after
a 10-repeat sequence finishes in Coran; progress is the number of earned verses
divided by that surah's real verse count. Five transparent illustrations show the
seedling, sapling, young, blossom and completed stages. The small garden holds 12
chosen trees; every other started surah stays in the collection. Parent/child and
guided lesson completions do not grow trees. garden.mjs stores the 12 positions
under km-coran-garden-v1 and migrates the former verse-tree positions. Seven days
prompts review, eight softens colors. Nothing is deleted. A refresh requires a new
10-repeat sequence from Coran. Do not claim 114 separately generated illustrations.

User wants a polished child-friendly Mon Coran in Applications, using the
existing Aya/Mimi identity. Initial four-verse prototype was judged too basic.
Current request: the entire Quran with real Ali Al-Hudhaify recitation (user
spelling Hudayfe; clarification offered). Keep four primary choices maximum,
a signature short guided lesson, parent-child support and gentle constellation.
No punitive streaks, fabricated recitation scores, synthetic Quran audio or
invented Quran text. Preserve the existing site's other apps and access rules.

Module: applications/coran. No build step; static HTML, CSS and ES modules.
Data: 114 local JSON chapters / 6236 verified aligned verses and translation;
real reciter audio streams directly from Al Quran Cloud's CDN. Keep source
attribution, data/NOTICE.txt and sources.json, and do not modify Quran strings.
Word timing is not supplied; highlight the active verse, never invent word timing.

This is the local checkout based on m6c93/KawaiiMuslim main. Not deployed by this
task. Existing work in older local checkouts belongs to other tasks. Do not
overwrite those. Check scripts/coran-v2.test.mjs and manually verify audio and
responsive phone/tablet/desktop views for substantial changes.

## Illustrated edition
User supplied Aya/Mimi character reference and requested generated Quran-themed
illustrations and parallax inspired by kawaiimuslim.com. Two original images in
applications/coran/art show reading and listening. Keep this identity (pink hijab,
cream sweater, blue skirt; white bird in floral green scarf). Decorative parallax
must never move Quran text or controls and must respect reduced motion.
User now prefers transparent character-only illustrations, no scene backgrounds.
Use the *-transparent.png art assets; retain gentle scroll parallax.

## Reading and family features
Mon petit livre uses a full-window distraction-free layout, Escape exits; cream/night.
Passage player repeats the entire selected range, with adjustable 0–30 second gaps.
Garden flowers derive from completed verse moments (including repeats), never expire.
Parent/child turns are at lesson step 4; do not imply recording or AI assessment.
Regression tests include passage order, completion and cancellable custom silence.
User explicitly requested a dedicated Parent & enfant navigation entry below Écouter.
This supersedes the original four-entry limit; mobile navigation now has five items.

Parent & enfant is independent from Apprendre. Parents choose any surah, then each
verse follows three guided turns: the child listens to the real reciter then
repeats once, the parent does the same, then both listen and repeat together.
Only then advance to the next verse.
The together turn defaults to 3 reciter-led repetitions and offers 3, 5, 7 or 10.
Family navigation stays locked until the real reciter audio for the current turn
has finished; changing the together count resets that completion gate.

## Parent Quran validation
Mon parcours shows surah names and three states: not started, verse progress, and
validated by the parent. Activity never validates a surah automatically. Parent
validation lives in the family account and is scoped to a child profile through
quran_verse_progress and quran_surah_validations. RLS restricts both tables to the
authenticated parent who owns the child. Apply supabase/quran-parent-validation.sql
before enabling the feature in production.
