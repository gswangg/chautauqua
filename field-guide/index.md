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
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-077 gates code-frozen;
  DEC-114 code-bearing iff first-parent name-only diff leaves
  bookkeeping set. W12-14: DEC-116 voided DEC-113; 3b7ed3d sha; w14
  exit NOT met, five defects fixed @5fc22ec via DEC-120..125 (IDOR,
  portal-edit locked fields, compose id-drop, plan-PATCH 500, answer
  len caps, perf-seed); DEC-126 lanes w14-i..n. W15-16: fixes verified
  merged @675219f; gates w15-g..k (DEC-127, ports 8851-53); w16 mirror
  battery a..e (DEC-128, confirm-else-run, ports 8861-63). W17 (DEC-
  129): predicate 4/5 green; triage-closure only gap -> dual lanes
  w17-a/b, ports 8871/72. HOMONYM HAZARD: log has first-campaign
  sections reusing task names; valid only if `git merge-base
  --is-ancestor 675219f <cited-sha>` passes.
- Wave 18 (DEC-134, third barrier): DEC-069 predicate WAS fully green
  @675219f but four verified live defects reopened code: DEC-130
  autoSchedule incremental indexes (no findConflicts); DEC-131 ics
  escapeText CR-normalize; DEC-132 hidden file fields leave zero trace
  on public submit; DEC-133 bulk status full-match pre-mutation. Lanes
  w18-a..d only code-bearing changes; landing any voids all 675219f
  gates.
- Wave 19 (DEC-135): five-gate battery task-w19-a..e ALL-PARALLEL at the
  post-w18 DEC-114 sha (expect last `merge task-w18-*` or later). Preflight
  DEC-130..133 by BEHAVIOR — `void DEC_130/131` imports + two w18 test files
  were observed in-tree BEFORE the fixes landed, so the marker line alone
  proves nothing: schedule.ts autoSchedule has no findConflicts call/no
  trial array; ics.ts escapeText CR-normalizes pre-escape; submit.tsx file
  loops gated on isVisible + cleaned==='pending'; status.ts throws ApiError
  on unknown ids pre-mutation. Marker absent => section ends RESULT: FAIL
  preflight, never fix (DEC-077). Fresh ports 8881 walkthrough / 8882
  perf-smoke / 8883 triage. All 675219f sections VOID for exit (DEC-134);
  DEC-129 ancestor guard stays. Planner cleared the db8bcdb reviewer
  concern: portal-edit-speaker-locked-route.test.ts asserts real positional
  args (call[1]=s1, call[2]=c1). Exit = planner-only DEC-069 grep.
