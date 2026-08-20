# Frame control-label audit (v12 mobile campaign)

**The test is the source of truth. This file is a snapshot** taken while
writing `test/frame-control-label.scan.test.ts` (DEC-976/DEC-967 wave-128,
task w3-j). If this document and the test ever disagree, the test is right —
re-run it, don't edit this file to match a stale belief.

```
npx vitest run test/frame-control-label.scan.test.ts
```

## What this measures

Every v12 `.dc.html` phone frame (`width:390px`/`height:844`) draws two kinds
of control label: words in its docked footer, and `<a min-height:44px>`
anchor text. This audit asks whether the app's own source (`app/src/**`,
`src/**`, comments stripped, HTML entities decoded, non-test files only)
contains that exact word somewhere — i.e. whether the control the frame draws
has a corresponding literal string in the code that would render it.

A "no" here does not by itself prove a bug: some labels are fixture noise
(the frame's own mock data) and some are correctly composed at render time
from parts (a shared component, a counter, a template literal) rather than
written as one literal string. Both of those are excluded, by name, in the
test file, each pinned to an exact `file:line:label` so a pack re-cut breaks
the pin loudly rather than silently widening the exclusion.

## Surviving unmatched rows (real gaps), by frame

These are the rows the test's `FOOTER_LABEL_CEILING` (currently `6`) grades.
Each is a literal frame label that is not present, verbatim, anywhere in
non-test app source, and is not covered by either exclusion table.

| Frame | File:line | Label | Owning surface |
|---|---|---|---|
| Overview | `Chautauqua Overview.dc.html:277` | "Place the other six ›" | Overview / home screen — no matching disclosure control found in `app/src` or `src` |
| Portal · Your tasks | `Chautauqua Public and Portal.dc.html:493` | "Mark the release signed" | Portal task-detail footer action — no matching control found |
| Portal · Hotel stay form | `Chautauqua Public and Portal.dc.html:519` | "Send this in" | Portal form-submit footer action — no matching control found |
| Portal · Your session | `Chautauqua Public and Portal.dc.html:588` | "Upload slides" | Portal session footer action — no matching control found |
| Reviewer scorecard · `/review/plans/:id/submissions/:id` | `Chautauqua Review.dc.html:295` | "Read the full submission" | Reviewer scorecard disclosure — no matching control found |
| Plan editor · 390 | `Chautauqua Review.dc.html:666` | "Save the plan" | Review plan editor footer action — no matching control found |

## Exclusions applied (not counted as gaps)

### Fixture — the frame's own mock content wearing control geometry

| File:line | Label | Reason |
|---|---|---|
| `Chautauqua Agenda.dc.html:193` | "Docs That Answer Back" | mock session-title fixture |
| `Chautauqua Agenda.dc.html:194` | "DFC-033 · lightning talk, 10 min" | mock session-code/format fixture |
| `Chautauqua Contacts.dc.html:434` | "Email Priya" | mock quick-action naming a fictional contact |
| `Chautauqua Public and Portal.dc.html:464` | "Priya Raman · Latticework Systems" | mock speaker-identity fixture |

### Composed — the app assembles the label from parts at render time

| File:line | Label | Composing expression |
|---|---|---|
| `Chautauqua Public and Portal.dc.html:478/507/533/565/1563` | "‹ Your portal" | `PortalBackLink`'s `&lsaquo; {portalBackLinkLabel(props.to)}` (`src/routes/portal/shared.tsx`) |
| `Chautauqua Public and Portal.dc.html:602/1306` | "‹ Your session" | same `PortalBackLink` composition |
| `Chautauqua Contacts.dc.html:524` | "‹ Duplicates" | `MergePage.tsx`'s phone-hidden prefix span |
| `Chautauqua Submissions.dc.html:358` | "‹ Triage" | `.chq-detail-back-short` (`app/src/pages/submissions/SubmissionDetailPage.tsx`) |
| `Chautauqua Content.dc.html:279` | "Approve 2" | `countOf`-built `Approve {selectedIds.size}` (`app/src/pages/content/SessionList.tsx`) |
| `Chautauqua Content.dc.html:256` | "All 5" | `countOf`-built `All {items.length}` (`app/src/pages/content/ContentApp.tsx`) |
| `Chautauqua Review.dc.html:283/936` | "‹ Wave 2 queue" | scorecard's `&lsaquo; {plan.name} queue` (`app/src/pages/review/Scorecard.tsx`) |

## Not in scope for this ledger

This ledger does not itself close any gap — it names them for a planner to
schedule. It also does not widen its own population past footers and
`<a min-height:44px>` anchors; a wider population (any `<span min-height:...>`)
was tried during measurement and produces mostly data-chip noise, not real
control labels (see the test file's own header comment).
