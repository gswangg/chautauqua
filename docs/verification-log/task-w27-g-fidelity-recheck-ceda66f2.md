# task-w27-g — TIER-1 fidelity re-check @ ceda66f2 (DOCS ONLY)

Walks the ~dozen VERIFIED-OPEN-NOT-RECHECKED clauses named in the wave-27
task brief against current `main` (`ceda66f2`) and the vendored pack
(`docs/design/*.dc.html`, `docs/design/README.md`,
`docs/design/DESIGN-RULINGS.md`). Each clause gets one verdict — OPEN /
CLOSED-AT-TIP / UNQUOTABLE — with a quoted `path:line` from the tree AND
from the vendored line the clause claims is violated (or a note that no
such vendored line exists). No code was read speculatively beyond what was
needed to find the quoted lines; no test was run (DOCS ONLY task).

## 1. Participation panel 420 — CLOSED-AT-TIP

Tree: `app/src/pages/speakers/speakers.css:406` — `width: 420px;` on
`.chq-participation-menu-panel`, landed by the DEC-830 wave-19 amendment
(comment at `:397-399`: "the panel is a fixed-width three-band card...
frame `Chautauqua Speakers.dc.html:296-317`").
Vendor: `docs/design/Chautauqua Speakers.dc.html:296` —
`<div style="width:420px; background:#F4F1E8; ...">`.
Widths match exactly; `app/src/pages/speakers/ParticipationMenu.render.test.tsx:349-351`
asserts it (`expect(panelRule).toMatch(/width:\s*420px/)`).

## 2. Speaker-detail grid/theads — UNQUOTABLE

Tree: `app/src/pages/speakers/SpeakerDetailPage.tsx:331,366,414` render
Sessions/Tasks/Files as `<div role="table" aria-label="…">` with row divs
and `role="cell"` spans — no `<thead>`, no `role="columnheader"` anywhere
in the file.
Vendor: `docs/design/Chautauqua Speakers.dc.html:355-385` draws the exact
same anatomy for these three sections — a `2px solid #1B1D17` section-label
rule followed directly by `sc-for` row divs (e.g. `:368-374` for Tasks) —
with **no header row of its own**, i.e. the vendored frame itself has no
thead/columnheader to match. `DESIGN-RULINGS.md:99` ("participation status
control in the header..., then four sections — Sessions, Tasks, Files,
Notes — at the table measure") states section order and the table measure,
not a thead requirement. No line anywhere in the vendored pack asserts
speaker-detail rows need column headers; the clause names a rule the pack
does not draw. DELETED, not carried.

## 3. Write-failed banner anatomy — CLOSED-AT-TIP

Tree: `app/src/pages/speakers/OnboardingGrid.tsx:713-720` — a
`role="alert"` banner rendering `pendingFailure.message`, a "Try again"
button (`:715-717`, re-issues the identical write) and a "Reload the grid"
button (`:718-720`); the reverted cell keeps a "not saved" marker per
`OnboardingGrid.render.test.tsx:1622` (`'Pending · not saved'`).
Vendor: `docs/design/DESIGN-RULINGS.md:209` — "The banner names the row,
gives the likely cause... and offers *Try again* plus *Reload the grid*.
The reverted cell itself is marked 'Overdue · not saved' until dismissed."
Anatomy matches point for point.

## 4. Upload-reject modal anatomy — CLOSED-AT-TIP

Tree: `app/src/pages/content/UploadRejectedModal.tsx:26-64` — `ModalFrame`
titled "That file was not uploaded", subtitled `session · kind`, a
`role="alert"` band with headline + why text, a "What was kept" block, and
actions "Choose another file" (primary) / "Cancel" (secondary). The
component's own header comment (`:24-28`) cites
`docs/design/Chautauqua Content.dc.html:431-457`.
Vendor: `docs/design/Chautauqua Content.dc.html:439-448` — same title
("That file was not uploaded"), same subtitle pattern
("Taming 40-Minute CI · slides"), the refusal band (`:445-447`), "What was
kept" block (`:448-450`), and the same two actions (`:451`). The complaint
was anatomy, not existence (`UploadRejectedModal.tsx` exists) — anatomy
matches.

## 5. Templates-grid overlap — CLOSED-AT-TIP

Tree: `app/src/pages/comms/TemplatesTab.tsx:208-233` — the saved-templates
list is now a real `<table>` (`<thead>`/`<tbody>`, `:208-233`) whose rows
carry exactly two cells, Name and Last used (`:223,229`); no per-row
verbs/buttons remain in the row (Delete/Duplicate/"Use in a send" live in
the editor panel, `:238` on). `app/src/pages/comms/templates.css` has zero
`grid-template-columns` declarations (`grep` returns nothing) — there is no
CSS grid left to overlap.
Vendor: `docs/design/Chautauqua Comms.dc.html:239` —
`<div style="display:grid; grid-template-columns:1fr auto; ...">` with a
name+detail block and a right-aligned "used" span, no action cluster in
the row. `decisions/DEC-830.md`... (see DEC-890.md:15, the decision that
diagnosed the original overlap: "the editor panel overlaps the cluster...
the fix is subtractive"): the row now carries its one control (the name)
exactly as the fix rules, closing the overlap the clause named.

## 6. Plan-editor draft footer — CLOSED-AT-TIP

Tree: `app/src/pages/review/PlanEditor.tsx:2278-2293` — a
`chq-review-editor-footer-row` with "Delete plan" rendered as a
`chq-link-button` (tertiary text link, not a bordered button), `disabled`
when `planHasSubmittedReview`, with adjacent caption "Delete plan is
unavailable once a review has landed — start a new wave instead."
(`:2290`).
Vendor: `docs/design/DESIGN-RULINGS.md:50` — "Delete plan: RESTYLE, one
line: a tertiary link in the plan editor footer, disabled once any review
has landed (same freeze rule as criteria), with the same 'Start a new
wave' alternative." Anatomy matches exactly, including the named
alternative copy.

## 7. Duplicated results head — CLOSED-AT-TIP

Tree: `app/src/pages/review/ResultsTable.tsx` — `grep -n "<table\|<thead"`
returns exactly one hit, `:375-376` (`<table
className="chq-table chq-review-results-table"><thead>`). No second
`<thead>`, no stray `role="columnheader"` block anywhere else in the file.
Vendor: `docs/design/DESIGN-RULINGS.md:175` — "the expanded band repeats
the results table's exact seven-track grid... under the columns they
belong to" — the expanded band is specified to reuse the SAME grid, not
carry its own head. The file has one `<thead>`; there is nothing
duplicated to close against beyond that single declaration.

## 8. Content-status band not full-bleed — CLOSED-AT-TIP

Tree: `app/src/pages/content/ContentApp.tsx:326` —
`const pageMeasureClass = submissionId && selected ? '' : 'chq-measure-table';`
— the DeliverableDetail state's `chq-page` root now carries **no** measure
token at all (DEC-989 wave-23 amendment, comment `:315-325`), so
`.chq-content-status-band`'s `margin-inline: calc(var(--chq-pub-main-pad-x) * -1)`
bleed trick (`content.css:701`) reaches the true page edge instead of
cancelling a narrower ancestor clamp — exactly the gap the clause names
("(vw-1440)/2-34 gap; padding half fixed, margin half not"). Content
below the band still clamps via a sibling wrapper
(`content.css:730-745`, `.chq-content-page-content`).
Vendor: `docs/design/Chautauqua Content.dc.html:133`'s
`max-width:1180px` sibling-of-chrome pattern is cited directly in the
`content.css:737-742` comment as the rule this now implements; per this
task's own field-guide shape (FULL BLEED IS A POSITION NOT MARGIN), the
fix is structural — it removed the clamping ancestor rather than adding a
bigger negative margin — which is why it closes rather than merely
shifting the same bug.

## 9. Active-filter ink chip — CLOSED-AT-TIP

Tree: `src/routes/public/css/chrome.css.ts:80-91` —
`.chq-pub-activefilters-chip { background: var(--chq-ink); ...
color: var(--chq-paper); }`, with the amendment comment at `:73-79`
citing "docs/design's public+portal frame pack, line 61" for the ink-fill
rule.
Vendor: `docs/design/Chautauqua Public and Portal.dc.html:61` —
`<span style="...background:#1B1D17; color:#F4F1E8; border-radius:99px;
...">Tuesday 12 May ✕</span>` — ink fill (`#1B1D17`), paper text
(`#F4F1E8`), pill radius. Matches.

## 10. Speakers toolbar right-cluster — OPEN

Tree: `app/src/pages/speakers/GridFilters.tsx` — the toolbar renders a
text search input (`:20-27`) and a task-status `<select>` (`:29-40`) and
nothing else in the file; `grep -rn "List | Grid\|viewMode" app/src/pages/speakers/`
returns no matches anywhere in the module — there is no view-mode toggle
on the admin Speakers page at all.
Vendor: `docs/design/README.md:350` —
"`Speakers   [Search speakers…]             [All tracks ▾]                    [List | Grid]`"
— states the toolbar's right cluster is a List/Grid view toggle. The tree
has no such control. This clause re-opens: not superseded, not satisfied.

## 11. Underlined initials — UNQUOTABLE

`grep -rn "avatar\|Avatar\|initial\|Initial" docs/design/README.md
docs/design/DESIGN-RULINGS.md` returns no matches; no `.dc.html` file
mentions an avatar/initials treatment either (checked
`Chautauqua Speakers.dc.html`, the surface this clause would apply to).
`grep -rln "avatar\|Avatar" app/src/pages/speakers/` also returns nothing
— the tree has no avatar concept on this page. No vendored line states an
"underlined initials" rule and no such feature exists in the tree to
violate one. DELETED, not carried.

## 12. Blue avatars — UNQUOTABLE

Same search as #11: zero hits for "avatar" anywhere in the vendored pack,
zero hits in `app/src/pages/speakers/`. No spec claim exists to re-open
against. DELETED, not carried.

## 13. Add-track tertiary — CLOSED-AT-TIP

Tree: `app/src/pages/settings/TracksRoomsPanel.tsx:402-408` — "Add a
track" button carries `className="chq-settings-section-action
chq-link-button"` (tertiary text-link chrome, not a bordered button).
Vendor: `docs/design/Chautauqua Settings.dc.html:822` —
`<a href="#" style="font-size:13px; font-weight:700">Add a track</a>` —
a plain text link. `eval-findings.md:788-789` already lists "add-track" as
one of the two items closed prior to the Settings-remainder split; this
re-check confirms that closure still holds at `ceda66f2`.

## 14. Saved-embed single-card anatomy — CLOSED-AT-TIP (via binding DEC-785)

Note: the task brief's file pointer (`src/routes/public/saved-embed.tsx`)
is the public **resolver** route (`/embed/e/:embedId`, server-rendered
redirect/render dispatch) — it has no "card" UI at all; the admin editor
UI the clause actually concerns is `app/src/pages/settings/EmbedsPanel.tsx`
+ `SavedEmbedsPanel.tsx`.
`docs/design/README.md:280` ("The builder becomes an editor of one saved
embed... headed 'Editing · ‹name›'") describes a single-card anatomy that
the binding decision `decisions/DEC-785.md` explicitly, repeatedly amends
(wave 1, 4, 15, 19, 41 amendments in that file) — the saved list instead
reuses `PublicPagesPanel`'s existing row grammar so "no new visual
vocabulary is invented" (DEC-785 base decision), and the wave-19 amendment
replaces the two-block URL/Snippet anatomy with ONE boxed snippet readout
plus a Copy/Preview action row, citing
`docs/design/Chautauqua Settings.dc.html:1082-1090` directly.
Tree: `app/src/pages/settings/EmbedsPanel.tsx:580-603` — one
`chq-embeds-output-block` with a Snippet eyebrow, `<code>{snippet}</code>`,
and an action row of "Copy snippet" / "Copy URL" / "Preview" — matching
the wave-19/41 amendments. Per the repo's stated authority (decisions/ is
binding over docs/design/), the current anatomy is the SPEC, not a
deviation from it — CLOSED-AT-TIP.

## 15. Eight-item Settings remainder — UNQUOTABLE

`eval-findings.md:788-791` names this item's source as
`fidelity-gate8/09-settings.md` — a `chautauqua-research` file, which
(per the task brief's own framing of that repo) is NOT vendored anywhere
in this tree. `find . -iname "09-settings.md"` and
`find . -iname "fidelity-gate8*"` both return nothing. There is no
path:line anywhere in this repo — vendored `docs/design/*` or otherwise —
that enumerates what the eight items are, so there is nothing to walk a
verdict against. Per DEC-976 ("a claim without a quoted line is a
rumour"), an item whose entire content is an unvendored external file
reference is a rumour, not an open defect list. DELETED, not carried (the
two items already split out and closed by prior waves — dates 200px,
add-track — stay closed per their own citations above and elsewhere).

## Data-label fixed-track phone-table pattern — two independent tables, not a divergence risk

`app/src/pages/comms/comms.css:997-1003`
(`.chq-comms-templates-table td[data-label]::before { content: attr(data-label) ': '; ... }`)
and `:1036-1042`
(`.chq-comms-compose-table td[data-label]::before { content: attr(data-label) ': '; ... }`)
are two textually-identical rule bodies, but each is scoped to its own
table class (`.chq-comms-templates-table` vs `.chq-comms-compose-table`),
each with its own `thead { display: none }` declaration (`:1005` /
`:1014` region and `:1036` region respectively) and its own `tr`/`td`
padding. Editing one selector cannot silently change the other's
rendering — there is no shared class, mixin, or `@apply`-style include
between them, just the same hand-written CSS-only table-to-card technique
applied twice. This is a DRY smell (the same ~15 lines typed twice) but
not a divergence RISK: nothing about the coupling would let the two
tables silently drift apart in a way a developer wouldn't see in the diff
of the block they're actually editing. Two independent tables that share
a technique, not one shared vocabulary class with two callers (the shape
this wave's field guide warns SHARED VOCABULARY CLASS != WIDTH HOOK about
in the other direction).

## Summary

| # | Clause | Verdict |
|---|--------|---------|
| 1 | participation panel 420 | CLOSED-AT-TIP |
| 2 | speaker-detail grid/theads | UNQUOTABLE |
| 3 | write-failed banner anatomy | CLOSED-AT-TIP |
| 4 | upload-reject modal anatomy | CLOSED-AT-TIP |
| 5 | templates-grid overlap | CLOSED-AT-TIP |
| 6 | plan-editor draft footer | CLOSED-AT-TIP |
| 7 | duplicated results head | CLOSED-AT-TIP |
| 8 | content-status band not full-bleed | CLOSED-AT-TIP |
| 9 | active-filter ink chip | CLOSED-AT-TIP |
| 10 | speakers toolbar right-cluster | OPEN |
| 11 | underlined initials | UNQUOTABLE |
| 12 | blue avatars | UNQUOTABLE |
| 13 | Add-track tertiary | CLOSED-AT-TIP |
| 14 | saved-embed single-card anatomy | CLOSED-AT-TIP |
| 15 | eight-item Settings remainder | UNQUOTABLE |

OPEN: 1 (speakers toolbar right-cluster — no List/Grid view toggle exists
on the admin Speakers page; `docs/design/README.md:350` names one).
