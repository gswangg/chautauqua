## 2026-08-10 task-w4-b — walkthrough @ 3878d4f

Full detail: docs/verification-log/task-w4-b-walkthrough-2.md

Fresh worktree of `main` (`79c4bb3`); derived code-bearing sha `3878d4f`
per DEC-091/093 (all commits since are scribe/bookkeeping/log-only-lane;
`git diff --stat 3878d4f..HEAD` excluding verification-log/eval-findings
touches only new DEC-090..093 docs, `field-guide/index.md`, and
`src/decisions.ts`'s new constant references — no functional change).
`npm ci`, `npm run build`, `npm run db:migrate`, `npm run seed`, then
`wrangler dev --port 8801` (never 8787/8803), then `npm run walkthrough --
--url http://localhost:8801`. Ran all SIX `WALKTHROUGH_AREAS` in order:
producer, review, speaker, public, data, scale.

RESULT: FAIL

