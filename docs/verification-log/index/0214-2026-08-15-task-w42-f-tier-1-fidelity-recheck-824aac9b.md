## 2026-08-15 task-w42-f — tier-1 fidelity recheck @ 824aac9b

QUALIFYING (advisory to the DEC-069 predicate — `classifyScope("tier-1
fidelity recheck")` matches none of triage/spec-audit/perf/walkthrough/
build+test, so this section is null per DEC-099 wave-42 amendment; it is a
FILE, NEVER FIX docs recheck, not one of the five DEC-069 slots)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DEC-644 three-sha boundary / ref-state: `git merge --no-edit main` from
worktree branch tip reported "Already up to date." `npm run ref-state`
receipt: HEAD `824aac9b3126b1a5c17ba46c5a7d153db106ed54`; newest first-parent
product-code-bearing sha `ed5c679e59828c5600cb84b51208056f7e38a445`; every
live ref (`main`, `manual-qa`, `task-custodian-w68-4`, `task-w40-e`,
`task-w40-g`, `task-w41-c`, `task-w42-c`, `task-w42-e`, `task-w42-f`,
`task-w68-d`, `task-w71-c`, `task-w71-d`, `task-w71-e`) confirmed ancestor of
HEAD. NON-ancestor refs (unrelated older/later work): `mail-rich-shape-
fallback`, `task-w17-i`, `task-w41-a/b/d/e/f`, `task-w42-a`, `task-w42-d`,
`task-w68-b/c/e`, `task-w71-a`, `task-w72-a` through `task-w72-j`.
MEASURED_SHA = `824aac9b`.

Re-derives the TIER-1 sub-clauses named in this task's brief against current
`824aac9b`, most of which were last independently read at `task-w27-g`'s
boundary `ceda66f2` (docs/verification-log/task-w27-g-fidelity-recheck-
ceda66f2.md, read in full this task rather than trusted from the pointer in
`eval-findings.md:505-511`). Full per-clause citations:
`docs/verification-log/task-w42-f-tier-1-fidelity-recheck-824aac9b.md`.

### Verdict table

| # | Sub-clause | Verdict | Citation |
|---|---|---|---|
| 1 | Compose-flow turn diet (item 1, DEC-967/task-w12-c) | CLOSED | `app/src/pages/comms/ComposeWizard.tsx:214-238` |
| 2 | CNT-S3 session-edit loop (item 2, DEC-967 wave-15 amendment) | CLOSED | `app/src/pages/submissions/SubmissionDetailPage.tsx:1022-1079,1240-1286` |
| 3 | 07 comms templates-grid overlap | CLOSED | `app/src/pages/comms/TemplatesTab.tsx:208-233` |
| 4 | 07 comms History-tab chrome | CLOSED | `app/src/pages/comms/HistoryTab.tsx:104-118` (door: `src/routes/api/exports.ts:120-147`) |
| 5 | 05 files-library upload-reject modal | CLOSED | `app/src/pages/content/UploadRejectedModal.tsx:26-64` |
| 6 | 05 files-library content-detail container | CLOSED | `app/src/pages/content/content.css:730-746`, `app/src/pages/content/ContentApp.tsx:318-326` |
| 7 | 03 FORM ANSWERS results-head | CLOSED | `app/src/pages/review/ResultsTable.tsx:375-376` |
| 8 | 03 FORM ANSWERS plan-editor footer | CLOSED | `app/src/pages/review/PlanEditor.tsx:2279-2293` |
| 9 | 09/10 CFP-edit intro/description binding | CLOSED | `src/routes/public/submit-views.tsx:427-437` |
| 10 | 04 participation/speaker-detail remaining sub-clauses | UNRECHECKED — no additional quotable clause text beyond items already CLOSED/UNQUOTABLE in task-w27-g #1/#2; source enumeration not vendored | — |
| 11 | 09/10 remaining sub-clauses (beyond CFP-edit binding) | UNRECHECKED — same rumour pattern as task-w27-g #15 (source `fidelity-gate*` files are unvendored `chautauqua-research` paths); named wave-43 owner if a vendored enumeration surfaces | — |

Nine of eleven rows reached a CLOSED verdict with a fresh file:line quote at
`824aac9b` (all nine were CLOSED-AT-TIP or newly-closed at `ceda66f2` in
`task-w27-g` and remain closed now — no regression found across the waves
between the two boundaries). Two rows are UNRECHECKED because their
"remaining sub-clauses" wording names no enumerable additional clause
anywhere in the vendored `docs/design/*` pack or this tree; task-w27-g's own
item 15 hit the identical wall (an external, unvendored `chautauqua-
research` file list) and was DELETED-not-carried on that basis — these two
rows are flagged rather than deleted since this task's brief explicitly
named them as population, but there is nothing further to quote a verdict
against without a vendored enumeration.

RESULT: PASS — 9/11 named sub-clauses re-derived with a fresh file:line
verdict at `824aac9b` (all CLOSED, zero regressions since `ceda66f2`); 2/11
correctly labelled UNRECHECKED with a named reason and no fabricated
citation. FILE, NEVER FIX honoured: zero touches to `src/**`, `app/src/**`,
`migrations/**`, `package.json`.
OPEN ITEMS: 0
