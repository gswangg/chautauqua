## 2026-08-15 task-w49-h — forms/CFP-integrity adjudication @ d578709a

NOT QUALIFYING (adjudication-only lane inside a code wave — DEC-069: a gate
inside a code wave can never qualify)

INVALIDATED BY: src/** app/src/** migrations/** package.json

DOCS ONLY (DEC-358, DEC-069): no file under `src/`, `app/src/`,
`migrations/`, `scripts/`, or `package.json` was touched. Adjudicates the
CFP form-builder and public-submit surface — `src/routes/api/forms.ts`,
`src/forms/{builder,visibility,rule-match,validate,types}.ts`,
`src/server/repo/forms.ts`, `src/lib/submit-core.ts`,
`src/routes/public/submit*.tsx`, `src/server/repo/submit.ts` — never
adjudicated by wave 45's six lanes. Full derivation, citations, and the
falsifying check for the one confirmed row: `docs/verification-log/
task-w49-h-forms-cfp-integrity-adjudication-d578709a.md`.

| # | Claim | Verdict |
|---|-------|---------|
| 1 | `createField` position allocation is atomic (no duplicate-position race) | CONFIRMED-DEFECT (`src/server/repo/forms.ts:369-392`, read-then-write `maxPosition`; no `uniqueIndex` on `position`; same class DEC-100's `submissionSeqSubquery` was built to retire) |
| 2 | `MAX_FORM_FIELDS` cap enforced atomically | ADVISORY (`src/routes/api/forms.ts:171-176`, same read-then-write window as #1, bounded consequence, same-org self-inflicted only) |
| 3 | `save-draft` needs its own same-origin pre-check like final-submit | NOT-A-DEFECT (`src/routes/public/submit-draft.tsx:29` mounts `csrfForm`, which unconditionally enforces the DEC-544 double-submit rule; final-submit's extra pre-check is a UX short-circuit, not an independent CSRF control) |
| 4 | `reorderFields` needs a transaction around its per-row UPDATE loop | DELIBERATE-BY-DESIGN (`src/server/repo/forms.ts:525-535`; matches DEC-079 wave-26's stated codebase convention — "safety rests on idempotence, not atomicity" — and reorder is idempotent on retry, unlike #1) |
| 5 | `save-draft` must validate `trackIds` against the form's offered tracks before storing | NOT-A-DEFECT (`src/routes/public/submit-draft.tsx:71,127`; unvalidated scratch state addressable only by the submitter's own draft cookie, re-validated for real by `validateTrackChoice` at final submit before any write) |
| 6 | `rule-match.ts`/`visibility.ts` transitive fixed point and typed canonicalization | not a defect (inspection-verified monotone fixed point + existing browser/server parity proof in `test/form-render-rules.test.ts`, cited not re-run) |

No product test run (per this task's instruction: adjudication only,
citation-based verdicts, no product test executed).

RESULT: FAIL — NOT QUALIFYING: adjudication-only lane inside a code wave, per
DEC-069 it can never qualify for a gate slot regardless of content;
adjudication itself is complete: 1 CONFIRMED-DEFECT filed (UNOWNED),
1 ADVISORY, 1 DELIBERATE-BY-DESIGN, 3 NOT-A-DEFECT.
OPEN ITEMS: 1
