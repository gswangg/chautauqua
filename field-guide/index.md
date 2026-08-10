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
  map+admin nav; DEC-002 pure-core src/{auth,domain,forms,mail,lib}
  import nothing from node:/cloudflare. DEC-012/013: route files export
  Hono sub-apps, only src/index.ts mounts; middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}; DEC-015 append-only; DEC-016 locked=real cols; DEC-114
  sha rule; DEC-129 homonym guard.
- Wave-3..21 + Campaign 3 (compact): route sub-apps/repos/ctx DEC-012/
  013/019; uploads/ics/statuses/perf/headshots/walkthrough/claim
  DEC-040-074 (DEC-059 superseded DEC-084); 2nd barrier DEC-107
  (DEC-108..111 fixes); DEC-068 log append-only; DEC-069 exit predicate
  (sha-scoped PASS build+test/walkthrough/perf-smoke/spec-audit/
  triage-closure); 4th barrier voided 675219f; W19/W21 batteries
  VOIDED. Campaign 3 (2026-08-10): DEC-139 exit needs DEC-069 battery+
  render-sweep(DEC-144)+findings closure, sha descends 2dd2f33.
  DEC-140 .ics roundtrip+overlap; DEC-141 reviewers via plan
  assignments; DEC-142 contact drawer=portal profile; DEC-143 dupes
  same-name+company; DEC-145 seed (plan opens 2026-01-01Z); DEC-146
  null-safe date helpers. Workers never edit eval-findings.md,
  verification-log.md, decisions/, src/decisions.ts.
- Waves 2-5 (DEC-147..166, compact): criteriaForRound sole resolution;
  text criteria excluded from weighted math; CRM filters ARE
  SegmentRule[]+'any'; bulk-email preview shares send's render helper;
  public drill-ins SSR gated by visibleSubmissionConditions; calendar
  dates via formatDateOnly UTC never toLocaleDateString; push-to-event=
  invited accepted submission, no email. Pipeline (CRM-07/08)=org
  pipeline_entry+pipeline_activity, 5 stages, /api/v1/pipeline sub-app,
  4th ContactsApp tab. CNT-11=submission_revision snapshots via admin
  PATCH+portal-edit locked-field sync. Files=previous_file_id chains;
  ZIP=src/lib/zip.ts STORE-only, POST .../files/archive, <=50. Battery
  wave 4 designed but NEVER RAN (no task-w4-* after f357477); w5-a=
  only code lane, adds CI render-sweep job (npm ci + playwright
  chromium + `npm run gate:render-sweep`).
- Wave 6 (DEC-167..172, compact): batteries drain LATE — w4-d/e/f/g +
  w5-a merged DURING wave-6 planning (fc1e6ef→5ee31ae). Ledger @
  d8d1cbd: spec-audit/perf-smoke PASS, triage-closure 0 open,
  render-sweep FAIL 2/31 (F.1 CI job now landed via w5-a). Defects:
  PlanEditor read openAt/trackIds vs wire's PlanRecord openDate/
  filters.trackIds → SPA now conforms to wire; render-test mocks MUST
  mirror real wire shapes (DEC-171); seeded form-kind tasks lacked
  DEC-111 backing forms → portal /form 400, fixed via seed + manifest
  pin (DEC-172). Four P1s fixed in parallel: merge dropped bio/
  headshot/notes/phone/social (DEC-167); .ics REQUEST lacked ORGANIZER/
  ATTENDEE (DEC-168 amends DEC-007, itinerary=PUBLISH, ICS_ORGANIZER_
  EMAIL const); PATCH form tracks unvalidated → CFP brickable
  (DEC-169); reviewer file access event-wide (DEC-170 supersedes
  DEC-066, anon plans grant no files, reviewerHasPlanForEvent deleted).
  No battery this wave; wave 7 = six-gate battery at post-fix sha.
