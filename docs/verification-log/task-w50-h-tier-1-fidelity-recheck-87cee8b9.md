# task-w50-h — TIER-1 fidelity re-check @ 87cee8b9 (DOCS ONLY, FILE NEVER FIX)

Re-derives, at this task's own runtime, the six named sub-clauses from
`docs/eval-findings.md` TIER 1 item 3 that have carried the label
VERIFIED-OPEN-NOT-RECHECKED for eight waves. Per the task brief's mandate,
`docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` was read in
full first (not just trusted via the eval-findings pointer note at
`docs/eval-findings.md:838-844`). `docs/verification-log/task-w42-f-tier-1-
fidelity-recheck-824aac9b.md` was also read — it already re-derived the
same six clauses once, at boundary `824aac9b`; this task confirms each
verdict still holds at the current tip and adds a named render test/gate
row per clause per the brief's requirement. No file under `src/**`,
`app/src/**`, `migrations/**` or `package.json` was touched (DEC-453 FILE,
NEVER FIX; task is docs-only, DEC-069 w50 scope classifies to no slot).

Branched off `main` at `87cee8b9` ("scribe wave 50"); all six clauses
re-derived against this tip.

## 1. Comms templates-grid overlap — CLOSED

Tree: `app/src/pages/comms/TemplatesTab.tsx:208-233` — the saved-templates
list is a real `<table className="chq-table chq-comms-templates-table">`
with `<thead>`/`<tbody>` (`:211-216`, `:218-233`); each row carries exactly
two cells (Name `:224`, Last used `:230`) and no per-row verbs — Delete,
Duplicate and "Use in a send" live in the editor panel below (comment at
`:220-222`). `grep -c "grid-template-columns" app/src/pages/comms/
templates.css` returns 0 — no CSS grid remains in this file to overlap.
Vendor: `docs/design/Chautauqua Comms.dc.html:239` —
`<div style="display:grid; grid-template-columns:1fr auto; ...">` drawing a
name+detail block with a right-aligned "used" span and no action cluster in
the row; `decisions/DEC-890.md:15` names the original fix as subtractive
("the editor panel overlaps the cluster... the fix is subtractive").
Matches `task-w27-g` item 5 and `task-w42-f` item 3's CLOSED verdicts,
unchanged since `ceda66f2`/`824aac9b` beyond a small line shift.
Named test: `app/src/pages/comms/TemplatesTab.render.test.tsx:114` —
`expect(document.querySelector('thead')).toBeInTheDocument()` — would fail
on a revert to the old grid-with-row-verbs anatomy (no `<thead>` in a CSS
grid).

## 2. Comms History-tab chrome — CLOSED

Tree: `app/src/pages/comms/HistoryTab.tsx:104-118` — the tab head renders a
breadcrumb "‹ Comms" (`:107-109`), an `<h1 className="chq-page-title">
History</h1>` (`:110`), a count/rhythm line (`:111`), and a plain
cookie-authed `<a className="chq-btn chq-btn-secondary
chq-comms-history-export" href={exportHref}>Export CSV</a>` (`:114-116`,
`exportHref` built at `:99-102` against `/api/v1/events/:eventId/export/
email-log`). The eval-findings note (`docs/eval-findings.md:855-857`) had
this VERIFIED-OPEN and pointed at the Export door
(`src/routes/api/exports.ts:120-147`) as unverified UI; `task-w42-f` item 4
already closed the UI half at `824aac9b` and this recheck confirms it is
still landed and unchanged at `87cee8b9` — the eval-findings VERIFIED-OPEN
label is now stale (superseded by the w42 closure this task re-confirms).
Vendor: `docs/design/Chautauqua Comms.dc.html:616,620` — `<h1>History</h1>`
paired with an `<a>Export CSV</a>` action, the same pairing the tree
renders.
Named test: `app/src/pages/comms/HistoryTab.render.test.tsx:93-115` —
"renders the head with a count line built from total + rhythm, and an
Export CSV anchor scoped to email-log + the live q" — asserts
`screen.getByRole('link', { name: 'Export CSV' })` and inspects its href;
would fail on a revert that dropped the head chrome or export anchor.

## 3. Content upload-reject modal — CLOSED

Tree: `app/src/pages/content/UploadRejectedModal.tsx:42`
(`title="That file was not uploaded"`), `:49` ("Choose another file"
primary action), `:64` (`<span className="chq-section-label
chq-upload-rejected-kept-label">What was kept</span>`) — anatomy unchanged
from `task-w27-g` item 4 / `task-w42-f` item 5's CLOSED-AT-TIP verdicts
(same lines, small shift from `ceda66f2`).
Vendor: `docs/design/Chautauqua Content.dc.html:439-448` — identical title
("That file was not uploaded"), subtitle pattern, refusal band, "What was
kept" block and the same two actions ("Choose another file" primary /
Cancel secondary).
Named test: `app/src/pages/content/UploadZone.render.test.tsx:49,59,62` —
asserts `dialog` has text content `'That file was not uploaded'` and
`'What was kept'`, plus `screen.getByRole('button', { name: 'Choose
another file' })` — would fail on a revert dropping any of these three
anatomy pieces.

