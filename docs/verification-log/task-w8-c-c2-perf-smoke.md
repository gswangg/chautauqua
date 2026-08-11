# task-w8-c - perf-smoke @ 80b811d

FROZEN SHA: 80b811d250285de0d37417ddc12f65445ce27f96
RECHECK SHA: 50354380d299969b12d0b46548cb77d28e861c9d
OPEN ITEMS: 0
RESULT: PASS

## Protocol

1. `git worktree add --detach <scratch> 80b811d250285de0d37417ddc12f65445ce27f96` — all checks below ran
   inside that detached worktree, never inside a worktree tracking `main`.
2. `git merge-base --is-ancestor 80b811d250285de0d37417ddc12f65445ce27f96 refs/heads/main` — confirmed
   ancestor.
3. `npm ci --prefer-offline --no-audit --no-fund --silent` clean, `npm run db:migrate` — all 18 migrations
   ✅ (0000-0017, `0011` numbered gap pre-existing, not a fault of this lane).
4. `npm run seed` (demo seed — required first for a login-capable organizer/reviewer per the
   `docs/verification-log.md` w16-c/w18 precedent: `perf:seed` alone seeds only synthetic
   `seed_perf_*` rows, no org/organizer/user). Then `npm run perf:seed`.
5. Row counts actually produced (verified via `wrangler d1 execute chautauqua --local`, `WHERE id LIKE
   'seed_perf_%'`):

   | table | count |
   |---|---|
   | submission | 2000 |
   | participant | 2000 |
   | evaluation | 600 |
   | contact | 800 |

   (Matches DEC-088's fixed scale: 2,000 submissions / 300 accepted+scheduled, 800 contacts, 600 round-1
   evaluations, 12 reviewers, 8 tracks, 10 rooms, 1 plan.)

