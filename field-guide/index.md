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
  (DEC-059 superseded DEC-084); DEC-078 chunk.ts; w7 perf-smoke FAIL
  (D1 too-many-vars @300) -> DEC-104/105 chunk-sweep+probes; 2nd
  barrier DEC-107: DEC-108/109/110/111 fixes. Pre-w6 VOID.
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing; DEC-114
  code-bearing iff first-parent name-only diff leaves bookkeeping set
  (EMPTY re-merges never void gates). Wave 11: DEC-108..111 verified.
- Wave 12-14 (compact): DEC-116 voided DEC-113; 3b7ed3d newest code-
  bearing sha; wave-13 (DEC-119) cites it. Wave 14 exit NOT met (perf-
  smoke FAIL, triage OPEN:1); five live defects fixed @5fc22ec via
  DEC-120..125 (IDOR, portal-edit locked fields, compose id-drop,
  plan-PATCH 500, answer len caps, perf-seed fix); DEC-126 lanes
  task-w14-i..n.
- Wave 15-16 (compact): six w14 fixes verified merged @675219f (DEC-
  120..125 in-tree w/ tests); gates task-w15-g..k per DEC-127 (log-
  only, six-marker preflight, ports 8851-8853). Wave 16 (DEC-128)
  mirror battery task-w16-a..e, confirm-else-run vs DEC-114 sha +
  log-section check (PASS->confirm, FAIL->reproduce never fix,
  absent->full gate); ports 8861-8863.
- Wave 17 (DEC-129): predicate 4/5 green @675219f; only triage-closure
  missing (died twice) -> dual lanes task-w17-a/b, ports 8871/8872,
  confirm-else-run. HOMONYM HAZARD: log has first-campaign sections
  reusing current task names; valid only if `git merge-base
  --is-ancestor 675219f <cited-sha>` passes. Exit stays planner-only
  DEC-069 grep.
- Wave 18 (DEC-134, third barrier): DEC-069 predicate WAS fully green
  @675219f (w15-k + w16-e triage sections landed, OPEN:0/PASS, ancestor
  guard ok) but four verified live defects reopened code: DEC-130
  autoSchedule incremental indexes (no per-candidate findConflicts);
  DEC-131 ics escapeText CR-normalize; DEC-132 hidden file fields leave
  zero trace on public submit; DEC-133 bulk status full-match (mirrors
  DEC-122, atomic, ApiError invalid). Lanes task-w18-a..d are the only
  code-bearing changes; landing any voids all 675219f gates. Wave 19 =
  full five-gate battery at the new DEC-114 sha, preflight must include
  DEC-130..133 markers; keep the DEC-129 homonym ancestor guard.
