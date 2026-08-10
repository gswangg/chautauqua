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
- Wave 18 (DEC-134, third barrier): predicate WAS fully green @675219f
  but 4 verified live defects reopened code: DEC-130 autoSchedule
  incremental indexes; DEC-131 ics escapeText CR-normalize; DEC-132
  hidden file fields no-trace on public submit; DEC-133 bulk status
  full-match pre-mutation. Landing any w18-a..d fix voids all 675219f
  gates.
- Wave 19 (DEC-135): five-gate battery task-w19-a..e ALL-PARALLEL at
  post-w18 DEC-114 sha. Preflight DEC-130..133 by BEHAVIOR, not marker
  import (marker+tests observed in-tree before fixes landed): no
  findConflicts/trial array in autoSchedule; ics CR-normalize pre-
  escape; submit.tsx gates on isVisible+cleaned==='pending'; status.ts
  ApiError on unknown ids pre-mutation. Marker absent => RESULT: FAIL
  preflight, never fix (DEC-077). Ports 8881/8882/8883. All 675219f
  sections VOID (DEC-134); DEC-129 guard stays.
- Wave 20 (DEC-136/137): w19 landed a/d/e — build+test, spec-audit,
  triage-closure all PASS @ 8c7f479; w19-b/c (walkthrough/perf-smoke)
  committed but unmerged at plan time, results unknown. Main @ 8e84281
  transiently committed raw conflict markers in verification-log.md
  (swallowed w19-a's RESULT line); healed by the hand-resolved w19-e
  merge (24f6f84) — so DEC-137: locate sections by header, read that
  section's own RESULT/OPEN ITEMS, tolerate marker lines, never repair
  others' sections. W20 = two confirm-else-run lanes (DEC-136, ports
  8891/8892): PASS found -> confirm append + one spot-check (ics CR
  byte-check / untimed DEC-130 auto-schedule POST); FAIL found ->
  inherit-FAIL note, never fix (DEC-077); absent -> full run per w19
  spec. Exit stays planner-only DEC-069 grep at the DEC-114 sha.
