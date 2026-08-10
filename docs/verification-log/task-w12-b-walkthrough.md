# task-w12-b — walkthrough @ f6e3422

Full detail for the `## 2026-08-10 task-w12-b — walkthrough @ f6e3422`
section of `docs/verification-log.md` (extracted per the
contention-decomposition of that file; see the stub entry there for the
header/RESULT summary).

Note: task order specified sha f6e3422; main had advanced to 01c6ace
(merge task-w11-a) by the time this worktree was created from main, so
that is the commit actually verified.

Replicated `.github/workflows/ci.yml` lines 57-85 (the `walkthrough` job)
locally: `npm ci --no-audit --no-fund`, `npm run db:migrate`, `npm run
seed`, `npx wrangler dev` in the background, polled `/health` until up,
then `npm run walkthrough` (DEC-062 order: producer -> review -> speaker
-> public -> data).

Note on port: port 8787 was already bound by another concurrently-running
worktree's `wrangler dev` process at the time of this run (a swarm-wide
resource conflict, not a product defect); the first attempt's `curl -sf
http://localhost:8787/health` polling loop reported "up" against that
other process's server, and the review module then failed
(`org2-organizer POST /login` → `expected 302, got 401`) because the
throwaway second-org row inserted via `wrangler d1 execute --local` from
this worktree landed in *this worktree's* local D1 state, not the other
process's. Re-ran wrangler dev on port 8797 (this worktree only) and
re-polled `/health` on that port before invoking `npm run walkthrough
-- --url http://localhost:8797`; all five modules then passed cleanly.
No product-code or walkthrough-script fix was needed — this was a
local port collision between two concurrently-active worker worktrees,
not a defect in the CI job itself (CI runs one job per runner, so this
collision cannot occur there).

- install (`npm ci --no-audit --no-fund`): PASS.
- build (`npm run build`): PASS — no type errors, vite build succeeded.
- `npm run db:migrate`: PASS — all 9 migrations applied (0000-0008).
- `npm run seed`: PASS — D1 rows + 6 R2 objects seeded.
- `wrangler dev` + `/health` poll: PASS (port 8797, after the 8787
  collision described above).
- `npm run walkthrough` (producer -> review -> speaker -> public -> data):
  ALL PASS.
  - PASS producer (J1, J2, J3, J5)
  - PASS review (J4 — queue ordering/anonymization/scorecard/cap/authz/
    remind/results/CSV, all `ok`)
  - PASS speaker (J6/J7/J8 — onboarding tasks, portal, invitations,
    deliverable versioning, comment thread, content-approval gate, all
    `ok`)
  - PASS public (J9/J10 — agenda scheduling, conflict surfacing,
    auto-schedule, all public/embed surfaces, visibility gates, all `ok`)
  - PASS data (J11/J12 — contacts/CSV import/merge/segments/bulk-email
    cap, bearer tokens, exports, `/docs/api`, all `ok`)

No FAIL lines, no PLANNER: lines. All five walkthrough modules green on
this run; no product-code changes were required.
