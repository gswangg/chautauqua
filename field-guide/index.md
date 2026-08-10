# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml;
  fixtures (never product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility filtering for public data.
  STAGE 1 zero-secret local wrangler dev; external services behind
  ports. DEC-003 table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$
  hash'; DEC-005 route map+admin nav; DEC-002 pure-core src/{auth,
  domain,forms,mail,lib} import nothing from node:/cloudflare.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts
  mounts; middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}; DEC-015 append-only; DEC-016 locked=real cols; DEC-114
  sha rule; DEC-129 homonym guard.
- Wave-3..21 + Campaign 3 + Waves 2-5 (very compact): route sub-apps/
  repos/ctx DEC-012/013/019; uploads/ics/statuses/perf/headshots/
  walkthrough/claim DEC-040-074 (DEC-059 superseded DEC-084); 2nd
  barrier DEC-107 (DEC-108..111 fixes); DEC-068 log append-only;
  DEC-069 exit predicate; W19/W21 batteries VOIDED. Campaign 3:
  DEC-139 exit needs DEC-069 battery+render-sweep(DEC-144)+findings
  closure, sha descends 2dd2f33. DEC-140 .ics roundtrip+overlap;
  DEC-141 reviewers via plan assignments; DEC-143 dupes same-name+
  company; DEC-145/146 seed+date helpers. Waves 2-5 (DEC-147..166):
  criteriaForRound sole resolution; CRM filters ARE SegmentRule[]+
  'any'; drill-ins SSR gated by visibleSubmissionConditions; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+pipeline_activity;
  CNT-11=submission_revision snapshots; Files=previous_file_id chains;
  ZIP=src/lib/zip.ts STORE-only <=50. w5-a=only code lane, adds CI
  render-sweep. Workers never edit eval-findings.md,
  verification-log.md, decisions/, src/decisions.ts.
- Wave 6 (DEC-167..172): batteries drain LATE — w4-d/e/f/g+w5-a merged
  DURING wave-6 planning. PlanEditor openAt/trackIds vs wire's
  openDate/filters.trackIds → SPA conforms to wire; render-test mocks
  MUST mirror real wire shapes (DEC-171); form-kind tasks lacked
  DEC-111 backing forms → fixed via seed+manifest pin (DEC-172). P1s:
  merge dropped bio/headshot/notes/phone/social (DEC-167); .ics lacked
  ORGANIZER/ATTENDEE (DEC-168 amends DEC-007); PATCH form tracks
  unvalidated (DEC-169); reviewer file access event-wide (DEC-170
  supersedes DEC-066).
- Wave 7 (DEC-173..176): w6-a..f ALL merged during planning
  (7d18e7e->77b76a9), six fixes grep-confirmed. w5-c walkthrough FAIL
  @64ec7de was HARNESS-only: <strong> name extractors (public.ts:440,
  speaker.ts:915) miss the nested <a>; seed's mod-3 formula completes
  both general tasks for contactIdx0. DEC-173 selectors tolerate
  wrappers + harness lanes validate via full local 6-module
  walkthrough; DEC-174 seed forces 'Announce participation' pending
  for contactIdx0 (DEC-172 pin untouched); DEC-175 authz probes
  (unauth 302/401; speaker cross-owner 404/403; reviewer out-of-scope
  404-not-403) become permanent walkthrough assertions; DEC-176
  battery: frozen sha S = task-w7-a merge (only code-bearing lane),
  every gate precondition-greps fixes + merge-base ancestor 2dd2f33,
  triage-closure requires 5 sibling PASS @S + findings A/B/E/F+C
  closure else FAILs cheaply. All green at S, OPEN ITEMS 0 -> wave 8
  declares stage-1 complete.
