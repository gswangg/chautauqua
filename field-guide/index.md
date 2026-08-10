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
- Wave-3..10 (compact): route sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084); DEC-078 chunk.ts; w7 perf-smoke FAIL ->
  DEC-104/105 chunk-sweep; 2nd barrier DEC-107: DEC-108..111 fixes.
- Wave-11..17 (EXIT, reopened by DEC-086, compact): DEC-068 log append-
  only; DEC-069 exit predicate (sha-scoped PASS build+test/walkthrough/
  perf-smoke/spec-audit/triage-closure); DEC-077 gates code-frozen;
  DEC-114 code-bearing sha rule; DEC-129 dual triage lanes/homonym
  guard (`git merge-base --is-ancestor <gate-sha> <cited-sha>`).
- Wave 18-21 (compact, DEC-134-138): 4th barrier DEC-130..133
  (autoSchedule indexes, ics CR-normalize, hidden-file no-trace, bulk
  status full-match) voided 675219f gates; W19 five-gate battery @
  8c7f479 all PASS; DEC-137 log-repair-by-section rule (marker damage
  belongs to merge train); W21 DEC-138 declared STAGE-1 EXIT @ d9be564
  — VOIDED by campaign 3 below.
- Campaign 3 (2026-08-10, compact): DEC-138 exit VOID — docs/eval-
  findings.md holds a browser-eval SWARM MANDATE. DEC-139 exit needs
  DEC-069 battery + render-sweep (DEC-144) + findings closure. task-w1-*
  gate sections cite-able only if sha descends from 2dd2f33. DEC-140
  .ics ids-roundtrip + overlap lanes; DEC-141 reviewers list events via
  plan assignments; DEC-142 contact drawer = portal profile (one row);
  DEC-143 dupes surface same-name+company across emails; DEC-145 seed
  enrichment (plan opens 2026-01-01Z, demo speaker full flow, headshots,
  keep dupes); DEC-146 null-safe date helpers only in app pages. Workers
  never edit docs/eval-findings.md, docs/verification-log.md,
  decisions/, src/decisions.ts.
- Wave 2 (campaign 3, DEC-147..156) closes mandate Section C + cheap D.
  Per-round criteria resolve ONLY via criteriaForRound (DEC-147); text
  criteria excluded from weighted math like dropdowns (DEC-148); CRM
  filters ARE SegmentRule[], 'any' pseudo-field, GET /contacts?rules=,
  save-segment persists exact rules (DEC-149); bulk-email preview
  shares send's render helper (DEC-150); public drill-ins are SSR
  pages gated by visibleSubmissionConditions (DEC-151); admin contact
  edits reuse portal-profile columns/plumbing (DEC-152); calendar
  dates (UTC-midnight ms) display via formatDateOnly UTC, never
  toLocaleDateString (DEC-153); agenda publish = pubcache purge
  affordance, no draft state (DEC-155); push-to-event = invited
  accepted submission, content pending, no email (DEC-156). contacts.ts
  touched by w2-b/c/e/i in distinct regions, merge train expects it.
