# 2026-08-10 task-w9-c — walkthrough @ 38860f9

Full detail for the `## 2026-08-10 task-w9-c — walkthrough @ 38860f9` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Wave-9 exit-gate battery (DEC-069/176/177/178), walkthrough lane,
log-only (no code changes). Full detail in
`docs/verification-log/task-w9-c-walkthrough.md`. Summary:

DEC-178 names S as "the `merge task-w9-a` commit," but no such commit
exists in this wave's actual first-parent history off `main` tip
`aa7bf95` (this worktree's branch point). Per DEC-114's mechanical
code-bearing-commit rule, the correct frozen S is the newest
code-bearing commit reachable, `38860f9` ("merge task-w8-a", merging
`52dd2b2`: "w8-a: harness-closure lane — DEC-173/174/175 walkthrough
fixes + authz probes") — the DEC-178-mandated content shipped one
wave-label early. `aa7bf95` and its `task-w8-b` parent diff docs-only,
so are non-code-bearing. This is the same S already used by
`task-w8-c`'s walkthrough gate and `task-w8-e`'s render-sweep gate.
`git merge-base --is-ancestor 2dd2f33 aa7bf95` exits 0 (DEC-139
passes).

All 12 DEC-177/178 precondition anchors (six w6 anchors + DEC-173/174/
175 closure anchors) re-verified present at this worktree. Fresh
worktree: `npm ci` (cached), `npm run build` clean, `rm -rf
.wrangler/state`, `npm run db:migrate` (13 migrations), `npm run seed`
clean, `wrangler dev --port 8832`, `/health` 200. `npm run walkthrough
-- --url http://localhost:8832` ran producer -> review -> speaker ->
public -> data -> scale in DEC-062 order with **zero FAIL/PLANNER:
lines**.

**(a)** speaker's `find my own general task's assignment id via
/portal/tasks` + `complete a general task via its own form action`
round-trip (FAIL at `64ec7de` task-w5-c) now PASSES — DEC-174 override
live. **(b)** public's `J10 /speakers: alphabetical by surname,
headshot/title/company` (FAIL at `64ec7de` task-w5-c) now PASSES —
DEC-173 anchor-tolerant extractor. **(c)** DEC-175 authz probes
confirmed executed and `ok` in all three lenses: producer's
unauthenticated block (`DEC-175 unauthenticated GET /admin -> 302`,
`.../api/v1/contacts -> 401`, `.../api/v1/review/plans -> 401`,
`.../files/:id -> 401`); review's out-of-scope reviewer block (`DEC-175
reviewer GET of an out-of-scope submission's review detail -> 404 (not
403)`, `DEC-175 out-of-scope detail probe is not 403
(existence-hiding, not authz-denial)`, and the matching PUT-evaluation
pair, both 404-not-403); speaker's cross-speaker/cross-role block (8
checks, `DEC-175 speaker2 GET speaker1's portal submission -> 404
(existence-hiding)` plus 7 more, correct 404/403 mix).

Server killed (full `wrangler dev --port 8832` process tree —
`npm`/`wrangler` CLI/`workerd` — via `kill -9` across all PIDs in two
rounds, `workerd` respawned once under a new PID before the second
round cleared it); `lsof -i :8832` confirms the port is free.

OPEN ITEMS: 0

RESULT: PASS (6/6 modules PASS at S = `38860f9`; (a)/(b)/(c) all
confirmed per DEC-178. Duplicates `task-w8-c`'s content at the same S
due to a wave-numbering mismatch between DEC-178's plan and what
actually merged as `task-w8-a`; independently re-run and re-confirmed
here as the wave-9 battery assignment. Flagging for the scribe: DEC-178
literal "merge task-w9-a" naming does not correspond to any commit in
this wave's real history — future wave-9 gates should derive S
mechanically per DEC-114 rather than by literal commit-message match.)
