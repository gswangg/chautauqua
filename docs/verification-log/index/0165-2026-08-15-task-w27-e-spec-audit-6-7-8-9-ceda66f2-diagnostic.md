## 2026-08-15 task-w27-e — spec-audit §6/§7/§8/§9 @ ceda66f2 [DIAGNOSTIC]

DEC-069 static-audit lane, widened per DEC-063's wave-27 amendment. §8/§9
retired to five citations (no re-check): `npm run deploy` (package.json:21),
four-persona local bring-up (README.md:48-54), "For evaluators"
(README.md:181), seed-as-grader-package (same block), MIT license
(LICENSE:1). Full detail: docs/verification-log/task-w27-e-spec-audit-ceda66f2.md

§7-1 (D1 indexes on every FK + (event_id,status) + (event_id,slug)): all 65
FK columns across `src/db/schema/*.ts` cross-checked against `index()`/
`uniqueIndex()` in the same files — zero uncovered FK columns.
`submission_event_id_status_idx` (submissions.ts:40) covers
(event_id,status); `event_slug_idx` (event.ts:28) covers slug (event IS the
event row, no separate (event_id,slug) child table exists).

§7-2 (SPA code-split by route): `app/src/App.tsx:15-50` — every one of the
15 page components is wrapped via `lazy(pageLoaders.X)`; `ELEMENT_BY_PATTERN`
(App.tsx:75) is typed `Record<(typeof ADMIN_ROUTE_PATTERNS)[number],
ReactNode>` so a route with no lazy element is a compile error. No static
page import found.

§7-3 (initial bundle < 300 KB gz): budget constant
`scripts/bundle-check-lib.ts:5` (`BUDGET_BYTES = 300 * 1024`). No wave-27
lane has landed a measured number (task-w27-b's receipt built but did not
run bundle:check). Last confirmed measurement: 69.19 KB gz vs 300 KB budget
at wave-26 `73f380f2` (docs/verification-log.md:3617-3619) — two `app/src`
files (incl. a 1-line functional change to SubmissionDetailPage.tsx) moved
since then; not re-measured against S. Marked pending-at-S.

§6-4 (parameterized queries only): grepped `src/**` for raw string
interpolation into `.prepare()/.run()/.exec()` template literals outside
drizzle's `sql` tag — zero hits. All interpolation sites use `sql\`...\``
with drizzle column refs/bound values (e.g. src/server/repo/form-roles.ts:17
documents "never string-concatenated").

§6-5 (no HTML content-type served / secrets hygiene): `src/domain/
files.ts:539-550` `assertServedContentTypeHeader` throws if content type
starts with `text/html`; called at the sole file-serve route
`src/routes/files.ts:674`, which also sets `X-Content-Type-Options: nosniff`
and `Content-Disposition: attachment` for non-images (files.ts:677,680).
`.gitignore:9` = `.dev.vars`.

§6-6 (eval-rubric coverage): `test/rubric-coverage-enumeration.scan.test.ts`
is a live bidirectional gate (116-id population re-derived from
`docs/eval-rubric/*.yaml` at test time, vs a 116-row hand-transcribed
ledger at rubric-coverage-enumeration.scan.test.ts:102-248). Re-ran at S:
all 15 tests PASS (population count, per-file counts, exactly-one-ledger-row
both directions, all cited artifacts exist on disk, all waived rows name a
DEC id, zero problems overall). 3 waived rows (ABS-14/DEC-272, SPK-01 and
SPK-04/DEC-340) all name a governing DEC.

INVALIDATED BY: src/**, app/src/**, migrations/**, SPEC.md, README.md, docs/eval-rubric/**
OPEN ITEMS: 1
RESULT: PASS — 5 of 6 widened §6/§7 items confirmed (FK-index coverage
complete, code-split confirmed, no raw-SQL interpolation, HTML content-type
guard + secrets hygiene confirmed, rubric-coverage scan green at S); 1 item
(§7-3 bundle size) pending-at-S, no wave-27 measurement landed, last known
value (wave 26) is well inside budget.

