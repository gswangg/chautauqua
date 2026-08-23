# Pack drawn column-track vocabulary (DEC-896 wave-48)

Instrument: `test/pack-grid-track-vocabulary.scan.test.ts`. MEASUREMENT AND
INSTRUMENT ONLY — this doc and its instrument move no CSS byte; desktop
stays frozen.

## What this grades

Every `grid-template-columns:` declaration drawn inside a REACHABLE desktop
frame in `docs/design/*.dc.html` (the same label/extent walk, EXPLAINER
exclusion list and DEVIATIONS-Section-6 derivation `test/desktop-frame-ledger.scan.test.ts`
already uses, ported rather than imported — sibling-owned file) is compared,
after normalisation, against every `grid-template-columns:` declaration in
the non-test product corpus (`app/src/**/*.css`, `app/src/**/*.ts(x)`,
`src/**/*.ts(x)`, which is also every `src/**/*.css.ts` file). Both sides
collapse whitespace, rewrite `minmax(0, X)` to `X`, and resolve a value that
is exactly a `var(--x)` reference against `--x`'s own top-level (non-`@media`)
declaration before comparing.

## Live ratchet value

`PACK_GRID_TRACK_UNMATCHED_CEILING = 72`.

## Vacuous-population tripwire

The pack draws exactly `201` `grid-template-columns:` declarations across
`docs/design/*.dc.html`. Every one of them falls inside some `font-size:19px`
labelled extent (none sit before the first label or past a file's own
`</x-dc>` close). Of those, `72` drawn track lists, resolved to their owning
REACHABLE (desktop, non-explainer, non-deviation-deferred) frame label, have
no normalised match anywhere in the product corpus.

## Wave 52: Review + Overview adjudication

Task w52-e adjudicated the 22 rows whose Frame file column is
`docs/design/Chautauqua Review.dc.html` (12 rows) or
`docs/design/Chautauqua Overview.dc.html` (10 rows). DOCS ONLY --
`PACK_GRID_TRACK_UNMATCHED_CEILING` stays at `72`; no CSS byte moved.
Branch `v12m-w51-g` is adjudicating this same table's Comms and Contacts
rows in parallel, over disjoint rows -- the ceiling is deliberately left
untouched here because two lanes are still draining it.

Tallies for these 22 rows, by frame: Overview's 10 rows split **8 INSTRUMENT
ARTEFACT** (the "States · hover, pending, drag" B8 explainer's Buttons/
Rows-and-cells/Motion demo grids at :493/:534-:553/:662 -- illustrative
comparison tables, no owning product element) + **2 UNSERVED** (the
"Loading · the first paint" skeleton grid at :714/:718, which mocks the
Submissions page's loading state but the shipped skeleton is built with
flexbox, never a `grid-template-columns` declaration). Review's 12 rows
split **10 UNSERVED** (the 5 "Organiser view" results-table rows at
:124/:128/:143/:147/:160, the 2 Plan-editor Choice-options wrapper rows at
:508/:755, the 2 per-option rows at :516/:763, and the 1 distribute-preview
row at :558 -- each a real product element that serves the same columns
through a different CSS mechanism, an HTML `<table>` with
`table-layout:fixed` or a `display:flex` row, never the frame's own
`grid-template-columns`) + **2 DESKTOP DIVERGENCE** (the "Your plans" row
at :848/:852, already HAND-VERIFIED in DEC-896's wave-48 amendment; this
wave only filled in the Verdict column). Overall: 12 UNSERVED, 8 INSTRUMENT
ARTEFACT, 2 DESKTOP DIVERGENCE, 0 MATCHED-VIA-VAR. Every verdict cell above
carries a `DEC-896` tag and a citation, per DEC-099's wave-52 finding that
a bare verdict token with no citation reddens `OPEN_DIVERGENCE_CEILING`.

## Offender table

Bare-path-plus-backtick-quote citations only (`test/citation-form-drift.scan.test.ts`
is ceiling-0) — a `path:line` form is used ONLY for `docs/design/*.dc.html`
citations, which sit outside the app/src, src, test, scripts, migrations
population that scan grades.

Two rows are HAND-VERIFIED (the two rows named in DEC-896's wave-48
amendment); every other row's "nearest shipped value" is left unadjudicated
this wave — this instrument measures divergence, it does not guess a
correspondence a human has not confirmed.

