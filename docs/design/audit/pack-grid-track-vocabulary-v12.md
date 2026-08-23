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

## Offender table

Bare-path-plus-backtick-quote citations only (`test/citation-form-drift.scan.test.ts`
is ceiling-0) — a `path:line` form is used ONLY for `docs/design/*.dc.html`
citations, which sit outside the app/src, src, test, scripts, migrations
population that scan grades.

Wave-53 (task w53-d) adjudicated 32 rows: every row whose frame file is
`Chautauqua Settings.dc.html` (9), `Chautauqua Public and Portal.dc.html`
(8), `Chautauqua Speakers.dc.html` (5), `Chautauqua Content.dc.html` (5),
`Chautauqua Submissions.dc.html` (4) and `Chautauqua Agenda.dc.html` (1) —
all six clusters landed whole. Verdicts: 12 MATCHED-MODULO (8
`table-layout` rows where the shipped surface is a real `<table>` rather
than a CSS grid but the fixed per-column widths reproduce the frame's
track list byte-for-byte, and 2 `partial-var-resolution` rows — repeated
twice each — where the instrument's normaliser only resolves a value that
is EXACTLY a bare `var(--x)` reference, so a `var(--x) 1fr auto` mixed
value it is never given credit for even when it expands byte-identical to
the frame), 20 DIVERGES (both track lists given inline, several already
carrying their own pre-existing product-code rationale comment). None are
NOT-SHIPPED — every one of the 32 regions renders something today.

The Comms (10) + Contacts (8) rows are owned by branch `v12m-w51-g` and the
Review (12) + Overview (10) rows by branch `v12m-w52-e` (both committed,
unmerged as of wave-53) — untouched here, still reading "not adjudicated
this wave" below. Every other row's "nearest shipped value" not covered
above remains unadjudicated — this instrument measures divergence, it does
not guess a correspondence a human has not confirmed.

