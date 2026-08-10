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
  mint; uploads kind attachment/resource (DEC-040/041/047/048/065/066/
  067); participant invites/visibility/track (DEC-070..074); ics
  sequence (DEC-051); statuses deferred/showflow/docs SSR (DEC-054..056);
  perf budget <300KB gz (DEC-058); headshots downscale (DEC-059,
  superseded by DEC-084 below); walkthrough scripts modular (DEC-060);
  claim consumes before user insert (DEC-064).
- Wave-11..17 (EXIT, since reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS for build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gate lanes code-frozen, scribe bookkeeping non-code-bearing.
  Ports: 8801 walkthrough, 8803 perf, never 8787. Wave-17 GREEN @
  a05f17f, since voided by DEC-086.
- Wave w1 fixes (all landed, verified in-tree @ main 7464b1c): DEC-078
  src/lib/chunk.ts (ID_CHUNK_SIZE=90); DEC-079 plan-before-commit +
  chunked bulk status; DEC-080 public chunking + 300-id .ics cap
  (MAX_ITINERARY_IDS); DEC-081 set-based review (resolveAssignments in
  src/domain/evaluation.ts, isSubmissionInReviewerScope, countEvaluations
  ForSubmission(db,planId,submissionId,round)); DEC-083 versioned
  caches.default purge (src/server/pubcache.ts, KV chq:pubver); DEC-084
  image-dims gate 2048px (src/lib/image-dims.ts). DEC-085: DEC-054
  upheld, submittedAt≡createdAt correct under DEC-014 — no task ships.
  accentColor already hex-validated both write paths — no task.
- Wave w2 (reopened run): ALL wave-1 fix branches landed mid-planning (main
  7464b1c) — DEC-078/079/080/081/083/084 verified in-tree; accentColor was
  already hex-validated at both write paths (no task). Remaining defect:
  DEC-082 multi-round (task-w2-a; task-w1-d never launched). DEC-087
  corrects DEC-082's migration to 0009_review_rounds (0005 was taken) and
  pins listEvaluationsForPlan(db,planId,round) + advance-round 409.
  DEC-088 pins the perf-probe seed literals (plan seed_perf_plan_0001, 12
  reviewers perf.reviewer.<i>@example-perf.test / PerfReviewer!2027, 300
  scheduled sessions 100/day); DEC-089 places the DEC-086 probes: 5
  perf-smoke checks + 301-id 400 assertion, walkthrough area "scale"
  (110-id bulk accept, exactly-once re-POST, no-email, purge refresh).
  WAVE-3 PROTOCOL: first VERIFY w2-a..d (and any late task-w1-d) merged,
  then run the five DEC-069 gates at the frozen sha citing the new probes
  (DEC-077: no code tasks alongside gates); triage prunes eval-findings.
