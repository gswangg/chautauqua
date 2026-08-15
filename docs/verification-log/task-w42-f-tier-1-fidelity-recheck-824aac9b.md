# task-w42-f — TIER-1 fidelity re-check @ 824aac9b (FILE, NEVER FIX)

Re-derives the TIER-1 sub-clauses named in the wave-42 brief for task-w42-f
against current `main`/HEAD `824aac9b`, cheapest-first, each with a quoted
`path:line` from the tree. `docs/verification-log/task-w27-g-fidelity-
recheck-ceda66f2.md` (the prior TIER-1 recheck, boundary `ceda66f2`, DOCS
ONLY) was read in full first per this task's brief — several of the named
sub-clauses map directly onto its already-closed items; those are
re-confirmed at the current tip rather than re-derived from scratch, since
the point of a recheck is "does this still hold," not "pretend the prior
work doesn't exist." No file under `src/**`, `app/src/**`, `migrations/**`
or `package.json` was edited by this task (DEC-453 FILE, NEVER FIX).

## 1. Compose-flow turn diet (eval-findings TIER 1 item 1) — CLOSED

Tree: `app/src/pages/comms/ComposeWizard.tsx:214-238` — a
`useEffect` guarded by `appliedDefaultTemplateRef`, comment at `:214-216`:
"w12-c (DEC-967 amendment, turn diet): step 2 must not arrive blank when
there's an obvious starting point -- the server's own first template." It
fires once templates have loaded, step is `'template'`, subject and
bodyText are both empty, and `appliedTemplateParam` (the `?template=`
landing effect) has not already fired; it then applies `templates[0]`
through the exact `setTemplateName`/`setSubject`/`setBodyText`/`setTemplateId`
path the `<select>`'s `onChange` already runs.
Decision: `decisions/DEC-967.md` "Amendment (findings wave 12)" — "RULING,
so no worker has to decide it: ... on arrival at step 2 with an empty
subject AND an empty body AND a non-empty template list, the composer
applies the FIRST template as the server returned it ... and discloses it
inline in the existing chq-comms-panel-note register." The structural half
(step-1 slot/footer, `?ids=` handoff, step-4 anatomy) was already CLOSED
per `task-w27-g`'s pointer and prior waves; this re-check confirms the diet
half named as still-open in the same DEC-967 amendment is ALSO landed at
`824aac9b`, closing eval-findings item 1 in full (both halves).

## 2. CNT-S3 session-edit loop (eval-findings TIER 1 item 2) — CLOSED

Tree: `app/src/pages/submissions/SubmissionDetailPage.tsx:1022-1079`
(title/abstract editor) and `:1240-1286` (tracks editor) — both are real
`<form className="chq-detail-edit-form" onSubmit={(e) => { ... }}>`
elements (not `<div>`s) with a keydown handler checking
`e.key === 'Escape'` (`:1028`, `:1245`) to close the editor, `Save` as
`type="submit"` (`:1079`, `:1286`), and `Cancel` as `type="button"`.
Decision: `decisions/DEC-967.md` "Amendment (findings wave 15)" — the ruling
this clause was carried under — states the prior state exactly: "`app/src/
pages/submissions/SubmissionDetailPage.tsx:1021` is still `<div
className="chq-detail-edit-form">` with a type="button" Save at :1061 ...
RULING (scoped, not a sweep): the two submission-detail inline editors
become real `<form>` elements ... with onSubmit preventing default and
calling the existing save function, Save as type="submit", Cancel as
type="button", and Escape on the form closing the editor." The tree at
`824aac9b` matches the ruling verbatim (line numbers shifted from :1021/
:1061 to :1022/:1079 by intervening waves, same shape). Carried "unowned"
for three waves per the decision text; landed since, unowned-and-open no
longer describes the current tree.

## 3. 07 comms templates-grid overlap — CLOSED (re-confirmed at 824aac9b)

Tree: `app/src/pages/comms/TemplatesTab.tsx:208-233` — the saved-templates
list is a real `<table className="chq-table chq-comms-templates-table">`
with `<thead>`/`<tbody>` (`:208-213`); each row's one control is the name
button (`:224-226`), with Delete/Duplicate/"Use in a send" living in the
editor panel per the comment at `:220-222`.
`grep -c "grid-template-columns" app/src/pages/comms/templates.css` returns
0 — no CSS grid remains to overlap.
Vendor: `docs/design/Chautauqua Comms.dc.html:239` draws the name+detail
block with a right-aligned "used" span and no action cluster in the row;
`decisions/DEC-890.md:15` names the fix as subtractive. Matches
`task-w27-g` item 5's CLOSED-AT-TIP verdict at `ceda66f2`; unchanged at
`824aac9b` beyond a small line shift.

## 4. 07 comms History-tab chrome — CLOSED

Tree: `app/src/pages/comms/HistoryTab.tsx:104-118` — the tab head renders a
breadcrumb "‹ Comms" (`:107-109`), an `<h1 className="chq-page-title">
History</h1>` (`:110`), a count/rhythm line (`:111`), and a plain
cookie-authed `<a className="chq-btn chq-btn-secondary
chq-comms-history-export" href={exportHref}>Export CSV</a>` (`:115-117`).
The comment at `:85-94` (DEC-603 wave-18 amendment) states the head
"mirrors TemplatesTab's exactly" and the export anchor targets "the SAME
email-log export the row-level exports already ship (src/routes/api/
exports.ts, kind=email-log)".
Door (this task's brief names it explicitly, verified as backend plumbing
only, not UI): `src/routes/api/exports.ts:120-147` handles `kind ===
"email-log"`, validating `contactId`/`status`/`q`/`batchId`/`since` via the
same validators `src/routes/api/email-log.ts` uses (comment `:119-122`,
DEC-027 wave-41 amendment).
Vendor: `docs/design/Chautauqua Comms.dc.html:616,620` — an `<h1>History
</h1>` paired with an `<a>Export CSV</a>` action, same pairing the tree
renders. The UI (not just the door) is landed and matches the vendored
frame; CLOSED.

