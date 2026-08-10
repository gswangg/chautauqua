# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs = verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map + admin nav (exact strings). Pure-core (DEC-002): src/{auth,domain,
  forms,mail,lib} import nothing from node:/cloudflare.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked = real cols.
- Wave-3..10 (compact): route sub-apps/repos/ctx per DEC-012/013/019;
  public data only via repo/public.ts; Bearer chq_ CSRF-exempt cookie-
  mint; uploads/participants/ics/statuses/perf/headshots/walkthrough/
  claim per DEC-040/041/047/048/051/054-060/064-067/070-074 (headshots
  DEC-059 superseded by DEC-084 below).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gate lanes code-frozen, scribe bookkeeping non-code-bearing.
  Ports: 8801 walkthrough, 8803 perf, never 8787.
- Wave w1/w2 fixes (landed in-tree): DEC-078 chunk.ts (ID_CHUNK_SIZE=90);
  DEC-079 plan-before-commit + chunked bulk status; DEC-080 public
  chunking + 300-id .ics cap; DEC-081 set-based review; DEC-083
  versioned caches.default purge (KV chq:pubver); DEC-084 image-dims
  2048px; DEC-082/087 multi-round (0009_review_rounds,
  listEvaluationsForPlan(db,planId,round), advance-round 409); DEC-088
  perf-probe seed literals; DEC-089 places 5 perf-smoke checks + 301-id
  400, walkthrough "scale" (110-id bulk accept, exactly-once, no-email).
- Wave 3/4 (compact): w1-d/w2-a/b/c landed early (1cc3fe8); wave-3 gate
  tasks never executed (history ends "merge task-w2-d" 3878d4f). DEC-092
  ratified scale.ts's portal-edit purge probe. DEC-093: barrier vacuous,
  four gates ran parallel @ 3878d4f, triage-closure behind walkthrough.
- Wave 5 (reopened-run gates executed; two FAILs, both script defects):
  closeout/build+test/spec-audit/triage-closure PASS @ 3878d4f; FAILs:
  (1) walkthrough scale step 6 — scripts/walkthrough/scale.ts POSTed
  portal-edit without trackIds; open form -> validateTrackChoice
  (src/lib/submit-core.ts:45) correctly 400s (portal/edit.tsx:201-219);
  a browser would submit the checked checkbox. DEC-095: scripts-only fix,
  no product change. (2) perf-smoke — fetchAcceptedSubmissionIds asked
  perPage=301 in one page; clampPerPage caps 200 (src/lib/pagination.ts),
  DEC-088 seeds exactly 300 accepted. DEC-094: clamp/seed stand; helper
  paginates @200/page; 301-id cap probe = 300 real + 1 syntactically-
  valid nonexistent id (rejected pre-hydration at public.tsx:580-583).
  DEC-096: task-w5-a is the sole DEC-076 barrier landing BOTH fixes
  (repro on port 8805); w5-b/c/d/e re-run all four gates code-frozen
  (DEC-077) @ w5-a's new sha; w5-f triage-closure chains behind w5-c
  walkthrough, must close the two OPEN ITEMS -> 0. Ports: 8805 fix-task
  (else per above). Exit: wave-6 planner greps four PASS @ w5-a sha +
  triage-closure OPEN ITEMS: 0 -> zero tasks, goalComplete.
