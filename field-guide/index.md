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
  public data only via repo/public.ts; Bearer chq_ CSRF-exempt
  cookie-mint; uploads/participants/ics/statuses/perf/headshots/
  walkthrough/claim per DEC-040-074 range (DEC-059 superseded DEC-084).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing. Wave 11:
  DEC-108..111 fixes verified in-tree WITH tests; DEC-114 code-bearing
  iff first-parent name-only diff leaves the bookkeeping set (EMPTY
  re-merges never void gates).
- Wave w1-5 (compact): DEC-078 chunk.ts (ID_CHUNK_SIZE=90); DEC-079-084
  plan-before-commit/public chunking+.ics cap/set-based review/pubver
  KV purge/2048px images; DEC-082/087 multi-round; DEC-088 perf-probe
  seeds (2,000 subs/300 accepted); DEC-089 perf-smoke checks+301-id
  400; DEC-092-095 portal-edit purge probe, perf-smoke @200/page,
  trackIds required.
- Wave 6-10 (compact): DEC-098 claim same-request only; DEC-099
  pubcache max-age=60/swr=300; DEC-100 seq atomic; DEC-101 merge 6
  FKs; DEC-102/103 vacuous/void; w7 perf-smoke FAIL (overview.ts
  inArray -> D1 too-many-vars @300) -> DEC-104 chunk-sweep + guard
  tests, DEC-105 timed+untimed probes. Wave 10 2nd barrier (DEC-107):
  DEC-108 public gate inviteStatus IN('none','accepted'); DEC-109
  portal-edit file-answer merge; DEC-110 rules via dangerouslySetInnerHTML
  +escape; DEC-111 backing forms (isDefault false, self-healed,
  domain/acceptance.ts). Pre-w6 gate sections VOID per DEC-069.
- Wave 12: reflog shows 'merge task-w10-e' (3543f09) landed AFTER the
  wave-11 snapshot — the DEC-112 probes ARE in-tree (speaker.ts:479-533
  Hotel+Flight full fills; public.ts:620+ invite-visibility), and
  wave-11's six tasks never executed (no task-w11-* refs/merges).
  DEC-116 voids the DEC-113 barrier, rules the landed split-file probe
  layout authoritative. Zero product code outstanding; DEC-099/100/
  101/104/108-111 re-verified at tip with tests (pubcache-hit finding
  is stale — hit path restores max-age=60). DEC-117: five gates only —
  build+test/walkthrough@8831/perf-smoke@8833/spec-audit parallel,
  triage-closure behind perf-smoke (closes w7-c/w8-b overview.ts OPEN
  ITEM via DEC-104 chunkIds at overview.ts:170). Exit for wave-13 =
  pure DEC-069 grep at DEC-114-derived sha (expected 3543f09): four
  RESULT: PASS + triage OPEN ITEMS: 0.
