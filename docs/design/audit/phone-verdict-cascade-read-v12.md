# Phone-verdict cascade-read lens (v12)

Derived by `app/src/phone-verdict-cascade-read.scan.test.ts` (DEC-808
wave-12, task w12-xf). This document is the human-readable snapshot of what
that scan measures on this branch; the scan itself is the source of truth
and will drift from this file the moment the pack, the test suite, or a
cluster's own cascade changes. Re-run the scan (or re-derive with the method
below) before trusting any number here past the commit that introduced it.

## Why this exists

jsdom evaluates **no** `@media` block. A 390-frame render-verdict test that
only ever reads the rendered DOM -- never a stylesheet's text -- is
therefore not really a claim about the *phone* frame at all: it is a claim
about the un-cascaded *desktop* DOM, wearing a phone frame's title. When a
cluster's terminal `@media (max-width: 700px)` block reorders, hides, or
stacks a desktop table into the exact card its v12 phone frame draws, a
verdict file that never reads that block cannot see the fix -- it keeps
passing (or keeps failing) exactly as it did before the CSS landed, because
its own assertions never depended on the cascade in the first place.

Wave-12 planning found three live instances of this: `Submissions
.frame-verdicts.render.test.tsx` (`:137`), `Contacts.frame-verdicts
.render.test.tsx` (`:179`) and `Content.frame-verdicts.render.test.tsx`
(`:198`/`:373`) each PASS while asserting divergences their own cluster's
terminal phone `@media` block had already closed. No existing ratchet could
see this: `test/campaign-ratchet-two-sided.scan.test.ts` only checks
constants already registered in `CAMPAIGN_CONSTANT_NAMES`/
`TIER2_CEILING_NAMES` -- nothing upstream of that ever asked whether a phone
verdict file consulted the cascade at all. This ledger is that instrument.

## Population, derived

`readdirSync('app/src/pages', { recursive: true })` (never a hand-listed
list -- DEC-180/DEC-808 doctrine) for every `.tsx`/`.ts` file whose BASENAME
matches `frame-verdicts` or `frame390` and does **not** contain `desktop`.
The desktop half of this ledger (e.g.
`Review-reviewer.desktop-frame-verdicts.render.test.tsx`) is excluded by
construction: a desktop verdict is *supposed* to never read a stylesheet --
that is what makes it a desktop verdict, not an offender of this lens.

**Members: 25.**

## Predicate

A member is an OFFENDER when its own source text never reads a stylesheet
at all: no `readFileSync` call whose string argument's path ends `.css`, and
no `.css'`/`.css"` string literal anywhere in the file. Both shapes collapse
to one substring test (`/\.css['"]/`) -- any `readFileSync(...'foo.css')`
call already contains `.css'` as a substring of its own argument, so this is
one predicate phrased once, not two maintained in parallel (DEC-613).

**Offenders: 12**, each reported as
`<relpath> -- cites <N> 390-frame lines, reads no stylesheet` (the citation
count reuses `test/phone-frame-ledger.scan.test.ts`'s own
`docs/design/<Frame>.dc.html:<line[,line...]>` grammar verbatim):

| File | 390-frame lines cited |
|---|---|
| `app/src/pages/Agenda.frame-verdicts.render.test.tsx` | 3 |
| `app/src/pages/Comms.frame-verdicts.render.test.tsx` | 0 |
| `app/src/pages/Comms.frame390.render.test.tsx` | 0 |
| `app/src/pages/Contacts.frame-verdicts.render.test.tsx` | 7 |
| `app/src/pages/Content.frame-verdicts.render.test.tsx` | 0 |
| `app/src/pages/Speakers.frame-verdicts.render.test.tsx` | 6 |
| `app/src/pages/content/DeliverableDetail.frame390.render.test.tsx` | 2 |
| `app/src/pages/content/FilesLibrary.frame390.render.test.tsx` | 1 |
| `app/src/pages/overview/Overview.frame390.render.test.tsx` | 2 |
| `app/src/pages/review/PlanEditor.frame390.render.test.tsx` | 1 |
| `app/src/pages/settings/CallForPapersPanel.frame390.render.test.tsx` | 6 |
| `app/src/pages/submissions/Submissions.frame390.render.test.tsx` | 6 |

A `0` in the "lines cited" column (`Comms.frame-verdicts`, `Comms.frame390`,
`Content.frame-verdicts`) means that file's own frame citations do not
happen to match the strict `docs/design/<Frame>.dc.html:<line>` grammar
inline (e.g. they cite the design file once in a header comment, then list
`:NNN 'Title'` pairs separately) -- the count is a diagnostic aid printed on
the offender line, not an input to the ratchet's pass/fail decision, so this
undercounts nothing the ratchet itself grades.

Note: `Submissions.frame-verdicts.render.test.tsx`,
`Contacts.frame390.render.test.tsx` (`ContactDrawer`/`ImportWizard`/
`MergePage`/`PipelineBoard`), `Agenda`'s `PhoneAgenda.frame390`,
`Scorecard.frame390`, `SettingsPanels.frame390`, `Speakers.frame390`,
`CommsDrill.frame390`, and `Overview.frame-verdicts`/`Review.frame-verdicts`
already read a stylesheet and are **not** offenders -- 13 of the 25 members
already consult the cascade.

## Ratchet

Two-sided (DEC-808 wave-85 protocol), keyed on
`PHONE_VERDICT_CASCADE_BLIND_CEILING` in
`app/src/phone-verdict-cascade-read.scan.test.ts`: one assertion that
offenders never exceed the ceiling (may only be LOWERED), and a companion
that fails when the measured count drops below it, printing the exact
replacement line. Registered in `scripts/exit-predicate.ts`'s
`CAMPAIGN_CONSTANT_NAMES` and `TIER2_CEILING_NAMES`, and mirrored in
`test/exit-predicate-campaign.test.ts`'s derived `baseFixture()` corpus (via
`CAMPAIGN_CONSTANT_NAMES` iteration, so it cannot rot the way a hand-typed
fixture row has four times before).

Seeded at **12** (this branch's own measurement). Sibling wave-12 lanes
w12-xa/xb/xc/xe are adding cascade reads to four of these twelve files in
the same merge batch -- the companion assertion is *expected* to fire once
they land, and its printed line is exactly how the next lane lowers the
ceiling to match.

## Method (to re-derive)

1. `readdirSync('app/src/pages', { recursive: true })`, filter to
   `.tsx`/`.ts` files whose basename matches `/frame-verdicts|frame390/` and
   not `/desktop/i`.
2. For each member, `readFileSync` its own source and test
   `/\.css['"]/` against it. No match ⇒ offender.
3. Count offenders; set `PHONE_VERDICT_CASCADE_BLIND_CEILING` to that
   number if it fell (never raise it to paper over a regression).