| Frame file | Frame label | Drawn value | Nearest shipped value | Verdict |
| --- | --- | --- | --- | --- |
| `docs/design/Chautauqua Agenda.dc.html:75` | Day grid · 1600 | `62px repeat(4, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:157` | Compose · step 3 of 4 · 1600 | `150px 1fr 130px 150px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:424` | Compose · step 1 of 4 | `26px 1fr 170px 130px 118px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:428` | Compose · step 1 of 4 | `26px 1fr 170px 130px 118px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:634` | Comms · history | `150px 1fr 108px 150px 88px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:639` | Comms · history | `150px 1fr 108px 150px 88px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:649` | Comms · history | `150px 1fr 108px 150px 88px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:653` | Comms · history | `150px 1fr 108px 150px 88px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:664` | Comms · history | `150px 1fr 108px 150px 88px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:773` | Compose · send blocked | `1fr 190px 150px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Comms.dc.html:777` | Compose · send blocked | `1fr 190px 150px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:97` | Directory · 1600 | `26px 1fr 130px 118px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:101` | Directory · 1600 | `26px 1fr 130px 118px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:130` | Directory · 1600 | `1fr 44px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:292` | Import CSV · step 2 of 3 | `1fr 26px 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:366` | Duplicates · merge | `132px 1fr 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:379` | Duplicates · merge | `132px 1fr 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:690` | Import CSV · step 3 of 3 | `190px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Contacts.dc.html:792` | Import CSV · the file will not do | `64px 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:81` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:85` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:146` | Session deliverables · /content/:submissionId | `52px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:311` | Files library | `1fr 190px 108px 92px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Content.dc.html:315` | Files library | `1fr 190px 108px 92px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:493` | States · hover, pending, drag | `150px repeat(4, 1fr)` | INSTRUMENT ARTEFACT (DEC-896, wave 52): the B8 interaction-states explainer's Buttons demo table (Tier/Rest/Live/Pressed/Disabled columns) -- illustrates hover/press/disabled states generically, no product element renders this comparison grid; `grep -rn "150px repeat" app/src` is empty. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:534` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): the same B8 explainer's Rows-and-cells demo (Rank/Submission/Score/Reviews header/row/expanded/hover states) -- a reduced illustrative table, distinct from the real Submissions triage grid (`app/src/pages/submissions/submissions.css`'s 9-track `28px 74px 1fr 150px 130px 108px 92px 118px 64px`); `grep -rn "44px 1fr 92px 84px" app/src` is empty. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:537` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): same Rows-and-cells B8 explainer demo as :534, no owning product element. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:540` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): same Rows-and-cells B8 explainer demo as :534, no owning product element. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:543` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): same Rows-and-cells B8 explainer demo as :534, no owning product element. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:547` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): same Rows-and-cells B8 explainer demo as :534, no owning product element. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:553` | States · hover, pending, drag | `44px 1fr 92px 84px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): same Rows-and-cells B8 explainer demo as :534, no owning product element. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:662` | States · hover, pending, drag | `110px 1fr 220px` | INSTRUMENT ARTEFACT (DEC-896, wave 52): the same B8 explainer's Motion section (Duration/Used for/Easing reference table for the motion tokens) -- documentation chrome, not a product screen; `grep -rn "110px 1fr 220px" app/src` is empty. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Overview.dc.html:714` | Loading · the first paint | `74px 1fr 150px 108px 92px` | UNSERVED (DEC-896, wave 52): the frame mocks the Submissions page's loading skeleton as a CSS grid (Ref/Title/Speakers/Status/Sent); the shipped skeleton (`app/src/components/page-skeleton.css`'s `.chq-skeleton-row`/`.chq-skeleton-row-table`/`.chq-skeleton-bar-ref` etc) is `display:flex` with per-bar percentage widths, never a grid-template-columns declaration -- this exact track list is never built. | UNSERVED |
| `docs/design/Chautauqua Overview.dc.html:718` | Loading · the first paint | `74px 1fr 150px 108px 92px` | UNSERVED (DEC-896, wave 52): same Loading skeleton row as :714 -- `app/src/components/page-skeleton.css` builds it with flexbox, never this grid. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:67` | Sessions and agenda · 1600 | `126px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:150` | Agenda · 1600 | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:172` | Agenda · 1600 | `88px minmax(0, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:267` | Agenda · a track highlighted | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:290` | Agenda · a track highlighted | `88px minmax(0, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:813` | My schedule · /e/:slug/schedule | `126px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1415` | Portal · Edit your session · desktop | `1fr 130px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:1443` | Portal · Edit your session · desktop | `1fr 190px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:124` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | UNSERVED (DEC-896, wave 52): the frame's "Wave 1 results · ranked" head/row/expanded-head/expanded-row/footer all draw this grid, but the shipped table (`app/src/pages/review/review.css`'s `.chq-review-results-table`, DEC-902 wave-21 amendment) renders as a real HTML table with table-layout:fixed and per-column width classes (`.chq-review-results-col-rank` etc) instead of CSS Grid -- the columns are served, the grid-template-columns declaration is not. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:128` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | UNSERVED (DEC-896, wave 52): same results table as :124 -- `.chq-review-results-table` (`app/src/pages/review/review.css`, DEC-902) renders via an HTML table, not grid-template-columns. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:143` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | UNSERVED (DEC-896, wave 52): same results table as :124 -- `.chq-review-results-table` (`app/src/pages/review/review.css`, DEC-902) renders via an HTML table, not grid-template-columns. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:147` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | UNSERVED (DEC-896, wave 52): same results table as :124 -- `.chq-review-results-table` (`app/src/pages/review/review.css`, DEC-902) renders via an HTML table, not grid-template-columns. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:160` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | UNSERVED (DEC-896, wave 52): same results table as :124 -- `.chq-review-results-table` (`app/src/pages/review/review.css`, DEC-902) renders via an HTML table, not grid-template-columns. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:508` | Plan editor · /review/plans/:id | `20px 1fr` | UNSERVED (DEC-896, wave 52): the frame's Choice-criterion options wrapper row; shipped as `.chq-review-criterion-options` (`app/src/pages/review/review.css`, DEC-650) which spans grid-column:2/-2 inside the criterion row's own six-track grid rather than opening its own `20px 1fr` grid. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:516` | Plan editor · /review/plans/:id | `20px 1fr auto` | UNSERVED (DEC-896, wave 52): the frame's per-option row (drag handle/label/Remove); shipped as `.chq-review-criterion-option-row` (`app/src/pages/review/review.css`) which is display:flex, not a grid. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:558` | Plan editor · /review/plans/:id | `1fr 120px 150px` | UNSERVED (DEC-896, wave 52): the "This would assign N reviews" distribute preview; shipped as `.chq-review-distribute-table` (`app/src/pages/review/review.css`, DEC-745 wave-21 amendment, DEC-902 idiom) as a real HTML table with table-layout:fixed and per-column width classes, not grid-template-columns. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:755` | New plan · /review/plans/new | `20px 1fr` | UNSERVED (DEC-896, wave 52): same PlanEditor Choice-options wrapper as :508 -- New plan reuses `.chq-review-criterion-options` (flex + grid-column span), never its own `20px 1fr` grid. | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:763` | New plan · /review/plans/new | `20px 1fr auto` | UNSERVED (DEC-896, wave 52): same PlanEditor per-option row as :516 -- New plan reuses `.chq-review-criterion-option-row` (display:flex). | UNSERVED |
| `docs/design/Chautauqua Review.dc.html:848` | Your plans · /review | `1fr 150px 190px auto` | DESKTOP DIVERGENCE (DEC-896, wave 52): `app/src/pages/review/review.css`'s `.chq-review-plan-row` declares `1fr 150px 190px 210px auto` -- an extra 210px track (HAND-VERIFIED, DEC-896 wave-48; verdict column filled wave 52). | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Review.dc.html:852` | Your plans · /review | `1fr 150px 190px auto` | DESKTOP DIVERGENCE (DEC-896, wave 52): same `.chq-review-plan-row` divergence as :848 -- `app/src/pages/review/review.css` declares `1fr 150px 190px 210px auto`, an extra 210px track. | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Settings.dc.html:134` | Event, form, publishing, data · 1600 | `170px 1fr 124px 82px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:150` | Event, form, publishing, data · 1600 | `1fr 128px 96px 190px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:157` | Event, form, publishing, data · 1600 | `34px 66px 62px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:220` | Event, form, publishing, data · 1600 | `1fr 190px 150px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:825` | Settings · editing tracks and rooms | `20px 1fr 150px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:844` | Settings · editing tracks and rooms | `20px 1fr 110px 150px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:928` | Settings · editing the speaker portal | `1fr 170px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:986` | Settings · editing people and roles | `1fr 170px 190px auto` | `app/src/pages/settings/settings.css`'s `--chq-people-grid` resolves to `1fr 170px 190px 200px` — last track 200px where the frame draws `auto` (HAND-VERIFIED, DEC-896 wave-48) | UNMATCHED |
| `docs/design/Chautauqua Settings.dc.html:990` | Settings · editing people and roles | `1fr 170px 190px auto` | `app/src/pages/settings/settings.css`'s `--chq-people-grid` resolves to `1fr 170px 190px 200px` — last track 200px where the frame draws `auto` (HAND-VERIFIED, DEC-896 wave-48) | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:76` | Onboarding grid · 1600 | `230px repeat(6, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:90` | Onboarding grid · 1600 | `230px repeat(6, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:364` | Speaker detail · /admin/speakers/:contactId | `1fr 150px 130px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:578` | Speakers · a write failed | `230px repeat(3, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Speakers.dc.html:581` | Speakers · a write failed | `230px repeat(3, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:103` | Triage at volume · 1600 | `28px 74px 1fr 150px 130px 108px 92px 118px 64px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:107` | Triage at volume · 1600 | `28px 74px 1fr 150px 130px 108px 92px 118px 64px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:337` | Submission detail · /submissions/:id | `96px 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Submissions.dc.html:436` | CFP form builder · /submissions/forms | `18px 1fr 120px 92px auto` | not adjudicated this wave | UNMATCHED |

Total: 72 rows, matching `PACK_GRID_TRACK_UNMATCHED_CEILING`.

## Rejected in the same measurement pass

`padding` is the pack's largest ungraded property (1786 drawn declarations,
439 unmatched), but 158 of the unmatched are the frame's own `5px 10px`
number-badge chrome — an instrument artefact, not a defect count; not spent
this wave. `gap`, `align-items`, `justify-content`, `flex-direction`,
`white-space` and `overflow` all measure ZERO unmatched values.
`grid-template-columns` is the only genuinely divergent geometry axis left
ungraded in the pack.

## Repair

Not this lane's spend. This instrument measures and ratchets only; desktop
stays frozen and repair (raising `PACK_GRID_TRACK_UNMATCHED_CEILING` back
down as rows are closed) is a later wave's work against this ledger.
