# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never product code). decisions/DEC-*.md binding; src/decisions.ts
  compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map+admin nav. Pure-core (DEC-002): src/{auth,domain,forms,mail,lib}
  import nothing from node:/cloudflare. DEC-012/013: route files export
  Hono sub-apps, only src/index.ts mounts; middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage};
  DEC-015 migrations append-only; DEC-016 locked=real cols.
- Wave-3..10 (compact): route sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084); 2nd barrier DEC-107: DEC-108..111 fixes.
- Wave-11..21 (EXIT, compact): DEC-068 log append-only; DEC-069 exit
  predicate (sha-scoped PASS build+test/walkthrough/perf-smoke/spec-
  audit/triage-closure); DEC-114 sha rule; DEC-129 homonym guard; 4th
  barrier voided 675219f; W19 battery @ 8c7f479 all PASS; W21 DEC-138
  EXIT @ d9be564 — VOIDED below.
- Campaign 3 (2026-08-10, compact): DEC-139 exit needs DEC-069 battery
  + render-sweep (DEC-144) + findings closure; task-w1-* gate sections
  cite-able only if sha descends from 2dd2f33. DEC-140 .ics roundtrip+
  overlap; DEC-141 reviewers list events via plan assignments; DEC-142
  contact drawer=portal profile; DEC-143 dupes same-name+company across
  emails; DEC-145 seed (plan opens 2026-01-01Z, demo speaker flow,
  headshots); DEC-146 null-safe date helpers only. Workers never edit
  eval-findings.md, verification-log.md, decisions/, src/decisions.ts.
- Wave 2 (DEC-147..156, compact): criteriaForRound sole resolution
  (DEC-147); text criteria excluded from weighted math (DEC-148); CRM
  filters ARE SegmentRule[]+'any' pseudo-field via GET /contacts?rules=
  (DEC-149); bulk-email preview shares send's render helper (DEC-150);
  public drill-ins SSR gated by visibleSubmissionConditions (DEC-151);
  admin contact edits reuse portal-profile plumbing (DEC-152); calendar
  dates via formatDateOnly UTC, never toLocaleDateString (DEC-153);
  agenda publish=pubcache purge affordance (DEC-155); push-to-event=
  invited accepted submission, no email (DEC-156).
- Wave 3 (DEC-157..162, compact): Section D FIXED not waived. Pipeline
  (CRM-07/08)=org pipeline_entry+pipeline_activity, five fixed stages
  identified/contacted/interested/confirmed/declined, moves AND notes
  are activity rows, new /api/v1/pipeline sub-app, 4th ContactsApp tab,
  never emails (DEC-157). CNT-11=submission_revision POST-edit
  snapshots appended by admin PATCH + portal-edit locked-field sync;
  restore re-applies through same path (DEC-158). Files library groups
  previous_file_id chains, GET /events/:id/files (DEC-159); ZIP=
  src/lib/zip.ts STORE-only pure-core, POST /events/:id/files/archive,
  <=50, folder-per-session names (DEC-160). Render smokes: one
  *.render.test.tsx per top-level page/tab, branch-time main (DEC-161).
  Six-gate battery NEXT wave at frozen post-merge sha, sole log-freeze
  exception, each appends own section (DEC-162). Migrations: 0012
  pipeline (w3-a), 0013 submission_revision (w3-b). task-w1-i (5c85da7)
  pushed unmerged — merge train must land it.
