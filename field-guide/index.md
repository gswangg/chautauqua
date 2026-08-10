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
- Wave-11..17 (EXIT, since reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS for build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gate lanes code-frozen, scribe bookkeeping non-code-bearing.
  Ports: 8801 walkthrough, 8803 perf, never 8787. Wave-17 GREEN @
  a05f17f, since voided by DEC-086.
- Wave w1/w2 fixes (all landed in-tree, compact): DEC-078 chunk.ts
  (ID_CHUNK_SIZE=90); DEC-079 plan-before-commit + chunked bulk status;
  DEC-080 public chunking + 300-id .ics cap; DEC-081 set-based review
  (resolveAssignments); DEC-083 versioned caches.default purge (KV
  chq:pubver); DEC-084 image-dims gate 2048px; DEC-082/087 multi-round
  (0009_review_rounds, listEvaluationsForPlan(db,planId,round),
  advance-round 409); DEC-088 perf-probe seed literals; DEC-089 places
  DEC-086 probes: 5 perf-smoke checks + 301-id 400, walkthrough "scale"
  (110-id bulk accept, exactly-once re-POST, no-email, purge refresh).
- Wave 3 (gate wave, compact): w1-d landed multi-round early; w2-b/c/a
  merged mid-planning (1cc3fe8) landing perf seed/checks + 3-arg
  listEvaluationsForPlan; sole outstanding code was w2-d walkthrough
  "scale", covered by DEC-076 barrier task-w3-a (DEC-091). DEC-090:
  eval-findings/verification-log appends non-code-bearing; wave-16 GREEN
  void (DEC-086).
- Wave 4 (reopened run): wave-3's gate tasks NEVER executed (no task-w3-*
  merges; history ends at "merge task-w2-d" 3878d4f + bookkeeping
  f9a33fd). All fix/probe code verified in-tree: scale.ts (6 steps) +
  WALKTHROUGH_AREAS ends 'scale'; perf-smoke has the 5 DEC-089 checks +
  301-id 400. DEC-092 ratifies scale.ts's portal-edit purge probe (no
  organizer PATCH-title endpoint exists; GAP NOTE closed). DEC-093:
  barrier vacuous, four gates parallel @ code-bearing sha 3878d4f
  (workers re-derive, skipping DEC-090 bookkeeping), triage-closure
  (w4-e, sole owner of eval-findings.md) chains behind walkthrough w4-b
  only. Exit at wave 5: five sections PASS @ 3878d4f + OPEN ITEMS: 0.
