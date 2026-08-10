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
- Wave-11..17 (EXIT, since reopened by DEC-086): DEC-068 verification
  log append-only; DEC-069 exit predicate (sha-scoped PASS for
  build+test/walkthrough/perf-smoke/spec-audit/triage-closure); DEC-076
  single code barrier; DEC-077 gate lanes code-frozen, scribe bookkeeping
  non-code-bearing. Ports: 8801 walkthrough, 8803 perf, never 8787.
  Wave-17 declared stage-1 exit GREEN @ a05f17f — see DEC-086, now void.
- REOPENED (DEC-086): docs/eval-findings.md round 1 landed at 2103c69
  after the wave-17 exit; defects verified in-tree, so DEC-069 is
  unsatisfied at HEAD. Fix wave w1 (this run's numbering restarts at
  task-w1-*): DEC-078 canonical src/lib/chunk.ts (ID_CHUNK_SIZE=90;
  parallel tasks create identical bytes), DEC-079 planning-before-commit
  acceptance + chunked bulk status, DEC-080 public chunking + 300-id
  .ics cap (MAX_ITINERARY_IDS), DEC-081 set-based review (contracts:
  resolveAssignments pure in src/domain/evaluation.ts;
  isSubmissionInReviewerScope(db,plan,userId,submissionId);
  countEvaluationsForSubmission(db,planId,submissionId,round)), DEC-082
  rounds via evaluation_plan.current_round + POST .../advance-round
  (migrations/0005_review_rounds.sql), DEC-083 versioned caches.default
  purge (src/server/pubcache.ts, KV key chq:pubver, random token bump
  on any successful non-GET/HEAD/OPTIONS <400 mutation; .ics never
  cached), DEC-084 image-dims gate 2048px (src/lib/image-dims.ts,
  supersedes DEC-059's client-only coverage). DEC-085: DEC-054 upheld
  (§10-4 deferred with it); submittedAt≡createdAt is correct under
  DEC-014 — do not re-litigate, no task ships for either.
  Next wave: one probe-extension task (perf-smoke + walkthrough per
  DEC-086: >100-id bulk accept, 2k-row public+301-id .ics 400, ≥10-
  reviewer progress + rating PUT timing, publish-write cache refresh),
  THEN fresh five-gate re-run at the new sha; triage prunes
  eval-findings entries as verified.
