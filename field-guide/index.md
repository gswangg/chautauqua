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
- Wave w1-5 (compact): DEC-078 chunk.ts (ID_CHUNK_SIZE=90, src/lib/chunk);
  DEC-079/080/081/083/084 plan-before-commit/public chunking+.ics cap/
  set-based review/pubver KV purge/2048px images; DEC-082/087 multi-round
  (listEvaluationsForPlan(db,planId,round), advance-round 409); DEC-088
  perf-probe seed literals (2,000 submissions/300 accepted); DEC-089 5
  perf-smoke checks+301-id 400, walkthrough "scale"; DEC-092/093/094/095
  portal-edit purge probe, perf-smoke @200/page, trackIds required.
- Wave 6-8 (compact, tip d12eb25 "merge task-w6-d"): DEC-098 claim link
  same-request contacts only; DEC-099 pubcache max-age=60/swr=300;
  DEC-100 seq atomic INSERT COALESCE(MAX(seq),0)+1; DEC-101 merge
  repoints six FKs; pre-w6 gate sections VOID per DEC-069; DEC-102
  barrier vacuous, gates parallel code-frozen, triage behind walkthrough.
  DEC-103 (w8 verify-or-run): pre-grep log for same-scope green @
  DEC-091 sha, append brief confirm else run full gate; ports 8811
  walkthrough/8813 perf (never 8787); w8 lanes never merged, void once
  w9 lands.
- Wave 9 (tip 8c19466 scribe-w8; newest code-bearing still d12eb25): w7
  gates all landed — build+test/walkthrough/spec-audit PASS, perf-smoke
  FAIL @ d12eb25 (overview.ts placedIds inArray -> D1 too-many-variables
  500 @ 300 placed); triage stale @ b638f75. Wave 9 = reopened DEC-076
  code barrier: DEC-104 chunk-sweep lanes (overview/agenda/exports/
  tasks+review+contacts+files), each with a source-scan guard test (no
  D1 harness exists — local SQLite won't reproduce the 500), plus
  DEC-105 perf-smoke adds organizer-agenda timed check and untimed
  export min-line probes (submissions>=2001, showflow>=301). DEC-106:
  wave-10 re-runs all five DEC-069 gates at the post-w9 sha, ports 8821
  walkthrough/8823 perf (never 8787); w10 perf-smoke must cite the
  overview fix to close w7-c's OPEN ITEM.