## 4. Content content-detail container — CLOSED

Tree: `app/src/pages/content/ContentApp.tsx:328`
(`const pageMeasureClass = submissionId && selected ? '' : 'chq-measure-
table';`) — the DeliverableDetail state's `chq-page` root carries no
measure token (DEC-989 wave-23 amendment, comment `:315-326`);
`app/src/pages/content/content.css:746` (`.chq-content-page-content {`)
with the comment at `:731-745` citing "html:133's max-width:1180px
sibling of its own header/status chrome" as the rule implemented — the
header block and status band sit outside this wrapper (bleed full width)
while the reading body below clamps to 1180.
Vendor: `docs/design/Chautauqua Content.dc.html:133` — `max-width:1180px`
sibling-of-chrome pattern, cited directly in the `content.css` comment.
Matches `task-w27-g` item 8 ("content-status band not full-bleed") and
`task-w42-f` item 6's CLOSED verdicts — the wave-42 brief's naming of
"content-detail container" as its own sub-clause maps onto the same
citation family (the container IS the sibling wrapper the band's bleed
fix depends on).
Named test: `app/src/pages/content/DeliverableDetail.render.test.tsx:614`
— "the header block and status band sit OUTSIDE
.chq-content-page-content, which wraps only the reading body below them"
— queries `.chq-content-page-content` (`:629`) and its computed rule body
(`:654`) directly; would fail on a revert that re-clamped the whole
`chq-page` root or removed the sibling wrapper.

## 5. Review results-head — CLOSED

Tree: `app/src/pages/review/ResultsTable.tsx:375-376` —
`grep -n "<table\|<thead" app/src/pages/review/ResultsTable.tsx` returns
exactly one hit pair (`<table className="chq-table
chq-review-results-table"><thead>`). No second `<thead>`, no stray
`role="columnheader"` block anywhere else in the file.
Vendor: `docs/design/DESIGN-RULINGS.md:175` — "the expanded band repeats
the results table's exact seven-track grid... under the columns they
belong to" — the expanded band is specified to reuse the SAME grid, not
carry its own head.
Matches `task-w27-g` item 7 and `task-w42-f` item 7's CLOSED verdicts,
unchanged.
Named test: `app/src/pages/review/ResultsTable.render.test.tsx:131-132`
(and repeated at `:264-269`, `:322`, `:366-367`, `:620`) —
`document.querySelector('table.chq-review-results-table')` then
`table.querySelectorAll('thead th')` — every assertion targets the single
table's single `<thead>`; a second `<thead>` or duplicated head block would
break the header-label extraction these tests rely on.

## 6. Review plan-editor footer — CLOSED

Tree: `app/src/pages/review/PlanEditor.tsx:2279-2290` — a
`chq-review-editor-footer-row` (`:2279`) with "Delete plan" rendered as a
`chq-link-button` (tertiary text link, not a bordered button, `:2286`),
disabled when `planHasSubmittedReview`, with adjacent caption "Delete plan
is unavailable once a review has landed — start a new wave instead."
(`:2290`).
Vendor: `docs/design/DESIGN-RULINGS.md:50` — "Delete plan: RESTYLE, one
line: a tertiary link in the plan editor footer, disabled once any review
has landed (same freeze rule as criteria), with the same 'Start a new
wave' alternative." Anatomy matches exactly, including the named
alternative copy.
Matches `task-w27-g` item 6's CLOSED-AT-TIP verdict, unchanged.
Named test: `app/src/pages/review/PlanEditor.render.test.tsx:1815-1837`
("renders Delete plan as a tertiary text link in the editor footer, not on
the 'Who reviews what' section head") asserts
`deleteLink.closest('.chq-review-editor-footer-row')` is non-null; and
`:1844-1865` ("disables Delete plan once a review has landed, naming
'Start a new wave' as the alternative") — either test fails on a revert
that moved the control or restyled it as a bordered button.

## Summary

| # | Sub-clause | Verdict |
|---|------------|---------|
| 1 | Comms templates-grid overlap | CLOSED |
| 2 | Comms History-tab chrome | CLOSED |
| 3 | Content upload-reject modal | CLOSED |
| 4 | Content content-detail container | CLOSED |
| 5 | Review results-head | CLOSED |
| 6 | Review plan-editor footer | CLOSED |

OPEN ITEMS: 0 (no CONFIRMED-DEFECT rows this task; all six sub-clauses in
the bounded population close with a quoted path:line pair plus a named
render test that would fail on revert). The admin Speakers toolbar
right-cluster row remains VOID per this task's brief and was not touched.