## 5. 05 files-library upload-reject modal — CLOSED (re-confirmed at 824aac9b)

Tree: `app/src/pages/content/UploadRejectedModal.tsx:42` (`title="That file
was not uploaded"`), `:49` ("Choose another file" primary action), `:64`
(`<span className="chq-section-label chq-upload-rejected-kept-label">What
was kept</span>`) — anatomy unchanged from `task-w27-g` item 4's
CLOSED-AT-TIP verdict (`:26-64` at `ceda66f2`; same lines, small shift).
Vendor: `docs/design/Chautauqua Content.dc.html:439-448` — identical title,
subtitle pattern, refusal band, "What was kept" block and two actions.

## 6. 05 files-library content-detail container — CLOSED

Tree: `app/src/pages/content/ContentApp.tsx:318-326` — comment: "DEC-989
amendment (wave 23): the DeliverableDetail state used to clamp ... on
chq-page at all; DeliverableDetail delegates the 1180 measure to a [sibling
wrapper]"; `app/src/pages/content/content.css:746`
(`.chq-content-page-content {`) with the comment at `:741` citing
"html:133's max-width:1180px sibling of its own header/status chrome" as
the rule this implements, and `:690` noting `.chq-content-page-content
(below) delegates the 1180 measure to a [sibling]`.
Vendor: `docs/design/Chautauqua Content.dc.html:133` —
`max-width:1180px` sibling-of-chrome pattern.
Same citation family as `task-w27-g` item 8 ("content-status band not
full-bleed"), which the wave-42 brief's naming of "content-detail
container" as a distinct sub-clause maps onto directly — the container is
the sibling wrapper the band's fix depends on, and it is present and
unchanged since `ceda66f2`.

## 7. 03 FORM ANSWERS results-head — CLOSED (re-confirmed at 824aac9b)

Tree: `app/src/pages/review/ResultsTable.tsx:375-376` —
`grep -n "<table\|<thead" app/src/pages/review/ResultsTable.tsx` returns
exactly one hit pair, `<table className="chq-table
chq-review-results-table"><thead>`. No second `<thead>` and no stray
`role="columnheader"` block elsewhere in the file.
Vendor: `docs/design/DESIGN-RULINGS.md:175` — "the expanded band repeats
the results table's exact seven-track grid ... under the columns they
belong to" — specified to reuse the SAME grid, not carry its own head.
Matches `task-w27-g` item 7's CLOSED-AT-TIP verdict.

## 8. 03 FORM ANSWERS plan-editor footer — CLOSED (re-confirmed at 824aac9b)

Tree: `app/src/pages/review/PlanEditor.tsx:2279`
(`<div className="chq-review-editor-footer-row">`) and `:2290`
("Delete plan is unavailable once a review has landed — start a new wave
instead."). "Delete plan" renders as `chq-link-button` (tertiary text
link), `disabled` when `planHasSubmittedReview`.
Vendor: `docs/design/DESIGN-RULINGS.md:50` — "Delete plan: RESTYLE, one
line: a tertiary link in the plan editor footer, disabled once any review
has landed ... with the same 'Start a new wave' alternative." Matches
`task-w27-g` item 6's CLOSED-AT-TIP verdict exactly (line numbers shifted
from `:2278-2293` to `:2279-2293`).

