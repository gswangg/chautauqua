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
- Wave 3/4/5 (compact): w1-d/w2-a/b/c landed early (1cc3fe8); wave-3/5
  gate tasks never executed (history stalled @ 3878d4f then 6e1db15) —
  DEC-096's chain void per DEC-097. DEC-092/093: portal-edit purge
  probe ratified, barrier vacuous, gates parallel @ 3878d4f. DEC-094/
  095: perf-smoke paginates @200/page (301-id probe=300 real+1 fake);
  scale.ts portal-edit POST needs trackIds.
- Wave 6 (verify-first, compact): four verified defects fixed parallel
  to re-issued w5 scripts fix (task-w6-a): DEC-098 on-screen claim link
  only for same-request-created contacts; DEC-099 pubcache hits re-
  served max-age=60/swr=300 (86400 internal only); DEC-100 seq = atomic
  INSERT w/ COALESCE(MAX(seq),0)+1 subquery; DEC-101 merge repoints six
  FKs (+file.uploaded_by_contact_id, file_comment.author_contact_id).
- Wave 7 (verified in-tree, not inherited): ALL four DEC-098..101 fixes
  merged mid-planning via task-w6-b/c/d/e (tip d12eb25 "merge task-w6-d"),
  conforming: submit.tsx ConfirmationState, pubcache CLIENT_CACHE_CONTROL
  on hits, submissions/seq.ts atomic subquery (old helpers deleted),
  contacts six-FK repoint + participant dedupe. Late-w5 gate sections
  (build+test/spec-audit/walkthrough @ b638f75/3d1e838) are VOID per
  DEC-069 — w6 merges are code-bearing. DEC-102: barrier vacuous, four
  gates parallel code-frozen @ >= d12eb25 (re-derive sha DEC-091);
  triage-closure behind walkthrough; task-w6-a-retry must merge verify-
  only or it resets the predicate. Wave-8 planner greps DEC-069 exit.
