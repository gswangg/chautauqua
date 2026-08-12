# 2026-08-10 task-w4-b — walkthrough @ 3878d4f

Full detail for the `## 2026-08-10 task-w4-b — walkthrough @ 3878d4f` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

Fresh worktree of `main` (`79c4bb3`); derived code-bearing sha `3878d4f`
per DEC-091/093 (all commits since are scribe/bookkeeping/log-only-lane;
`git diff --stat 3878d4f..HEAD` excluding verification-log/eval-findings
touches only new DEC-090..093 docs, `field-guide/index.md`, and
`src/decisions.ts`'s new constant references — no functional change).
`npm ci`, `npm run build`, `npm run db:migrate`, `npm run seed`, then
`wrangler dev --port 8801` (never 8787/8803), then `npm run walkthrough --
--url http://localhost:8801`. Ran all SIX `WALKTHROUGH_AREAS` in order:
producer, review, speaker, public, data, scale.

producer/review/speaker/public/data: PASS, 0 FAIL/PLANNER lines (5 + 16 +
50 + 29 + 20 checks, all `ok`).

scale: steps 1-5 PASS, confirming the DEC-086/089 probes — step2 one bulk
POST with 110 ids reports `updated=110` (DEC-078/079 chunking); step3
onboarding `task_assignments` (5 cells) exist for sampled fresh contacts;
step4 an identical re-POST leaves assignment counts unchanged (exactly-
once); step5 dev-mailbox message count unchanged by the accept (no auto-
email). step6 (portal-edit purge-refresh probe, DEC-092/083) **FAILS**:
the edit POST returns 400 `"Select at least one track."` because
`scripts/walkthrough/scale.ts`'s `purgeRefreshProbe` never copies a
`trackIds` value into the portal-edit FormData (unlike the earlier
public-submit FormData in the same function, which does). This is a
**script bug in the walkthrough harness itself**, not a product-code or
DEC-092-design gap — `src/routes/portal/edit.tsx`'s required-track
validation is behaving per DEC-041. Full root-cause detail, including the
captured 400 response body, in
`docs/verification-log/task-w4-b-walkthrough.md`.

Log-only lane (DEC-077/090/093): no fix applied; `git status` in the
worktree is clean except the two doc appends (a temporary debug widening
of `assertStatus`'s body-truncation length in `scale.ts`, used to capture
the failing response body, was reverted with `git checkout --` before this
commit). Flagged for task-w4-e (triage-closure, sole `eval-findings.md`
owner) as a script-only fix.

RESULT: FAIL
