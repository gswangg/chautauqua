# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs = verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never product code). decisions/DEC-*.md binding; src/decisions.ts
  compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map + admin nav. Pure-core (DEC-002): src/{auth,domain,forms,mail,lib}
  import nothing from node:/cloudflare. DEC-012/013: route files export
  Hono sub-apps, only src/index.ts mounts. Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked = real cols.
- Wave-3..10 (compact): route sub-apps/repos/ctx per DEC-012/013/019;
  public data via repo/public.ts; Bearer chq_ CSRF-exempt cookie-mint;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing; DEC-114
  code-bearing iff first-parent name-only diff leaves bookkeeping set
  (EMPTY re-merges never void gates). Wave 11: DEC-108..111 fixes
  verified in-tree WITH tests.
- Wave w1-10 (compact): DEC-078 chunk.ts (ID_CHUNK_SIZE=90); DEC-079-084
  plan-before-commit/public chunking+.ics cap/set-based review/pubver
  KV purge/2048px images; DEC-088 perf-probe seeds; DEC-089 perf-smoke
  checks+301-id 400; DEC-092-095 portal-edit purge probe, @200/page,
  trackIds required; DEC-098 claim same-request only; DEC-099 pubcache
  max-age=60/swr=300; DEC-100 seq atomic; DEC-101 merge 6 FKs; w7
  perf-smoke FAIL (overview.ts inArray -> D1 too-many-vars @300) ->
  DEC-104 chunk-sweep + guard tests, DEC-105 timed/untimed probes.
  Wave 10 2nd barrier (DEC-107): DEC-108/109/110/111 fixes. Pre-w6 VOID.
- Wave 12-13 (compact): DEC-116 voided DEC-113; DEC-117 gates @3543f09
  never ran (task-w12-* burned); stray w11 lanes merged instead: 'merge
  task-w11-a' (3b7ed3d) newest code-bearing sha, task-w11-e spec-audit
  PASS @3b7ed3d counts (DEC-118). Wave 13 (DEC-119) gates cite 3b7ed3d.
- Wave 14: exit NOT met at 3b7ed3d — perf-smoke FAIL (perf-seed.ts
  missing kind:'rating'), triage OPEN ITEMS: 1 (w11-f). Five LIVE
  defects @tip 5fc22ec -> DEC-120..124: task-assign IDOR (tasks.ts),
  portal-edit locked speaker fields, compose silent id-drop, plan
  criteria PATCH-after-evals 500, no answer length caps. DEC-125
  perf-seed fix. DEC-126: lanes task-w14-i..n (round-0 burned a..h).
- Wave 15: ALL SIX w14 fixes verified merged -- main 675219f ('merge
  task-w14-k' last; empty-looking ref mid-wave = worker still pushing,
  NOT a dead lane -- re-check refs before re-planning). DEC-120..125
  confirmed in-tree w/ tests. Gates only: task-w15-g..k (a-f burned) =
  build+test/walkthrough/perf-smoke/spec-audit + triage-closure chained
  behind perf-smoke, per DEC-127: log-only (only verification-log.md
  changes), six-marker preflight before PASS, fresh ports 8851/8852/
  8853, triage spot-verifies unmerged siblings instead of counting
  open. All five PASS/OPEN:0 at DEC-114 sha -> wave 16 greps DEC-069,
  declares stage-1 complete.
