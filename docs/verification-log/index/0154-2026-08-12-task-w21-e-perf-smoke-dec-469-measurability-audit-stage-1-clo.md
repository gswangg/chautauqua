## 2026-08-12 task-w21-e — perf smoke + DEC-469 measurability audit (stage 1 close)

Log-only lane (DEC-472/453/438/469): no source file changed. Sha measured: `bf56ba7` (`scribe
wave 21`, confirmed still an ancestor of current `main`). Full per-check `perf:smoke` table, the
DEC-469 measurability audit, the DEC-472 branch-ancestry check, and the four live probes are in
`docs/verification-log/task-w21-e-perf-smoke-stage1.md`.

Headline: all 23 `perf:smoke` checks PASS (exit 0), including the two DEC-469 checks added for
`/api/v1/pipeline` and `/api/v1/users`. Direct sqlite3 query against the seeded D1 file confirmed
803 `pipeline_entry` rows and 104 `user` rows for the perf org — both **measurable at scale**, not
the historical 3/19 the task brief warned about; DEC-469's seed fix (commit `43e6889`, task-w20-e)
is present and effective at this sha. `git merge-base --is-ancestor task-w20-e HEAD` could not be
run literally (the branch ref was deleted post-merge); substituting its tip commit `43e6889`
confirms **true** — task-w20-e's content is an ancestor of this sha. Live authenticated probes
(real cookie-session logins, no bypass) matched the DB counts exactly: pipeline `total=803`, users
`total=104`. The unrestricted-reviewer queue probe found `total=1499`, not DEC-466's claimed
"2,000 shaped rows" — read as a documentation-precision gap in DEC-466's prose (the queue's
`total` is filtered to still-needs-rating/already-rated-by-me by design), not a code defect;
flagged as this lane's one open item.

Two process gotchas hit this lane, both recorded in the linked log for the field guide: (1) the
default `wrangler dev` port 8787 was already bound by a **sibling worktree's** (`task-w21-d`)
server, which silently answered this lane's first `perf:smoke` run and its first `curl` probes
with that other worktree's small pre-perf-seed data — caught by checking `lsof`/`ps` PID→cwd
before trusting any measurement, fixed by pinning `--port 8799`; (2) this worktree was destroyed
mid-lane by an out-of-band process (`.git`, `node_modules`, `src/`, most of `docs/` all vanished),
the same failure class `task-w17-f` hit in wave 17 — recovered by recreating the worktree at the
same sha (deterministic seed) and preserving the already-taken measurements from this session's
own transcript rather than re-running them, since the branch ref `task-w21-e` itself was also gone
by recreation time (this task's actual branch is `task-w21-e-v2`).

OPEN ITEMS: 1 (PENDING-OWNED(none) — DEC-466 prose "all 2,000" vs. measured `total=1499` for the
unrestricted reviewer queue; documentation-precision gap, not a defect, not fixable from this
log-only lane)

RESULT: PASS — all 23 perf:smoke checks green (exit 0) at sha `bf56ba7`, including both DEC-469
checks, both confirmed measurable-by-construction (803/104 rows) rather than assumed from code
presence.

