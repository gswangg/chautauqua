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
- Wave-3..21 (compact): route sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074
  (DEC-059 superseded DEC-084); 2nd barrier DEC-107 (DEC-108..111 fixes);
  DEC-068 log append-only; DEC-069 exit predicate (sha-scoped PASS
  build+test/walkthrough/perf-smoke/spec-audit/triage-closure); DEC-114
  sha rule; DEC-129 homonym guard; 4th barrier voided 675219f; W19
  battery@8c7f479 all PASS; W21 DEC-138 EXIT@d9be564 — VOIDED.
- Campaign 3 (2026-08-10, compact): DEC-139 exit needs DEC-069 battery+
  render-sweep(DEC-144)+findings closure; gate sections cite-able only
  if sha descends from 2dd2f33. DEC-140 .ics roundtrip+overlap; DEC-141
  reviewers list via plan assignments; DEC-142 contact drawer=portal
  profile; DEC-143 dupes same-name+company; DEC-145 seed (plan opens
  2026-01-01Z); DEC-146 null-safe date helpers only. Workers never edit
  eval-findings.md, verification-log.md, decisions/, src/decisions.ts.
- Wave 2 (DEC-147..156, compact): criteriaForRound sole resolution;
  text criteria excluded from weighted math; CRM filters ARE
  SegmentRule[]+'any' via GET /contacts?rules=; bulk-email preview
  shares send's render helper; public drill-ins SSR gated by
  visibleSubmissionConditions; admin contact edits reuse portal-profile
  plumbing; calendar dates via formatDateOnly UTC never
  toLocaleDateString; agenda publish=pubcache purge; push-to-event=
  invited accepted submission, no email.
- Wave 3 (DEC-157..162, compact): Section D FIXED not waived. Pipeline
  (CRM-07/08)=org pipeline_entry+pipeline_activity, 5 fixed stages,
  moves+notes=activity rows, /api/v1/pipeline sub-app, 4th ContactsApp
  tab, never emails. CNT-11=submission_revision snapshots via admin
  PATCH+portal-edit locked-field sync, restore same path. Files
  library=previous_file_id chains, GET /events/:id/files; ZIP=
  src/lib/zip.ts STORE-only pure-core, POST .../files/archive, <=50,
  folder-per-session. Render smokes: one test/page. Migrations 0012
  pipeline, 0013 submission_revision. task-w1-i pushed unmerged.
- Wave 4 (DEC-163/164): battery wave. w4-a=sole code-bearing lane:
  consolidates wave 3 (merge pushed origin/task-w3-*; implement
  never-pushed deliverables; one render test/page; migration prefix
  collisions renumber to next free, 0011 gap ok; ContactsApp tabs
  union, Pipeline last), greens build+test. Six gate lanes chain on
  w4-a (build+test/walkthrough/perf-smoke/render-sweep/spec-audit/
  triage-closure), each appends ONLY its own verification-log section
  citing the frozen post-w4-a sha (descends 2dd2f33; docs-only merges
  never invalidate a cited sha, DEC-069). Six PASS+0 OPEN ITEMS => next
  wave re-declares stage-1 exit, DEC-139.
