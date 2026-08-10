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
  DEC-059 superseded by DEC-084).
- Wave-11..17 (EXIT, reopened by DEC-086): DEC-068 log append-only;
  DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-076 single code barrier;
  DEC-077 gates code-frozen, bookkeeping non-code-bearing.
- Wave w1-5 (compact): DEC-078 chunk.ts (ID_CHUNK_SIZE=90, src/lib/chunk);
  DEC-079-084 plan-before-commit/public chunking+.ics cap/set-based
  review/pubver KV purge/2048px images; DEC-082/087 multi-round; DEC-088
  perf-probe seeds (2,000 submissions/300 accepted); DEC-089 perf-smoke
  checks+301-id 400; DEC-092-095 portal-edit purge probe, perf-smoke
  @200/page, trackIds required.
- Wave 6-9 (compact, tip 8c19466; newest code-bearing d12eb25): DEC-098
  claim link same-request contacts only; DEC-099 pubcache max-age=60/
  swr=300; DEC-100 seq atomic INSERT COALESCE(MAX(seq),0)+1; DEC-101
  merge repoints six FKs; DEC-102 barrier vacuous; DEC-103 w8
  verify-or-run (void once w9 lands); w7 gates landed except perf-smoke
  FAIL @ d12eb25 (overview.ts placedIds inArray -> D1 too-many-
  variables 500 @ 300 placed) -> DEC-104 chunk-sweep lanes (overview/
  agenda/exports/tasks+review+contacts+files) w/ source-scan guard
  tests; DEC-105 perf-smoke adds organizer-agenda timed check + untimed
  export min-line probes. Pre-w6 gate sections VOID per DEC-069.
- Wave 10 (tip 019550b "merge task-w9-d"): DEC-104 sweep + DEC-105 probes
  fully landed (chunk-sweep guard tests in test/); all d12eb25 gate
  sections void. Four NEW verified defects -> wave 10 = second code
  barrier (DEC-107): DEC-108 public gate adds inviteStatus IN
  ('none','accepted') (shared gate + speaker hydration); DEC-109
  portal-edit merges stored file answers, file-required forced false
  there only; DEC-110 rules JSON via dangerouslySetInnerHTML + <
  escape; DEC-111 form-kind default tasks get backing forms (isDefault
  false, formId set + self-healed, specs in domain/acceptance.ts);
  DEC-112 walkthrough probes (expected-fail pre-w10, port 8825). Wave 11
  = the five DEC-069 gates at post-w10 sha, DEC-106 mechanics, ports
  8821 walkthrough / 8823 perf-smoke, triage behind walkthrough;
  perf-smoke cites the overview chunk fix to close w7-c's OPEN ITEM.
