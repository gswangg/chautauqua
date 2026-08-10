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
- Wave w1 fixes (all landed, verified in-tree @ main 7464b1c, compact):
  DEC-078 src/lib/chunk.ts (ID_CHUNK_SIZE=90); DEC-079 plan-before-commit
  + chunked bulk status; DEC-080 public chunking + 300-id .ics cap; DEC-081
  set-based review (resolveAssignments in src/domain/evaluation.ts);
  DEC-083 versioned caches.default purge (KV chq:pubver); DEC-084
  image-dims gate 2048px. DEC-085/accentColor: no task needed.
- Wave w2 (reopened run, compact): DEC-082 multi-round pinned by DEC-087
  (0009_review_rounds, listEvaluationsForPlan(db,planId,round),
  advance-round 409); DEC-088 pins perf-probe seed literals (plan
  seed_perf_plan_0001, 12 reviewers perf.reviewer.<i>@example-perf.test /
  PerfReviewer!2027, 300 sessions 100/day); DEC-089 places DEC-086 probes:
  5 perf-smoke checks + 301-id 400 assertion, walkthrough area "scale"
  (110-id bulk accept, exactly-once re-POST, no-email, purge refresh).
- Wave 3 (gate wave): w2-b/c/a merged MID-PLANNING (main 1cc3fe8) — DEC-088
  perf seed, DEC-089 perf-smoke checks, and DEC-087 three-arg
  listEvaluationsForPlan all verified in-tree; multi-round had already
  landed via late task-w1-d (0009_review_rounds + journal idx 9,
  advance-round 409, tests). Sole outstanding code: task-w2-d walkthrough
  area "scale". Per DEC-076 the barrier is task-w3-a (verify w2-d merged,
  implement DEC-089's scale area only if missing); all five DEC-069 gates
  chain behind it, code-frozen per DEC-077. DEC-090: eval-findings pruning
  + verification-log appends are non-code-bearing; original-run wave-16
  GREEN sections are void (DEC-086). DEC-091: gates cite the newest
  code-bearing main short-sha (skip bookkeeping commits). Exit = five
  sections PASS with OPEN ITEMS: 0 all at that one sha; wave 4 re-runs
  only failed/invalidated gates or fixes defects they surface.
