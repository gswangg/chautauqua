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
  SegmentRule[]+'any'; bulk-email preview shares send's render helper;
  public drill-ins SSR gated by visibleSubmissionConditions; calendar
  dates via formatDateOnly UTC never toLocaleDateString; push-to-event=
  invited accepted submission, no email.
- Wave 3 (DEC-157..162, compact): Pipeline (CRM-07/08)=org
  pipeline_entry+pipeline_activity, 5 fixed stages, /api/v1/pipeline
  sub-app, 4th ContactsApp tab. CNT-11=submission_revision snapshots
  via admin PATCH+portal-edit locked-field sync. Files=previous_file_id
  chains; ZIP=src/lib/zip.ts STORE-only, POST .../files/archive, <=50.
  Migrations 0012 pipeline, 0013 submission_revision.
- Wave 4 (DEC-163/164, compact): battery wave designed but NEVER RAN
  (no task-w4-* merges after f357477); w3-a/b/c/d had already merged
  via the train, so w4-a's consolidation plan was moot.
- Wave 5 (DEC-165/166): battery re-issued unchanged. w3 deliverables
  verified in-tree on main; sole real gap was ci.yml missing the
  render-sweep job (eval-findings F.1). w5-a=only code lane: adds CI
  job (npm ci + `npx playwright install --with-deps chromium` +
  `npm run gate:render-sweep`; script self-boots migrate/seed/
  wrangler-dev), greens build+test. Six gate lanes chain on w5-a
  (build+test/walkthrough@8801/perf-smoke@8803/render-sweep/
  spec-audit/triage-closure), citing frozen post-w5-a sha (must
  contain CI job, descend 2dd2f33). Homonym hazard: old campaigns
  left task-w5-* sections mid-log — sha, not branch, identifies
  citable sections (DEC-129). Six PASS+0 OPEN => wave 6 exit DEC-139.
