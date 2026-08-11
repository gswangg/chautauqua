# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all; brief/-
  images; sessionboard-reference; eval-rubric/*.yaml; fixtures (never product
  code). decisions/DEC-*.md binding; src/decisions.ts compile-checked,
  scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237 amended,
  workerd 100k cap); DEC-005 route map+admin nav; DEC-002 pure-core
  src/{auth,domain,forms,mail,lib} import nothing from node:/cloudflare.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts;
  middleware sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/
  csrfJson/csrfForm; errors {error:{code,message,fields?}}. DEC-015
  append-only; DEC-016 locked=real cols; DEC-114 sha rule; DEC-129 homonym
  guard matches full heading incl '@ <sha>'.
- Wave3-22+Campaign3 (compact history): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; 2nd
  barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via
  formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains (DEC-240 extends to task uploads);
  ZIP=STORE-only<=50. Workers never edit eval-findings.md/
  verification-log.md/decisions/. Batteries drain LATE, dead stubs VOID on
  rebind. DEC-179-196: CSV formula-escape; login-limiter failures-only;
  csrfFormOrHeader/logout; parseBoundedIdArray(64-char,1000 cap);
  ensure-dev-vars.ts (never overwrite/read/print). DEC-197-206: lowercase+
  ci-dup emails, password-free welcome+/account/password SSR, pubcache+KV
  limiter non-atomicity ACCEPTED stage-1. DEC-207-217: conflict-marker
  repair, review-lens defects, reset-password+PlanEditor reveal,
  lower(email) migration. DEC-218-222 (w23-24) THIRD late-drain; recheck
  reflog before trusting "dead stub".
- Wave25-28 (compact): DEC-223-231 FOURTH late-drain (late-drain-immune
  accounting); 4 defects fixed (checkbox ===true, cookie HttpOnly/Secure,
  deleteTrack 409 cascades, two-pass DST); CRM-02 grep-code-not-prose.
  DEC-232-234 w26 fix lanes drained DURING planning; FROZEN f01459a.
  DEC-235/236 STAGE 1 DECLARED COMPLETE at f01459a; w27 battery 6/6 PASS;
  stale review-lens quartet re-flagged, do not reopen w/o evidence.
- Wave post-production (DEC-237..243): live chautauqua.cc eval
  (docs/eval-findings.md, d47c747) reopened DEC-069 — DEC-235 completeness
  stands, but prod found P1s render-sweep structurally misses: 3
  SPA-vs-route payload-KEY mismatches (id vs userId, SubmissionSummary vs
  queue contract, contactIds vs ids). LESSON: every SPA payload type needs
  a route-level contract test on exact key names (DEC-239). DEC-237
  ratifies human hotfixes: PBKDF2 100k cap + best-effort submit-confirm
  email (see DEC-004). DEC-238 mailer taxonomy: system sends best-effort/
  continue per recipient, organizer batch returns {sent,failed} 200 never
  500, invariants still throw. DEC-240 supersedes DEC-029: task uploads
  get deliverable_kind, deterministic submission linkage, previous_file_id
  chaining. DEC-241 dropdown-criteria aggregate col, text criteria no col,
  client-sort results. DEC-242 portal speaker self-service (file+replace+
  comment thread). DEC-243 Tracks real names, Format col from CFP form,
  labeled functional Columns picker. Human committed stage-2 code directly
  on main (email-binding mailer, Airtable cron) — leave it; DEV_MODE keeps
  stage-1 zero-secret. NEXT: land fixes, re-run exit battery, re-declare.
