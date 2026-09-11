# Mon Coran integration (11 September 2026)

## Interactive garden
Latest request adds Mon jardin to the navigation. A tree is earned only after a
10-repeat sequence finishes in Coran, placeable on 24-slot plots; no duplicate
trees for reviews. Parent/child and guided lesson completions do not earn trees.
garden.mjs stores positions and watering separately from learning progress under
km-coran-garden-v1. Seven days prompts review, eight softens colors. No deletion.
Three original generated transparent tree illustrations yield 114 deterministic
surah variants through shape/color combinations; do not claim 114 separately
generated illustrations. The lawn is also generated. Garden-specific tests cover
all variants, positions, persistence sanitation and 7/8-day freshness boundaries.
Garden refreshes also require a new 10-repeat sequence from Coran.

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