| Frame file | Frame label | Drawn value | Nearest shipped value | Verdict |
| --- | --- | --- | --- | --- |
| `docs/design/Chautauqua Agenda.dc.html:75` | Day grid · 1600 | `62px repeat(4, 1fr)` | `app/src/pages/agenda/DayGrid.tsx`'s `.chq-day-grid` builds its track list at render time — `80px repeat(${columns.length}, minmax(140px, 1fr))` — generalising the frame's fixed 4-room example to any room count, with a wider 80px time gutter (frame: 62px) and a 140px floor on each room track (frame: bare `1fr`) (HAND-VERIFIED, wave-53) | DIVERGES |
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
| `docs/design/Chautauqua Content.dc.html:81` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | `app/src/pages/content/content.css`'s `.chq-content-worklist-table` is a real `<table>` with `table-layout:fixed`, not a CSS grid — its own comment quotes this exact frame track list; per-column widths (`.chq-content-worklist-col-select` 26px, `-speaker` 168px, `-latest-file` 200px, `-status` 152px) match every fixed track byte-for-byte, with Session (no width class) as the remainder column standing in for the frame's `1fr` and the trailing actions `<th>` standing in for `auto` (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:85` | Worklist · 1600 | `26px 1fr 168px 200px 152px auto` | Same row as `:81` — `.chq-content-worklist-table`'s fixed per-column widths match byte-for-byte (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:146` | Session deliverables · /content/:submissionId | `52px 1fr auto` | `app/src/pages/content/content.css`'s `.chq-content-version-item` is a real CSS grid declaring `48px 1fr auto auto auto` — leading track narrower (48px vs the frame's 52px) and the frame's single trailing `auto` (actions) split into three (tag-adjacent NEWEST badge, download, delete) per the w5-i comment "added a 5th (NEWEST badge) column" (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Content.dc.html:311` | Files library | `1fr 190px 108px 92px auto` | `app/src/pages/content/content.css`'s `.chq-content-files-table` is a real `<table>` with `table-layout:fixed` — its own comment quotes this exact frame track list; `.chq-content-files-col-session` 190px, `-version` 108px, `-size` 92px match every fixed track, Files (no width class) stands in for `1fr`, and `.chq-content-files-col-actions` (150px, shrink-hacked under fixed layout per its own comment) stands in for `auto` (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Content.dc.html:315` | Files library | `1fr 190px 108px 92px auto` | Same row as `:311` — `.chq-content-files-table`'s fixed per-column widths match byte-for-byte (HAND-VERIFIED, wave-53) | MATCHED-MODULO-table-layout |
| `docs/design/Chautauqua Overview.dc.html:493` | States · hover, pending, drag | `150px repeat(4, 1fr)` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:534` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:537` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:540` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:543` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:547` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:553` | States · hover, pending, drag | `44px 1fr 92px 84px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:662` | States · hover, pending, drag | `110px 1fr 220px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:714` | Loading · the first paint | `74px 1fr 150px 108px 92px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Overview.dc.html:718` | Loading · the first paint | `74px 1fr 150px 108px 92px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Public and Portal.dc.html:67` | Sessions and agenda · 1600 | `126px 1fr auto` | `src/routes/public/css/cards.css.ts`'s `.chq-pub-session-row` declares `grid-template-columns: var(--chq-pub-when-gutter) 1fr auto`, and `src/views/theme.ts` declares `--chq-pub-when-gutter: 126px` — the instrument's own normaliser only resolves a value that is EXACTLY a bare `var(--x)` reference (doc line 17), so a `var(--x) 1fr auto` mixed value is never resolved even though it is byte-identical to the frame once expanded (HAND-VERIFIED, wave-53) | MATCHED-MODULO-partial-var-resolution |
| `docs/design/Chautauqua Public and Portal.dc.html:150` | Agenda · 1600 | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | No `grid-template-columns` renders this region. `src/routes/public/css/chrome.css.ts`'s `main.chq-pub-main`/`.chq-measure-wide` centres the page via block-level `max-width` + horizontal padding, not a 3-track CSS grid — the frame's symmetric mirror-track centring idiom (same shape as Settings' `.chq-settings-layout`) has no grid counterpart on this surface (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Public and Portal.dc.html:172` | Agenda · 1600 | `88px minmax(0, 1fr)` | `src/routes/public/css/agenda.css.ts`'s `.chq-pub-agenda-day-row` is `display:flex`, not grid — its `.chq-pub-agenda-day-time` cell fixes at `flex:0 0 88px; width:88px`, matching the frame's leading 88px track by width, but the second cell is itself `.chq-pub-agenda-day-blocks`, a `display:grid; grid-template-columns:repeat(auto-fit, minmax(228px, 1fr))` fluid multi-track grid (DEC-584 wave-64) rather than a single flexible column, so concurrent same-time sessions fan out across tracks instead of stacking in one (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Public and Portal.dc.html:267` | Agenda · a track highlighted | `minmax(0, 1fr) minmax(0, 1180px) minmax(0, 1fr)` | Same region as `:150` — `main.chq-pub-main`/`.chq-measure-wide` centres via `max-width`+padding, no 3-track grid on this surface (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Public and Portal.dc.html:290` | Agenda · a track highlighted | `88px minmax(0, 1fr)` | Same row as `:172` — `.chq-pub-agenda-day-row` is flex + a nested `repeat(auto-fit, minmax(228px, 1fr))` grid, not a `88px minmax(0, 1fr)` two-track grid (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Public and Portal.dc.html:813` | My schedule · /e/:slug/schedule | `126px 1fr auto` | `src/routes/public/css/rail.css.ts`'s `.chq-pub-schedule-row` declares `grid-template-columns: var(--chq-pub-when-gutter) 1fr auto`, same `--chq-pub-when-gutter: 126px` token as `:67` — same partial-var-resolution miss (HAND-VERIFIED, wave-53) | MATCHED-MODULO-partial-var-resolution |
| `docs/design/Chautauqua Public and Portal.dc.html:1415` | Portal · Edit your session · desktop | `1fr 130px` | `src/routes/portal/portal.css.ts`'s `.chq-portal-participant-row` is `display:flex; justify-content:space-between`, not grid — name and role sit at opposite flex ends rather than in `1fr`/`130px` tracks, per the frame's own G13 fix-forward comment sitting just above it (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Public and Portal.dc.html:1443` | Portal · Edit your session · desktop | `1fr 190px` | `src/routes/portal/portal.css.ts`'s `.chq-portal-copresenter-email-role` is `display:flex; flex-wrap:wrap`, not grid — a DEC-604 wave-56 comment states the wide-only pairing is deliberately an intrinsic flex-basis floor rather than a discrete grid, because DEC-385's single-direction (max-width-only) rule forbids a min-width breakpoint to switch a `1fr 190px` grid on above the fold-point (HAND-VERIFIED, wave-53) | DIVERGES |
| `docs/design/Chautauqua Review.dc.html:124` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:128` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:143` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:147` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:160` | Organiser view · 1600 | `44px 1fr 132px 118px 190px 84px auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:508` | Plan editor · /review/plans/:id | `20px 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:516` | Plan editor · /review/plans/:id | `20px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:558` | Plan editor · /review/plans/:id | `1fr 120px 150px` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:755` | New plan · /review/plans/new | `20px 1fr` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:763` | New plan · /review/plans/new | `20px 1fr auto` | not adjudicated this wave | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:848` | Your plans · /review | `1fr 150px 190px auto` | `app/src/pages/review/review.css`'s `.chq-review-plans-head` row declares `1fr 150px 190px 210px auto` — an extra 210px track (HAND-VERIFIED, DEC-896 wave-48) | UNMATCHED |
| `docs/design/Chautauqua Review.dc.html:852` | Your plans · /review | `1fr 150px 190px auto` | `app/src/pages/review/review.css`'s `.chq-review-plans-head` row declares `1fr 150px 190px 210px auto` — an extra 210px track (HAND-VERIFIED, DEC-896 wave-48) | UNMATCHED |
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
