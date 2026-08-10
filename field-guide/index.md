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
- Wave-3..10 (compact): route sub-apps/repos/ctx per DEC-012/013/019;
  public data via repo/public.ts; Bearer chq_ CSRF-exempt cookie-mint;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing; DEC-114
  code-bearing iff first-parent name-only diff leaves bookkeeping set
  (EMPTY re-merges never void gates). Wave 11: DEC-108..111 fixes
  verified in-tree WITH tests.
- Wave w1-10 (compact): DEC-078 chunk.ts (ID_CHUNK_SIZE=90); DEC-079-084
  plan-before-commit/public chunking+.ics cap/set-based review/pubver
  KV purge/2048px images; DEC-088 perf-probe seeds; DEC-089 perf-smoke
  checks+301-id 400; DEC-092-095 portal-edit purge probe, @200/page,
  trackIds required; DEC-098 claim same-request only; DEC-099 pubcache
  max-age=60/swr=300; DEC-100 seq atomic; DEC-101 merge 6 FKs; w7
  perf-smoke FAIL (overview.ts inArray -> D1 too-many-vars @300) ->
  DEC-104 chunk-sweep + guard tests, DEC-105 timed/untimed probes.
  Wave 10 2nd barrier (DEC-107): DEC-108 public gate inviteStatus
  IN('none','accepted'); DEC-109 portal-edit file-answer merge;
  DEC-110 rules via dangerouslySetInnerHTML+escape; DEC-111 backing
  forms (isDefault false, self-healed). Pre-w6 sections VOID (DEC-069).
- Wave 12-13 (compact): DEC-116 voided DEC-113; DEC-117 gates @3543f09
  never ran (task-w12-* burned); stray w11 lanes merged instead: 'merge
  task-w11-a' (3b7ed3d) newest code-bearing sha, task-w11-e spec-audit
  PASS @3b7ed3d counts (DEC-118). Wave 13 (DEC-119) gates cite 3b7ed3d.
- Wave 14: exit NOT met at 3b7ed3d — build+test/walkthrough/spec-audit
  green but perf-smoke FAIL (perf-seed.ts:269 missing kind:'rating'),
  triage OPEN ITEMS: 1 (w11-f). Five LIVE defects @tip 5fc22ec ->
  DEC-120..124: task-assign IDOR (tasks.ts:229), portal-edit locked
  speaker fields (portal-edit.ts:111), compose silent id-drop
  (comms.ts:284/316), plan criteria PATCH-after-evals 500
  (review.ts:193), no answer length caps (validate.ts). DEC-125
  perf-seed fix. DEC-126: lanes task-w14-i..n (round-0 burned a..h —
  never reuse ANY epoch's used suffix). Any w14 fix merge voids ALL
  3b7ed3d sections (code-bearing); stray w12-e/w13-a/b/c sections
  citing 3b7ed3d likewise void. Wave 15 = full five-gate re-run at new
  DEC-114 sha, fresh 88xx ports; triage-closure -> OPEN ITEMS: 0 citing
  DEC-125 + green perf-smoke. decisions.ts append overlap expected.
