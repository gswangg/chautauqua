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

Two rows are HAND-VERIFIED from DEC-896's wave-48 amendment; a further 17
rows (the Comms + Contacts clusters — 9 + 8) are HAND-VERIFIED from
wave-51 — see the Wave 51 section below; the 22 Review + Overview rows are
adjudicated in the Wave 52 section above; and the remaining 32 rows (the
Settings, Public and Portal, Speakers, Content, Submissions and Agenda
clusters) are adjudicated in the Wave 53 section below. Every row in the
table now carries a confirmed correspondence — this instrument measures
divergence, it does not guess a correspondence a human has not confirmed.

| Frame file | Frame label | Drawn value | Nearest shipped value | Verdict |
| --- | --- | --- | --- | --- |
| `docs/design/Chautauqua Agenda.dc.html:75` | Day grid · 1600 | `62px repeat(4, 1fr)` | DESKTOP DIVERGENCE (DEC-896, wave 54): `app/src/pages/agenda/DayGrid.tsx` computes `` `80px repeat(${columns.length}, minmax(140px, 1fr))` `` and assigns it via the inline `style={{ gridTemplateColumns }}` object -- a real, reachable room-lane board serving the same shape (fixed time gutter + N room tracks) but wider (80px vs. the frame's 62px) and each room track floored at `minmax(140px, 1fr)` rather than a bare `1fr`; the camelCase inline-style form also carries no literal `grid-template-columns:` colon syntax, so the scan's colon-keyed regex never reaches it in the first place. | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:157` | Compose · step 3 of 4 · 1600 | `150px 1fr 130px 150px auto` | `app/src/pages/comms/comms.css` `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` — same first four tracks, last track pinned to 96px where the frame draws `auto` (a documented fidelity fix, same file, "Frame 07-comms--08 fidelity fix: the trailing action track was `auto`" — a shared per-row action button gave two different `auto` widths and misaligned the columns) (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:424` | Compose · step 1 of 4 | `26px 1fr 170px 130px 118px` | `app/src/pages/comms/comms.css` `.chq-comms-compose-col-slot` — the compose step-1 recipient table is an HTML `<table>` with `table-layout:fixed` and per-`<th>` widths (`.chq-comms-compose-col-select{width:26px}`, `.chq-comms-compose-col-speaker{width:170px}`, `.chq-comms-compose-col-status{width:130px}`, `.chq-comms-compose-col-slot{width:150px}`, Submission unwidthed remainder), same file's own comment: "Frame 07-comms--05: kept on one line ... widened from 118px, which wrapped ... at the table's narrower breakpoints" — first four tracks match the frame exactly, the fifth (Slot) is a documented widen from 118px to 150px (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:428` | Compose · step 1 of 4 | `26px 1fr 170px 130px 118px` | same row as `:424` — `app/src/pages/comms/comms.css` `.chq-comms-compose-col-slot` widened 118px→150px, first four tracks match (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:634` | Comms · history | `150px 1fr 108px 150px 88px` | `app/src/pages/comms/comms.css` `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` — the History tab's column-head row inherits this same custom property (same file: ".chq-comms-batch-col-heads-row ... the History tab's own column heads ... over the SAME --chq-comms-batch-grid the batch rows below use"); shipped third and fifth tracks (130px, 96px) differ from the frame's drawn 108px/88px (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:639` | Comms · history | `150px 1fr 108px 150px 88px` | same `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` (`app/src/pages/comms/comms.css`, `.chq-comms-batch-row`) — third/fifth tracks (130px/96px) differ from the frame's 108px/88px (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:649` | Comms · history | `150px 1fr 108px 150px 88px` | same `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` (`app/src/pages/comms/comms.css`, disclosure's own head row `.chq-comms-recipient-col-heads-row`, which shares `.chq-comms-recipient-row`'s grid) — third/fifth tracks differ (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:653` | Comms · history | `150px 1fr 108px 150px 88px` | same `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` (`app/src/pages/comms/comms.css`, `.chq-comms-batch-recipients .chq-comms-recipient-row`) — third/fifth tracks differ (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:664` | Comms · history | `150px 1fr 108px 150px 88px` | same `--chq-comms-batch-grid: 150px 1fr 130px 150px 96px;` (`app/src/pages/comms/comms.css`, the disclosure's trailing "N more" row, same grid) — third/fifth tracks differ (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:773` | Compose · send blocked | `1fr 190px 150px` | `app/src/pages/comms/ComposeWizard.tsx` `chq-comms-merge-warning` — the merge-field-conflict state renders ONE `chq-comms-merge-warning` advisory paragraph (own comment: "the frame's own consequence sentence ... is false for this app ... this band states the refusal instead"), never the frame's per-recipient `Recipient / Missing` breakdown table the `1fr 190px 150px` track list lays out — no such table exists in the shipped component (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Comms.dc.html:777` | Compose · send blocked | `1fr 190px 150px` | same row as `:773` — `app/src/pages/comms/ComposeWizard.tsx` `chq-comms-merge-warning` replaces the frame's per-recipient table with one summary paragraph, no `Recipient`/`Missing` table ships (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:97` | Directory · 1600 | `26px 1fr 130px 118px auto` | `app/src/styles.css` `.chq-contacts-table .chq-contacts-col-select` — desktop `<table table-layout:fixed>` column widths: select `width: 46px;` (own comment: "18px control + shared .chq-table 16px first-cell inset + air (user-filed)"), Company `width: 130px;` (matches), Labels `width: 118px;` (matches), Actions `width: 96px;` (own comment: "User-filed (gate-9): width:1px shrink-hack is literal") where the frame draws `26px`/`auto` — select and actions tracks are documented user-filed departures, Company and Labels match exactly (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:101` | Directory · 1600 | `26px 1fr 130px 118px auto` | same row as `:97` — `app/src/styles.css` `.chq-contacts-table .chq-contacts-col-select` is `width: 46px;` not the frame's `26px`, `.chq-contacts-col-actions` is `width: 96px;` not the frame's `auto` (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:130` | Directory · 1600 | `1fr 44px` | `app/src/pages/contacts/contacts.css` `.chq-contacts-rail-row` — the "Where they work" company row is `display: flex; align-items: baseline; justify-content: space-between;` with the count (`.chq-contacts-rail-count`) sized to its own content, never a CSS grid with a fixed 44px count track; the technique itself (flex, not `grid-template-columns`) is why the scan's population never sees a declaration here at all (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:292` | Import CSV · step 2 of 3 | `1fr 26px 1fr` | `app/src/pages/contacts/contacts-panels.css` `.chq-contacts-import-column-row` — own comment: "G13 (frame 08-contacts--03): the match step is a full-width row list ... never a two-up grid of bordered cards"; shipped is `display: flex; align-items: center;` with the id column `flex: 1`, the arrow `flex: none`, and the target `.chq-contacts-import-column-select` right-flushed with `max-width` rather than the frame's equal `1fr` target pane (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:366` | Duplicates · merge | `132px 1fr 1fr` | `app/src/pages/contacts/contacts-panels.css` `.chq-contacts-merge-compare-head` `grid-template-columns: 130px 1fr 1fr;` — same track shape, the Field label track ships 2px narrower than drawn (130px vs. the frame's 132px) (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:379` | Duplicates · merge | `132px 1fr 1fr` | `app/src/pages/contacts/contacts-panels.css` `.chq-contacts-merge-compare-row` `grid-template-columns: 130px 1fr 1fr;` — same 2px narrower Field track as `.chq-contacts-merge-compare-head` above (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:690` | Import CSV · step 3 of 3 | `190px 1fr auto` | `app/src/pages/contacts/contacts-panels.css` `.chq-contacts-import-review-col-email` — own comment: "w23-b (DEC-902): docs/design/Chautauqua Contacts.dc.html:690's update row is `190px 1fr auto` -- Email is the frame's identity track. Line is real data the mock's name-over-email layout lacked ... Action is the sole unwidthed remainder ... Skip this row hugs its single checkbox"; the frame's dedicated 3-track "already exist" preview list ships as ONE combined 4-column `<table>` (Line `width: 56px;` new, Email `width: 190px;` matches, Action unwidthed remainder matches the frame's `1fr`, Skip `width: 112px;` resolves the frame's `auto`) covering every review row, not a standalone already-exist list (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Contacts.dc.html:792` | Import CSV · the file will not do | `64px 1fr` | `app/src/pages/contacts/ImportWizard.tsx` `chq-error-summary-rows` — own comment: "G13 (frame 08-contacts--15): every rejected row names its own reason ... in the frame's vocabulary"; shipped renders `<li>Row {row.line} — {row.problem}</li>`, one flowing text line with no CSS grid and no separate 64px Row-number column at all (wave-51, HAND-VERIFIED) | DESKTOP DIVERGENCE |
| `docs/design/Chautauqua Content.dc.html:81` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | `app/src/pages/content/content.css`'s `.chq-content-worklist-table` is a real `<table>` with `table-layout:fixed`, not a CSS grid — its own comment quotes this exact frame track list; per-column widths (`.chq-content-worklist-col-select` 26px, `-speaker` 168px, `-latest-file` 200px, `-status` 152px) match every fixed track byte-for-byte, with Session (no width class) as the remainder column standing in for the frame's `1fr` and the trailing actions `<th>` standing in for `auto` (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:85` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | Same row as `:81` — `.chq-content-worklist-table`'s fixed per-column widths match byte-for-byte (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:146` | Session deliverables · /content/:submissionId | `52px 1fr auto` | `app/src/pages/content/content.css`'s `.chq-content-version-item` is a real CSS grid declaring `48px 1fr auto auto auto` — leading track narrower (48px vs the frame's 52px) and the frame's single trailing `auto` (actions) split into three (tag-adjacent NEWEST badge, download, delete) per the w5-i comment "added a 5th (NEWEST badge) column" (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Content.dc.html:311` | Files library | `1fr 190px 108px 92px auto` | `app/src/pages/content/content.css`'s `.chq-content-files-table` is a real `<table>` with `table-layout:fixed` — its own comment quotes this exact frame track list; `.chq-content-files-col-session` 190px, `-version` 108px, `-size` 92px match every fixed track, Files (no width class) stands in for `1fr`, and `.chq-content-files-col-actions` (150px, shrink-hacked under fixed layout per its own comment) stands in for `auto` (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:315` | Files library | `1fr 190px 108px 92px auto` | Same row as `:311` — `.chq-content-files-table`'s fixed per-column widths match byte-for-byte (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
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
| `docs/design/Chautauqua Public and Portal.dc.html:67` | Sessions and agenda · 1600 | `126px 1fr auto` | INSTRUMENT ARTEFACT (DEC-896, wave 54): `src/routes/public/css/cards.css.ts`'s `.chq-pub-session-row` declares `grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;`, and `--chq-pub-when-gutter: 126px;` (`app/src/styles.css`, `src/views/theme.ts`) resolves the value to exactly `126px 1fr auto` -- the frame's own citation for the token (cards.css.ts's comment names `.dc.html:67` directly). The scan's var() resolver only fires when a declared value is EXACTLY one `var(--x)` reference; a mixed value with a literal var() in only the first track is never resolved, so a byte-for-byte match reads UNMATCHED. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Public and Portal.dc.html:150` | Agenda · 1600 | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | UNSERVED (DEC-896, wave 54): the frame's 3-track centering shell (a `1fr`/`1180px`/`1fr` grid, drawn twice more at `:267`/`:151` for the inner `minmax(0, 820px) 300px` pair) is never built as a CSS grid at all -- `app/src/styles.css`'s `.chq-measure-wide { max-width: var(--chq-measure-wide); margin: 0 auto; }` (1180px) centers the same content column with a max-width + `margin:auto` technique, and the inner 820px/300px split ships via `.chq-pub-sessions-fresh-layout`'s own `grid-template-columns: minmax(0, 820px) 300px;` (`src/routes/public/css/rail.css.ts`) reached through `justify-content:center` rather than nested inside an outer 3-track shell -- same visual result, no `grid-template-columns` declaration matching this outer track list anywhere in the corpus. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:172` | Agenda · 1600 | `88px minmax(0, 1fr)` | UNSERVED (DEC-896, wave 54): the frame's per-slot time-gutter + content row; shipped as `.chq-pub-agenda-day-row` (`src/routes/public/css/agenda.css.ts`), a `display:flex` row whose `.chq-pub-agenda-day-time` child is `flex: 0 0 88px; width: 88px;` -- the 88px measure matches exactly, the mechanism is flexbox, never a `grid-template-columns` declaration. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:267` | Agenda · a track highlighted | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | UNSERVED (DEC-896, wave 54): same outer 3-track centering shell as `:150` -- `app/src/styles.css`'s `.chq-measure-wide` max-width + `margin:auto` technique, no matching `grid-template-columns` declaration anywhere. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:290` | Agenda · a track highlighted | `88px minmax(0, 1fr)` | UNSERVED (DEC-896, wave 54): same per-slot time-gutter row as `:172` -- `.chq-pub-agenda-day-row`/`.chq-pub-agenda-day-time` (`src/routes/public/css/agenda.css.ts`) is `display:flex` with `flex: 0 0 88px`, never `grid-template-columns`. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:813` | My schedule · /e/:slug/schedule | `126px 1fr auto` | INSTRUMENT ARTEFACT (DEC-896, wave 54): same mixed var() value as `:67` -- `src/routes/public/css/rail.css.ts`'s `.chq-pub-schedule-row` declares `grid-template-columns: var(--chq-pub-when-gutter) 1fr auto;`, which resolves to exactly `126px 1fr auto`, but the scan's var() resolver only fires on a whole-value `var(--x)` reference, not a mixed value. | INSTRUMENT ARTEFACT |
| `docs/design/Chautauqua Public and Portal.dc.html:1415` | Portal · Edit your session · desktop | `1fr 130px` | UNSERVED (DEC-896, wave 54): the frame's "On this session" participant row (name/note track + right-flushed role track); shipped as `.chq-portal-participant-row` (`src/routes/portal/portal.css.ts`), a `display:flex; justify-content:space-between;` row with the role label auto-sized to its own content -- same real element, no `grid-template-columns` declaration and no fixed 130px role track. | UNSERVED |
| `docs/design/Chautauqua Public and Portal.dc.html:1443` | Portal · Edit your session · desktop | `1fr 190px` | UNSERVED (DEC-896, wave 54): the frame's "Add a co-presenter" Email/Role row; shipped as `.chq-portal-copresenter-email-role` (`src/routes/portal/portal.css.ts`), a `display:flex; flex-wrap:wrap;` pairing (`div:first-child { flex: 1 1 220px; }`, `.chq-portal-copresenter-role { flex: 0 1 190px; }`) -- the 190px role measure matches, the mechanism is flex-basis, never `grid-template-columns` (the class's own `grid-template-columns: 1fr 1fr;` at `:1121` is INSIDE the `max-width:700px` phone override, DEC-385, and grids the First-/Last-name pair, not this row). | UNSERVED |
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
| `docs/design/Chautauqua Settings.dc.html:134` | Event, form, publishing, data · 1600 | `170px 1fr 124px 82px 84px` | `app/src/pages/settings/settings.css`'s `.chq-settings-public-pages-row` declares `170px 1fr 140px auto auto` — leading two tracks match (170px, 1fr); tracks 3-5 diverge (140px vs 124px, `auto` vs 82px, `auto` vs 84px) (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:150` | Event, form, publishing, data · 1600 | `1fr 128px 96px 190px` | `app/src/pages/settings/settings.css`'s `.chq-settings-saved-embed-row` declares `170px 1fr 90px auto` — same 4-track count for the same "Saved embeds" row, but the leading fixed/flex track is inverted (frame leads with `1fr`, shipped leads with `170px`) and every value differs (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:157` | Event, form, publishing, data · 1600 | `34px 66px 62px` | No `grid-template-columns` renders this region. `.chq-settings-saved-embed-actions`, the Edit/Get code/toggle action cluster inside the saved-embed row, is `display:inline-flex; gap:22px`, not a grid (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:220` | Event, form, publishing, data · 1600 | `1fr 190px 150px auto` | `app/src/pages/settings/settings.css`'s `--chq-people-grid: minmax(0, 1fr) 170px 190px 200px`, consumed by `.chq-settings-people-row`, resolves to `1fr 170px 190px 200px` — leading `1fr` matches; tracks 2-4 diverge (170px vs 190px, 190px vs 150px, 200px vs `auto`) (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:825` | Settings · editing tracks and rooms | `20px 1fr 150px auto` | `app/src/pages/settings/settings.css`'s `.chq-settings-track-edit-row` declares `minmax(0, 1fr) 150px 200px`, normalising to `1fr 150px 200px` — the row's own comment confirms the frame's leading 20px drag-handle track "is not reproduced, there is no reorder endpoint", and the trailing track is fixed at 200px rather than `auto` so the dirty-state Save/Cancel pair cannot resize the row (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:844` | Settings · editing tracks and rooms | `20px 1fr 110px 150px auto` | `app/src/pages/settings/settings.css`'s `.chq-settings-room-edit-row` declares `minmax(0, 1fr) 110px 150px 200px`, normalising to `1fr 110px 150px 200px` — same drag-column omission and fixed-trailing-track rationale as `:825` (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:928` | Settings · editing the speaker portal | `1fr 170px auto` | No `grid-template-columns` renders this region. `.chq-settings-portal-resource-row`, the speaker-portal Resources edit row, is `display:flex; align-items:baseline; gap:14px; flex-wrap:wrap`, not a grid (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:986` | Settings · editing people and roles | `1fr 170px 190px auto` | `app/src/pages/settings/settings.css`'s `--chq-people-grid` resolves to `1fr 170px 190px 200px` — last track 200px where the frame draws `auto` (HAND-VERIFIED, DEC-896 wave-48) | DIVERGES |
| `docs/design/Chautauqua Settings.dc.html:990` | Settings · editing people and roles | `1fr 170px 190px auto` | `app/src/pages/settings/settings.css`'s `--chq-people-grid` resolves to `1fr 170px 190px 200px` — last track 200px where the frame draws `auto` (HAND-VERIFIED, DEC-896 wave-48) | DIVERGES |
| `docs/design/Chautauqua Speakers.dc.html:76` | Onboarding grid · 1600 | `230px repeat(6, 1fr)` | `app/src/pages/speakers/speakers.css`'s `.chq-speakers-grid` is a real `<table>` with `table-layout:fixed`, not a CSS grid — its own DEC-730 wave-19 comment quotes this exact frame track list and states the first-column 230px width (`th:first-child`/`td:first-child`) plus fixed layout makes the browser distribute the remaining columns equally, "same as the frame's `repeat(6, 1fr)`" (HAND-VERIFIED, DEC-730 wave-19, restated wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Speakers.dc.html:90` | Onboarding grid · 1600 | `230px repeat(6, 1fr)` | Same row as `:76` — `.chq-speakers-grid`'s `table-layout:fixed` + 230px first column (DEC-730 wave-19) (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Speakers.dc.html:364` | Speaker detail · /admin/speakers/:contactId | `1fr 150px 130px` | `app/src/pages/speakers/speakers.css`'s `.chq-speaker-detail-sessions-row` declares `1fr 150px 130px 110px` — leading three tracks match the frame exactly; a fourth 110px track is deliberately appended per the row's own "USER RULING (release night)" comment, which requires "the detail page must not support LESS than the roster grid" so each session row carries its own per-session participation-menu track (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Speakers.dc.html:578` | Speakers · a write failed | `230px repeat(3, 1fr)` | Same table technique as `:76`/`:90` — `.chq-speakers-grid`'s `table-layout:fixed` + 230px first column applies identically to the write-failed state's 3-task-column variant of the same matrix (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Speakers.dc.html:581` | Speakers · a write failed | `230px repeat(3, 1fr)` | Same row as `:578` (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Submissions.dc.html:103` | Triage at volume · 1600 | `28px 74px 1fr 150px 130px 108px 92px 118px 64px` | `app/src/pages/submissions/submissions.css`'s `.chq-submissions-table` is a real `<table>` with `table-layout:fixed`, not a grid; its own comment quotes this exact frame track list, but the per-column widths were subsequently widened past the frame's own numbers — select 44px (frame 28px), Ref 88px (frame 74px), Speakers 164px (frame 150px), Track 144px (frame 130px), Status 122px (frame 108px), Sent 106px (frame 92px) — while custom-column 118px and Clone 64px still match, per the "G13 lane-D fix" comment citing a 68px-wider app content box (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Submissions.dc.html:107` | Triage at volume · 1600 | `28px 74px 1fr 150px 130px 108px 92px 118px 64px` | Same row as `:103` — `.chq-submissions-table`'s widened fixed columns (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Submissions.dc.html:337` | Submission detail · /submissions/:id | `96px 1fr` | `app/src/pages/submissions/detail.css`'s `.chq-submission-history-row` declares `118px 1fr` — its own comment states it was "widened from 96px" (matching the frame's number) because the "when" cell now carries a time as well as a date ("16 Aug, 14:32", DEC-708 amendment) which wrapped mid-token at the frame's original width (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Submissions.dc.html:436` | CFP form builder · /submissions/forms | `18px 1fr 120px 92px auto` | `app/src/pages/forms/forms.css`'s `.chq-forms-field-row` declares `20px 1fr 150px 108px auto` — the row's own comment claims to "mirror the mock's 20px/1fr/150px/108px/auto rhythm", but the frame at `:436` actually draws `18px`/`120px`/`92px` for those three tracks, so the shipped comment mis-cites the frame it names as well as diverging from it (HAND-VERIFIED, wave-53) | DIVERGES |

Total: 72 rows, matching `PACK_GRID_TRACK_UNMATCHED_CEILING`.

## Wave 54 (task w54-d): the Public-and-Portal + Agenda rows adjudicated

Task w54-d adjudicated 9 of this table's rows: the 8 `docs/design/Chautauqua
Public and Portal.dc.html` rows (`:67`, `:150`, `:172`, `:267`, `:290`,
`:813`, `:1415`, `:1443`) and the 1 `docs/design/Chautauqua Agenda.dc.html`
row (`:75`). DOCS ONLY -- no CSS byte moved, no constant was renamed or
re-declared, and `PACK_GRID_TRACK_UNMATCHED_CEILING` stays at `72`;
adjudication replaces a placeholder "not adjudicated this wave" cell with a
confirmed correspondence, it does not remove a row from the measured
population. Two sibling lanes (w54-e, w54-f) are adjudicating disjoint
row slices of this same table in parallel this wave.

Tally for these 9 rows (DEC-896, wave 54): **5 UNSERVED**, **3 INSTRUMENT
ARTEFACT**, **1 DESKTOP DIVERGENCE**, 0 MATCHED-VIA-VAR.

- **UNSERVED (5)** -- a real, reachable product element serves the same
  visual columns through a different CSS mechanism, never the frame's own
  `grid-template-columns`: the outer 3-track centering shell at `:150`/`:267`
  is built with `.chq-measure-wide`'s `max-width` + `margin:0 auto`
  (`app/src/styles.css`), not a grid; the per-slot 88px time-gutter row at
  `:172`/`:290` is `.chq-pub-agenda-day-row`'s `display:flex` with
  `flex: 0 0 88px` (`src/routes/public/css/agenda.css.ts`); the Portal
  "On this session" participant row at `:1415` and the "Add a co-presenter"
  Email/Role row at `:1443` are both `display:flex` pairings
  (`.chq-portal-participant-row`, `.chq-portal-copresenter-email-role`,
  `src/routes/portal/portal.css.ts`) rather than CSS grid.
- **INSTRUMENT ARTEFACT (3)** -- a real declared `grid-template-columns:`
  resolves, through its custom property, to the drawn value byte-for-byte,
  but the scan's var() resolver only substitutes a value that is EXACTLY one
  `var(--x)` reference; `.chq-pub-session-row` (`:67`) and
  `.chq-pub-schedule-row` (`:813`) both declare
  `var(--chq-pub-when-gutter) 1fr auto`, and `--chq-pub-when-gutter: 126px;`
  makes both resolve to the frame's exact `126px 1fr auto` -- invisible to
  the instrument because the var() sits in only the first of three tracks,
  not the whole value.
- **DESKTOP DIVERGENCE (1)** -- `docs/design/Chautauqua Agenda.dc.html:75`'s
  admin day-grid board (`62px repeat(4, 1fr)`) is real and reachable
  (`app/src/pages/agenda/DayGrid.tsx`), but ships a genuinely different
  track list -- `` `80px repeat(${columns.length}, minmax(140px, 1fr))` ``,
  assigned via an inline `style={{ gridTemplateColumns }}` object rather
  than a literal `grid-template-columns:` string, so the scan's colon-keyed
  regex cannot see it at all; independent of the syntax gap, the shipped
  time gutter is 80px wide against the frame's 62px and each room track is
  floored at `minmax(140px, 1fr)` rather than a bare `1fr`.

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

## Wave 51 (task w51-g): the Comms + Contacts clusters adjudicated

DOCS ONLY — no CSS byte, no constant moved (DEC-896). The ratchet stays
two-sided and green at 72; adjudicating a row's "Nearest shipped value" and
verdict does not remove it from the population, it only replaces the
placeholder text with a real correspondence (or an honest non-correspondence)
a human confirmed by opening both the frame extent and the shipped source.

Took the 9 `Chautauqua Comms.dc.html` rows (`:157`, `:424`, `:428`, `:634`,
`:639`, `:649`, `:653`, `:664`, `:773`, `:777`) and the 8
`Chautauqua Contacts.dc.html` rows (`:97`, `:101`, `:130`, `:292`, `:366`,
`:379`, `:690`, `:792`) — all 17 rows the doc's table names for those two
frame files. All 17 resolve to **DESKTOP DIVERGENCE**; none is a
NORMALISATION-GAP (none of the divergences are whitespace/`minmax(0,X)`/
`var()`-resolution artefacts the scan's three normalisation transforms would
erase) and none is NOT-A-ROW (every extent is a live table/row/list the
reachability filter was right to admit — no explainer-panel or state-
illustration prose among them).

Three shapes of divergence, all real and all pre-existing (none introduced
by this lane, none repaired by this lane):

1. **Documented, deliberate pixel/track differences with an in-code
   citation.** `:157`/`:634`/`:639`/`:649`/`:653`/`:664` (Comms' shared
   `--chq-comms-batch-grid`, comms.css) and `:424`/`:428` (Comms'
   `.chq-comms-compose-col-slot`, same file) each carry a comment naming the
   exact frame line(s) and the exact pixel change (`auto`→`96px` fixing a
   per-row auto-width misalignment; `118px`→`150px` fixing text wrap) —
   except `:634`–`:664`, where the *shipped* third/fifth tracks (130px/96px)
   differ from the *frame's* 108px/88px with no comment addressing that
   specific gap (the comment there addresses the trailing-track fix from the
   `:157`/compose context, not the History tab's own numbers) — real,
   unexplained-in-place divergence, still DESKTOP DIVERGENCE, not repaired.
   `:366`/`:379` (Contacts' `.chq-contacts-merge-compare-head`/`-row`) is a
   plain undocumented 2px difference (130px shipped vs. 132px drawn).
   `:97`/`:101` (Contacts directory table, `app/src/styles.css`) is
   documented user-filed (comment: "18px control + shared .chq-table 16px
   first-cell inset + air (user-filed)" / "User-filed (gate-9): width:1px
   shrink-hack is literal").

2. **A different layout technique achieves a similar but not identical
   result.** `:130` (Contacts "Where they work" rail row) and `:292`
   (Contacts CSV column-mapping row) both ship as `display:flex` rows, never
   `grid-template-columns` — `:292`'s own comment states this is deliberate
   ("G13 (frame 08-contacts--03): ... never a two-up grid of bordered
   cards"). Flex without an explicit fixed-width second track does not
   reproduce a grid's hard pixel column, so these are real divergences, not
   scan blind spots the three listed normalisations could close.

3. **The frame's per-row breakdown never shipped as its own structure.**
   `:773`/`:777` (Comms merge-field-conflict "Recipient / Missing" table) —
   the shipped `chq-comms-merge-warning` is one summary paragraph, its own
   comment explains the frame's literal consequence is false for this app
   and names the actual (different) refusal behaviour instead; no
   `Recipient`/`Missing` table exists anywhere in ComposeWizard.tsx.
   `:690` (Contacts "N already exist" preview list) — the shipped
   `chq-contacts-import-review-table` is ONE combined 4-column review table
   covering every plan row (new + updated), not a standalone 3-track
   already-exist list; its own comment (w23-b, DEC-902) walks the
   frame-to-shipped column correspondence in full. `:792` (Contacts
   rejected-row list) — shipped is a flowing `Row {n} — {problem}` text
   line per `<li>`, no grid, no separate Row-number column.

No row was left NOT ADJUDICATED: every one of the 17 has a confirmed
shipped correspondence (a component, a class, and — where the file carries
one — the comment explaining the gap). No CSS changed; no verdict here
claims a repair.

## Wave 53 (task w53-d): the remaining six frame clusters adjudicated

Wave-53 (task w53-d) adjudicated 32 rows: every row whose frame file is
`Chautauqua Settings.dc.html` (9), `Chautauqua Public and Portal.dc.html`
(8), `Chautauqua Speakers.dc.html` (5), `Chautauqua Content.dc.html` (5),
`Chautauqua Submissions.dc.html` (4) and `Chautauqua Agenda.dc.html` (1) —
all six clusters landed whole. Verdicts: 10 MATCHED-MODULO (8
`table-layout` rows where the shipped surface is a real `<table>` rather
than a CSS grid but the fixed per-column widths reproduce the frame's
track list byte-for-byte, and 2 `partial-var-resolution` rows — where the
instrument's normaliser only resolves a value that
is EXACTLY a bare `var(--x)` reference, so a `var(--x) 1fr auto` mixed
value it is never given credit for even when it expands byte-identical to
the frame), 22 DIVERGES (both track lists given inline, several already
carrying their own pre-existing product-code rationale comment). None are
NOT-SHIPPED — every one of the 32 regions renders something today.

INTEGRATION NOTE (wave-55 megabatch): 9 of these 32 rows -- the 8 `Chautauqua Public and Portal.dc.html` rows and the 1 `Chautauqua Agenda.dc.html` row -- were independently re-adjudicated by task w54-d in the same integration window, reaching the same substantive findings in the table's dominant DEC-896 verdict vocabulary (UNSERVED / INSTRUMENT ARTEFACT / DESKTOP DIVERGENCE). The table above carries w54-d's cells for those 9 rows and this wave's cells for the other 23; see the "Wave 54" section for their tally.

The Comms (10) + Contacts (8) rows were adjudicated by wave-51 (task
w51-g) and the Review (12) + Overview (10) rows by wave-52 (task w52-e) —
untouched by this lane, over disjoint rows; the three lanes' verdicts were
unioned into the single table above when their branches integrated. With
all three landed, every one of the 72 rows now carries an adjudicated
"nearest shipped value" and a verdict — this instrument measures
divergence, it does not guess a correspondence a human has not confirmed.
