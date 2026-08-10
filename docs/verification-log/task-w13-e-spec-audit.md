# task-w13-e — spec-audit @ 0ee30dd

Full detail for the `## 2026-08-10 task-w13-e — spec-audit @ 0ee30dd`
section of `docs/verification-log.md` (extracted per the
contention-decomposition of that file; see the stub entry there for the
RESULT line).

- SPEC §8 quickstart: `package.json:6-16` scripts (`dev`, `build`, `db:migrate`,
  `seed`, `test`) match `README.md:18-22` (`npm i` / `npm run db:migrate` /
  `npm run seed` / `npm run dev`) verbatim. PASS.
- README "For evaluators" section (`README.md:34-62`): persona URLs table
  present, plus a credentials table for organizer/speaker/speaker2/reviewer.
  Diffed every email+password against `docs/fixtures/sample-data.json:30-57`
  (`identities.organizer/speaker/speaker2/reviewer`) — exact match, no drift,
  no edit needed. PASS.
- CI covers typecheck + unit tests: `.github/workflows/ci.yml:13-24`
  `build-and-test` job runs `npm run build` (line 22, which is
  `tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite build` per
  `package.json:8`) then `npm test` (line 24, `vitest run`). PASS.
- SPEC §9 four named high-weight invariants, direct unit test per invariant:
  - close-date lock: `test/edit-lock.test.ts:13-43` (pending/closed not
    editable, accepted/closed remains editable, null close date never
    closes) + `test/submit-core.test.ts:32-88` (`isFormClosed`,
    `formWindowState` boundary cases). PASS, pre-existing.
  - speaker isolation (cross-account 403/404):
    `test/task-file-access.test.ts:117` `"403s for another speaker (IDOR)"`
    — a same-role, different-contact speaker is denied a task file via the
    real route handler. PASS, pre-existing.
  - hidden-speaker exclusion: `test/headshot-gate.test.ts:80`
    `"404s unauthenticated when the speaker isn't publicly visible
    (pending/hidden)"` against the DEC-067 gate built on
    `visibleSubmissionConditions()` (`src/server/repo/public.ts:24-28`),
    the same predicate every public list/agenda/schedule/gallery query
    uses. PASS, pre-existing.
  - decision-does-not-auto-email: `test/api-submissions.test.ts:258-266`
    (DEC-009 invariant #1) is a static source-scan proving neither
    `src/routes/api/submissions.ts` nor `src/server/repo/submissions.ts`
    import a mailer — strong but not behavioral. No test asserted
    `email_log` stays empty after an actual status-change call, so per
    task instructions this was ADDED: new file
    `test/spec9-invariants.test.ts`, test
    `"updateSubmissionStatuses (pending -> declined) never touches
    email_log"` — drives the real `updateSubmissionStatuses` repo
    function through a fake db that records every table touched and
    asserts `schema.emailLog` is never among them (only `schema.submission`
    is touched on a plain, non-accepting status change). PASS (new).

Full suite: `npm run build` PASS (tsc x2 + vite build clean); `npm test`
PASS — 83 test files / 862 tests, 0 failures, including the new
`test/spec9-invariants.test.ts`.

RESULT: PASS
