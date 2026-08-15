## 2026-08-15 task-w29-f — VOID a mis-attributed gate finding (DEC-976 wave-29 amendment)

QUALIFYING

Wave-28's gate (see `## 2026-08-15 task-w28-a` above, OPEN ITEMS: 1,
`:3883-3890`) carried exactly one surviving open item forward: "speakers
toolbar right-cluster." Re-confirmed by direct read before writing anything:

- `docs/design/README.md:343-345` heads the quoted table with **"Public
  filter bar — one idiom, four surfaces"** and states the bar is "built for
  the 820px content column of the 1180 pair layout" shared by "Sessions,
  agenda and speakers" — this is the PUBLIC surface set, not the admin
  onboarding-grid toolbar.
- `docs/design/README.md:350` is one row of that table:
  `Speakers   [Search speakers…]             [All tracks ▾]                    [List | Grid]`.
- The wave-28 gate searched `app/src/pages/speakers/GridFilters.tsx` (the
  ADMIN Speakers onboarding-grid toolbar) and correctly found no view-mode
  toggle there — but that file was never named by the quoted line. Per
  DEC-976's wave-29 amendment ("a line quoted out of its section is a rumour
  with a citation"), a citation whose quote and searched surface fall under
  different headings is VOID.
- The controls the heading actually names already exist, on the surface the
  heading names: `SpeakerViewToggle` (`List`/`Grid` two-half segmented
  control, active half `aria-current="page"`) at
  `src/routes/public/speakers.tsx:20-58`, and `TrackFacetSelect` (`All
  tracks ▾` select) at `src/routes/public/speakers.tsx:72-103`, both mounted
  on `SpeakersContent` (`:216-269`) and its gallery twin `GalleryContent`
  (`:271-348`). `q`/`trackId`/`limit` all carry forward across the toggle
  (`:32-38`).
- Verified with a new render test (not a note alone, per the amendment):
  `test/public-speakers-filter-bar.render.test.ts` renders both
  `SpeakersContent` and `GalleryContent` directly and asserts the search
  box, the `All tracks` select and the two-half `List`/`Grid` toggle are
  present, that the active half carries `aria-current="page"`, and that
  switching halves preserves an active `q`/`trackId`. 4/4 PASS.
- `app/src/pages/speakers/**` was not touched — that surface never claimed
  to carry this control (it is the admin onboarding-grid toolbar, a
  different bar entirely) and is out of scope for this clause; lane w29-d
  owns its CSS.
- `docs/eval-findings.md` updated to match: the clause is removed from TIER
  1's open-clause list (was bundled with "active-filter ink chip" /
  "underlined initials" / "blue avatars" / "Add-track tertiary" /
  "saved-embed single-card anatomy" at `:344-346`) and re-filed under TIER
  0's `DISMISSED-VERIFIED-CLOSED` list with both citations and the enclosing
  heading.

Also closed this task (w27-d's flagged gap, `:3742-3746`): `npm run
perf:seed` depends on `npm run seed` having already created the organizer
identity `perf:smoke` logs in as (read from
`docs/fixtures/sample-data.json`'s `identities.organizer`) — `perf-seed.ts`
only layers perf-scale rows on top of an already-seeded org and never
creates that user. Documented the ordered recipe (`npm run seed` ->
`npm run perf:seed[:aie]` -> `npm run dev` -> `npm run perf:smoke[:aie]` /
`gate:scale`) in both README.md ("Dev: perf smoke / scale gate — ordered
recipe," new section ahead of "Dev: scale gate") and the header comment of
`scripts/perf-smoke.ts`.

INVALIDATED BY: src/routes/public/speakers.tsx, docs/design/**
OPEN ITEMS: 0
RESULT: VOID (wave-28 gate's citation) — the "speakers toolbar right-cluster"
open item is DISMISSED-VERIFIED-CLOSED, not carried forward. perf-smoke
ordered-recipe gap also closed (docs-only, no runtime script logic changed).

