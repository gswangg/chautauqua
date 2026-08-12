# 2026-08-10 task-w8-a — walkthrough @ d12eb25

Full detail for the `## 2026-08-10 task-w8-a — walkthrough @ d12eb25` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `RESULT` summary).

Wave-8 code-frozen walkthrough gate (DEC-069/DEC-077/DEC-086/DEC-089/
DEC-102/DEC-103), verify-or-run per DEC-103. Newest code-bearing sha
re-derived per DEC-091/DEC-090: walking `main` from tip `8c19466`
(`8c19466`/`4a1997b`/`075fc16`/`8eff481`/`7af78d9`/`52b9eaa`/`b17595e`/
`9e7ac53`/`4e2d53e`/`0828e32` are all bookkeeping-only — docs/decisions/
field-guide plus a pure-string append to `src/decisions.ts`): **d12eb25**
("merge task-w6-d") — matches task-w7-a/task-w7-c/task-w7-d's own
citations this wave. Grepped `docs/verification-log.md` for an existing
`walkthrough @ d12eb25 ... RESULT: PASS` section (per the DEC-103
verify-or-run instruction, in case a live `task-w7-b` lane landed one
mid-wave): none present, no `docs/verification-log/*-walkthrough.md`
detail file cites `d12eb25` either — so ran the full gate.

Worktree code at `HEAD` (`8c19466`) is byte-identical to `d12eb25` except
for the pure-string append in `src/decisions.ts` (confirmed via `git diff
d12eb25 HEAD -- . ':!docs' ':!decisions' ':!field-guide'`), so ran
directly from this worktree rather than a separate checkout.

`npm ci` (node_modules already present, skipped), `npm run build`: PASS
(tsc --noEmit x2 + vite build, 125 modules, output unchanged from
task-w7-a's build). `npm run db:migrate`: 10 migrations applied clean.
`npm run seed`: PASS (6 R2 objects, fixture rows loaded). `wrangler dev
--port 8811` (DEC-103 alternate port, not 8801/8787) came up healthy at
`/health` on the first poll.

`npm run walkthrough -- --url http://localhost:8811` — all six areas
(DEC-089's "scale" as the sixth):

- PASS producer
- PASS review
- PASS speaker
- PASS public
- PASS data
- PASS scale — 110 fresh contacts/submissions/participants; one bulk
  accept POST of 110 ids (`updated=110`); onboarding task_assignments
  present for a sample of the 110; re-POST of the identical 110-id bulk
  request is exactly-once (assignment counts unchanged); dev mailbox
  message count is unchanged by the bulk accept (no auto-email, house
  invariant); portal-edit purge-refresh probe (DEC-092/093/095): a
  title change via the speaker portal edit form appears immediately on
  `/e/<slug>/sessions` with no 60s staleness.

Note: the 301-id `.ics` cap -> 400 assertion (DEC-089/094) lives in the
`perf:smoke` gate, not this walkthrough gate's `scale` module (confirmed
via `src/lib/itinerary.ts`'s `MAX_ITINERARY_IDS = 300` cap and
`scripts/walkthrough/scale.ts`'s six steps, none of which touch
`.ics`); task-w7-c already exercised that probe at this same sha with
PASS. `npm run walkthrough` itself has no `.ics`-cap check to run.

Full detail: `docs/verification-log/task-w8-a-walkthrough.md`.

RESULT: PASS