6. Served with `npx wrangler dev --port 8792 --var PUBLIC_BASE_URL:http://localhost:8792` (port 8792 is
   this lane's alone per DEC-286); `/health` returned 200 within 3s of boot.
7. `PERF_URL=http://localhost:8792 npm run perf:smoke` — includes the untimed DEC-080 301-id cap
   assertion (400, as expected) and the untimed DEC-105 CSV export size probes (submissions.csv >= 2001
   lines, showflow.csv >= 301 lines), both passed before the timed loop below ran.

## Gotcha (for the field guide)

`perf:seed` alone is NOT sufficient to run `perf:smoke` — it seeds only the `seed_perf_*` namespace
(event, tracks, contacts, submissions, reviewers, evaluations), not an org or a login-capable organizer
user. Running `perf:seed` before `npm run seed` silently produces a `seed_perf_event` insert with a
dangling `org_id` FK that D1/SQLite does not enforce by default — the insert "succeeds" (no error), the
row is simply absent, and every subsequent `/api/v1/events/seed_perf_event/...` call 404s. Fix: always
`npm run seed` (demo seed, creates `seed_org_0001` + organizer login) BEFORE `npm run perf:seed`. This
matches the precedent already recorded in `docs/verification-log.md` (w16-c, w18, and later waves).

## Results — p95 over 30 measured iterations (5 warmup), 2k-row seed scale

Measured at FROZEN SHA (port 8792) and re-measured at RECHECK SHA (port 8795, second detached worktree),
both against a locally identical DEC-088-scale seed. `perf:smoke`'s own uniform local budget is 150ms
(buffer for localhost/client overhead over the SPEC's server-time numbers — see
`scripts/perf-smoke-lib.ts`'s `PERF_P95_BUDGET_MS` comment); the SPEC section 7 budget column below is
the number this lane actually judges against, verbatim: admin API reads p95 < 50ms server time, admin
writes p95 < 100ms server time, uncached public SSR < 150ms.

| endpoint | category (SPEC §7) | SPEC budget | p95 @ FROZEN SHA | p95 @ RECHECK SHA | verdict |
|---|---|---|---|---|---|
| submissions list (page 1) | admin API read | 50ms | 10.4ms | 24.2ms | PASS |
| submissions list (q=Kubernetes) | admin API read | 50ms | 10.8ms | 19.8ms | PASS |
| submission detail | admin API read | 50ms | 13.9ms | 16.6ms | PASS |
| event overview | admin API read | 50ms | 12.1ms | 31.1ms | PASS |
| organizer agenda (300 accepted) | admin API read | 50ms | 17.7ms | 18.9ms | PASS |
| public sessions page | uncached public SSR | 150ms | 3.9ms | 3.8ms | PASS |
| public agenda | uncached public SSR | 150ms | 5.7ms | 5.7ms | PASS |
| schedule.ics 150 ids | public (not HTML SSR — .ics feed; judged against the same 150ms public budget as the closest applicable SPEC category, no dedicated .ics budget exists) | 150ms | 48.5ms | 46.2ms | PASS |
| plan progress (12 reviewers) | admin API read | 50ms | 16.7ms | 17.1ms | PASS |
| contacts list (q=perf) | admin API read | 50ms | 7.6ms | 7.3ms | PASS |
| rating PUT | admin write | 100ms | 11.3ms | 12.6ms | PASS |

No endpoint exceeded either the harness's own 150ms local budget or the stricter SPEC §7 per-category
server-time budget (all admin reads under 50ms, the one admin write under 100ms, both public SSR checks
and the .ics feed under 150ms) at either sha. `perf:smoke OK` at both shas.

One-shot untimed probes (also PASS at both shas): DEC-080 301-id `schedule.ics` cap -> 400; DEC-105
`export/submissions?format=csv` -> 200, >= 2001 lines; `exports/showflow.csv` -> 200, >= 301 lines.

## One round trip per view

Every timed check above resolves in a single HTTP call to a single endpoint (no client-side request
waterfall inside the check itself). The one exception, "submission detail", issues a bootstrapping list
call *before* the timed detail fetch purely to discover a real submission id to time against — that
bootstrap call is harness plumbing, not part of the measured request, and is not counted in its p95.

Not independently verified by this lane (out of scope for a scripts/perf-smoke.ts-driven check, which
only exercises server endpoints, not the compiled admin SPA's client-side fetch behavior): whether any
admin screen's *rendered UI* issues more than one endpoint call to hydrate (e.g. a dashboard combining
`overview` + a second widget fetch). `scripts/perf-smoke-lib.ts`'s endpoint list covers submissions
list/search/detail, event overview, organizer agenda, public sessions/agenda, schedule.ics, review plan
progress, contacts list, and a rating write — this appears to cover the SPEC's named hot paths (CFP
review queue, public sessions/agenda, ICS export, contacts). No gap identified in the endpoint list
itself; a true SPA-waterfall audit would require a render-sweep-style tool, which is out of this
section's scope (DEC-281 assigns render-sweep elsewhere).

## POST-S DELTA

```
5035438 scribe wave 8
c3b0932 merge task-w7-a
50a2947 DEC-282: make CRM merge total over pipeline_entry (fixes org-wide pipeline 500)
7f003dd DEC-283: gate listAcceptedContactIds through isActiveParticipant
```

Non-empty (task-w7-a/task-w7-c landing on main between S and this run). Per DEC-280/DEC-285 this is
expected, not a failure.

## KNOWN IN-FLIGHT AT S (DEC-285)

- `src/server/repo/contacts.ts:207` (six of seven contact FK tables; `pipeline.ts:161` throws org-wide
  after a merge) — fixed by `50a2947` (visible in the POST-S DELTA above).
- `src/server/repo/tasks.ts:263` (no active-participant filter on `listAcceptedContactIds`) — fixed by
  `7f003dd` (visible in the POST-S DELTA above).

Neither claim is one this perf-smoke section makes or measures (no timed check in
`scripts/perf-smoke.ts` exercises `listAcceptedContactIds` or the org-wide pipeline merge path), so per
step 5 of the protocol they are not counted as OPEN here regardless of fix status. Recorded for the
record only. The RECHECK (second detached worktree at `50354380d299969b12d0b46548cb77d28e861c9d`, run
end-to-end: fresh `npm ci`, `db:migrate`, `npm run seed`, `npm run perf:seed`, `wrangler dev --port
8795`, `npm run perf:smoke`) reproduced the same PASS result with all p95s still comfortably under both
the harness's 150ms budget and the stricter SPEC §7 per-category budgets — no regression introduced by
the POST-S delta.

## Verdict

RESULT: PASS. 0 open items in perf-smoke's own scope. All measured endpoints are well under their SPEC
§7 budget at both the frozen sha and the recheck sha; the perf-seed row counts match DEC-088's fixed
2,000/300/800/600/12 scale; no evidence of a client-side request waterfall inside the timed checks
themselves.
