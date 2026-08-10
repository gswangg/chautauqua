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
  forms,mail,lib} import nothing from node:/cloudflare. DEC-012/013:
  route files export Hono sub-apps, only src/index.ts mounts (app.ts +
  scheduled.ts, DEC-035). Middleware sessionLoader/requireOrganizer/
  requireReviewer/requireSpeaker/csrfJson/csrfForm; errors {error:{code,
  message,fields?}}, lists {items,total,page,perPage}. DEC-015
  migrations append-only; DEC-016 locked = real cols.
- Wave-3..10 (compact): route sub-apps/repos/ctx per DEC-012/013/019;
  public data only via repo/public.ts; Bearer chq_ CSRF-exempt cookie-
  mint; uploads/participants/ics/statuses/perf/headshots/walkthrough/
  claim per DEC-040/041/047/048/051/054-060/064-067/070-074 (headshots
  DEC-059 superseded by DEC-084 below).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing. Ports: 8801
  walkthrough, 8803 perf, never 8787.
- Wave w1/w2 fixes (landed): DEC-078 chunk.ts (ID_CHUNK_SIZE=90); DEC-079
  plan-before-commit + chunked bulk status; DEC-080 public chunking +
  300-id .ics cap; DEC-081 set-based review; DEC-083 versioned
  caches.default purge (KV chq:pubver); DEC-084 image-dims 2048px;
  DEC-082/087 multi-round (0009_review_rounds, listEvaluationsForPlan
  (db,planId,round), advance-round 409); DEC-088 perf-probe seed
  literals; DEC-089 5 perf-smoke checks + 301-id 400, walkthrough
  "scale" (110-id bulk accept, exactly-once, no-email).
- Wave 3-5 (compact): w1-d/w2-a/b/c landed early (1cc3fe8); wave-3/5
  gate tasks never executed/void (DEC-096/097). DEC-092/093 portal-edit
  purge probe ratified; DEC-094/095 perf-smoke paginates @200/page,
  scale.ts portal-edit POST needs trackIds.
- Wave 6-7 (verified in-tree, tip d12eb25 "merge task-w6-d"): DEC-098
  on-screen claim link only same-request contacts; DEC-099 pubcache
  hits re-served max-age=60/swr=300; DEC-100 seq atomic INSERT
  COALESCE(MAX(seq),0)+1; DEC-101 merge repoints six FKs. Pre-w6 gate
  sections VOID per DEC-069. DEC-102: barrier vacuous @ d12eb25, four
  gates parallel code-frozen, triage-closure behind walkthrough.
- Wave 8 (verify-or-run, DEC-103): w7 gates LIVE mid-planning —
  task-w7-a build+test PASS @ d12eb25 merged during planning (52b9ead,
  bookkeeping-only, d12eb25 still newest code-bearing); w7-b/c refs
  advanced, sections not yet landed. Remaining scopes (walkthrough/
  perf-smoke/spec-audit/triage) re-issued as idempotent verify-or-run
  lanes: pre-grep log for same-scope green @ DEC-091 sha, append brief
  confirm else run full gate; alt ports 8811 walkthrough/8813 perf
  (8801/8803 may be held by live w7 lanes, never 8787). Triage chains
  behind w8 walkthrough, audits every post-d12eb25 merge for DEC-090
  exemption. Wave-9 planner greps DEC-069 exit predicate.
