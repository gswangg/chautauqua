# task-w16-d — spec-audit @ 7ac6aef

Full detail for the `## 2026-08-10 task-w16-d — spec-audit @ 7ac6aef`
section of `docs/verification-log.md`. Wave-16 gate re-run (DEC-077,
code-frozen, fully parallel lanes) in a fresh worktree of `main` at
`7ac6aef` ("scribe wave 16"). Confirmed via `git diff 7c4101c..HEAD --stat`
that no source/test/config file changed since the w15-e spec-audit ran at
`7c4101c` — the only diffs are `decisions/DEC-077.md`, `field-guide/
index.md`, `src/decisions.ts` (+1 line, the `DEC_077` constant), and prior
gates' `docs/verification-log*` entries, all non-code-bearing scribe
bookkeeping under DEC-077/DEC-069. This is therefore a re-verification of
the w15-e findings against the current sha, not a re-discovery — LOG-ONLY
lane, no tests added per DEC-077 (code freeze).

- SPEC §8 quickstart vs README: `package.json` `scripts` (`dev`, `build`,
  `db:migrate`, `seed`, `perf:seed`, `perf:smoke`, `bundle:check`,
  `walkthrough`, `test`) all present and match `README.md`'s Quickstart
  block verbatim (`npm i` / `npm run db:migrate` / `npm run seed` / `npm
  run dev`), plus the Verification section referencing `npm run
  walkthrough` and the CI `walkthrough` job. PASS.
- README "For evaluators" credentials table (`README.md`) diffed against
  `docs/fixtures/sample-data.json` `identities.{organizer,speaker,
  speaker2,reviewer}` via `python3 -c` reading the JSON directly: all four
  email+password pairs (`sbek-organizer@example.com` /
  `SbekTest!2027-org`, `sbek-speaker@example.com` / `SbekTest!2027-spk`,
  `sbek-speaker2@example.com` / `SbekTest!2027-spk2`,
  `sbek-reviewer@example.com` / `SbekTest!2027-rev`) match exactly, no
  drift since w15-e. PASS.
- CI (`.github/workflows/ci.yml`): `build-and-test` job runs `npm run
  build` (`tsc --noEmit && tsc --noEmit -p app/tsconfig.json && vite
  build`, i.e. typecheck for both worker and app tsconfigs), then `npm run
  bundle:check`, then `npm test` (vitest run). A separate `perf-smoke` job
  and a separate `walkthrough` job (DEC-063) each bring up `wrangler dev`
  against a freshly migrated+seeded local D1 and run `npm run perf:smoke`
  / `npm run walkthrough` respectively. All four checks named in the task
  (typecheck, test, bundle:check, walkthrough job) present. PASS,
  unchanged since w13-e/w15-e.
- SPEC §9 four named invariants, each mapped to a concrete existing test
  (re-grepped line numbers at this sha to confirm no drift):
  - close-date lock: `test/edit-lock.test.ts` (pending/closed not
    editable, accepted/closed remains editable, null close date never
    closes) + `test/submit-core.test.ts` (`isFormClosed`,
    `formWindowState` boundary cases, DEC-036).
  - speaker isolation (cross-account 403/404):
    `test/task-file-access.test.ts:117`
    `it("403s for another speaker (IDOR)", ...)`.
  - hidden-speaker exclusion: `test/headshot-gate.test.ts:80`
    `it("404s unauthenticated when the speaker isn't publicly visible
    (pending/hidden)", ...)` against the DEC-067 gate built on
    `visibleSubmissionConditions()` (`src/server/repo/public.ts`), the
    same predicate every public list/agenda/schedule/gallery query uses.
  - decision-status-change-never-auto-emails:
    `test/spec9-invariants.test.ts:58`
    `it("updateSubmissionStatuses (pending -> declined) never touches
    email_log", ...)` — drives the real `updateSubmissionStatuses` repo
    function through a fake db that records every table touched and
    asserts `schema.emailLog` is never among them.
  All four PASS, pre-existing, files/line numbers unchanged since w15-e
  (no code has landed between `7c4101c` and this sha, so no invariant
  regressed and no new gap was introduced — nothing lacked coverage that
  would force a `RESULT: FAIL` under the code-freeze rule).
- DEC-005 route map spot-check against `src/index.ts` mounts: confirmed
  `src/index.ts` is the sole `app.route()` call site outside
  `src/server/app.ts` (DEC-012/013/035 — base app bootstrap only, no
  mounting) via the file's own header comment and a `grep -rn
  "app.route" src/*.ts`. Verified prefixes named in `decisions/DEC-005.md`
  against the actual mount list: `/api/v1` (events, portal-config,
  submissions, contacts, overview, views, agenda, tasks, file-api
  sub-apps), `/` (auth, file-serve, email-log, forms, comms,
  public-submit, review, me, tokens, exports, users, headshot-serve,
  public, docs, root, dev-mailbox — gated by `guardDevMailbox`),
  `/portal` (portal, portal-profile, portal-tasks, portal-edit). Spot-
  checked leaf routes inside sub-apps: `src/routes/public.tsx` defines
  `/e/:eventSlug/${surface}`, `/embed/:eventSlug/:surface`,
  `/e/:eventSlug/schedule.ics`; `src/routes/files.ts` defines
  `/files/:fileId` and `/files/:fileId/comments`. All match
  `decisions/DEC-005.md`'s route map. PASS.

Full suite in this worktree: `npm run build` PASS (tsc x2 + vite build
clean, bundle sizes unchanged from w15-d/w15-e); `npm test` PASS — 89 test
files / 898 tests, 0 failures (identical count to w15-e, confirming zero
code drift between `7c4101c` and `7ac6aef`).

No named SPEC §9 invariant, README/package.json quickstart command, CI
check, or DEC-005 route-map string lacked coverage or drifted at this sha.
Per DEC-077 this is a log-only re-verification lane — no test was added
(no gap was found that would require one).

RESULT: PASS