## 9. 09/10 CFP-edit intro/description binding — CLOSED (independently re-read)

eval-findings.md:539-541 flagged this as "likely CLOSED via
`submit-views.tsx:421-431` (DEC-976 wave-25 amendment), not independently
re-read this task" — this task independently reads it.
Tree: `src/routes/public/submit-views.tsx:427-437` — comment: "DEC-986
(wave 24 amendment): the organiser's own CFP intro (form.description,
authored/validated in Settings via PATCH /api/v1/forms) takes over the lede
when present -- the computed track/format sentence above is a fallback for
forms that never set one." Code: `const authoredIntroParagraphs =
(form.description ?? '').split(/\n\s*\n/).map((block) =>
block.trim()).filter((block) => block.length > 0);` (`:434-437`), split on
blank lines into one `<p>` per paragraph, escaped by Hono JSX by default
(comment `:432-433`).
Note: eval-findings cites `DEC-976`; the comment in the tree cites
`DEC-986` — both decisions exist (`decisions/DEC-976.md`,
`decisions/DEC-986.md`); the binding is confirmed present in the tree
regardless of which decision number eval-findings' prose attributed it to.
CLOSED, independently verified (not carried on the "likely" hedge).

## 10. 04 participation/speaker-detail remaining sub-clauses — UNRECHECKED

`eval-findings.md:528-532` names two sub-items of "04" as already CLOSED
("search excluded from hasActiveNarrowing", "reminders modal
localhost:8799") and says "remaining sub-clauses VERIFIED-OPEN-NOT-
RECHECKED" without naming them. `task-w27-g`'s items 1 and 2 (participation
panel 420, speaker-detail grid/theads) are the only two 04-surface clauses
independently derivable from the vendored pack — both already carry
verdicts (CLOSED-AT-TIP and UNQUOTABLE respectively, re-confirmed present
and unchanged at `824aac9b` by spot-check: `app/src/pages/speakers/
speakers.css:406` still `width: 420px;`, `app/src/pages/speakers/
SpeakerDetailPage.tsx` still renders `role="table"` sections with no
`<thead>`). No further quotable "remaining" sub-clause exists anywhere in
`docs/design/*` for this surface beyond what items 1/2 already cover.
UNRECHECKED — reason: the "remaining" wording names no additional
enumerable clause; nothing further to derive without inventing one.

## 11. 09/10 remaining sub-clauses (beyond CFP-edit binding) — UNRECHECKED

`eval-findings.md:538-543` lists "TBD room public" (already CLOSED, no
literal under `src/routes/public`), the CFP-edit binding (item 9 above,
now independently CLOSED), and "speakers toolbar right-cluster" (moved to
TIER 0 `DISMISSED-VERIFIED-CLOSED`, `eval-findings.md:235-244` —
`task-w29-f` found the named controls already built PUBLIC-side:
`SpeakerViewToggle`/`TrackFacetSelect` at `src/routes/public/
speakers.tsx:20-58,72-103`, not the admin-side gap `task-w27-g` item 10
mistakenly re-opened against). After accounting for those three, no further
09/10 sub-clause is named anywhere in this repo's vendored pack or
`eval-findings.md`'s prose. Same rumour pattern as `task-w27-g` item 15
(source `fidelity-gate*` files live only in the unvendored
`chautauqua-research` repo). UNRECHECKED — reason: no enumerable remainder
exists in the tree to quote a verdict against; flagged rather than deleted
since this task's brief named "09/10 remaining sub-clauses" as population.

## Summary

| # | Sub-clause | Verdict |
|---|---|---|
| 1 | Compose-flow turn diet | CLOSED |
| 2 | CNT-S3 session-edit loop | CLOSED |
| 3 | 07 comms templates-grid overlap | CLOSED |
| 4 | 07 comms History-tab chrome | CLOSED |
| 5 | 05 files-library upload-reject modal | CLOSED |
| 6 | 05 files-library content-detail container | CLOSED |
| 7 | 03 FORM ANSWERS results-head | CLOSED |
| 8 | 03 FORM ANSWERS plan-editor footer | CLOSED |
| 9 | 09/10 CFP-edit intro/description binding | CLOSED |
| 10 | 04 participation/speaker-detail remaining sub-clauses | UNRECHECKED |
| 11 | 09/10 remaining sub-clauses | UNRECHECKED |

OPEN: 0. CLOSED: 9. UNRECHECKED: 2 (both flagged with a named reason, no
padded verdict). Zero regressions found between `ceda66f2` and `824aac9b`
across every re-confirmed clause.
