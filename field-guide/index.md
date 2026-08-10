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
- Wave-3..10 (compact): route sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084); DEC-078 chunk.ts; w7 perf-smoke FAIL ->
  DEC-104/105 chunk-sweep; 2nd barrier DEC-107: DEC-108..111 fixes.
- Wave-11..17 (EXIT, reopened by DEC-086, compact): DEC-068 log append-
  only; DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-077 gates code-frozen;
  DEC-114 code-bearing sha rule. W12-14 exit NOT met, 5 defects fixed
  @5fc22ec (DEC-120..125, DEC-126 lanes). W15-17: fixes verified merged
  @675219f (DEC-127/128 gate batteries, ports 8851-63); W17 (DEC-129)
  predicate 4/5 green, dual triage lanes closed the gap, ports 8871/72.
  HOMONYM HAZARD: log has first-campaign sections reusing task names;
  valid only if `git merge-base --is-ancestor 675219f <cited-sha>`.
- Wave 18-20 (compact, DEC-134/135/136/137): w18 4th barrier: DEC-130
  autoSchedule incremental indexes, DEC-131 ics CR-normalize, DEC-132
  hidden file fields no-trace, DEC-133 bulk status full-match
  pre-mutation, voided all 675219f gates. W19: five-gate battery @
  post-w18 sha 8c7f479 (task-w19-a..e), BEHAVIORAL preflight not
  marker-import; ports 8881-83; all PASS incl. triage OPEN ITEMS: 0.
  Main @ 8e84281 transiently held raw conflict markers in
  verification-log.md, healed by hand-resolved w19-e merge (24f6f84);
  DEC-137: locate sections by header, read that section's own RESULT,
  tolerate marker lines elsewhere, never repair others' sections. W20
  confirm-lanes (DEC-136, ports 8891/92) never executed (moot per
  DEC-138 — w19-b/c full gates already contain both spot-checks).
- Wave 21 (DEC-138): STAGE-1 EXIT declared. Planner grep on main @
  d9be564: five PASS DEC-069 sections @ 8c7f479, log marker-free,
  eval-findings zero, 8c7f479 still newest code-bearing sha (later
  commits are DEC-114 bookkeeping). Zero tasks, goalComplete: true.
  Any future code-bearing commit reopens via DEC-069/134: full
  five-gate battery required before re-declaring exit.
