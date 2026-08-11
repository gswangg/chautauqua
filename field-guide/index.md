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
  append-only; DEC-016 locked=real cols; DEC-114 sha rule; DEC-129
  homonym guard matches full heading incl '@ <sha>'.
- Wave3-28+Campaign3 (compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; 2nd
  barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via
  formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains; ZIP=STORE-only<=50; DEC-179-196 CSV
  formula-escape/login-limiter/csrfFormOrHeader/parseBoundedIdArray/
  ensure-dev-vars.ts; DEC-197-222 lowercase+ci-dup emails, password-
  free SSR, pubcache+KV non-atomicity ACCEPTED, conflict-marker
  repair, reset-password reveal; DEC-223-231 checkbox===true/cookie
  HttpOnly-Secure/deleteTrack 409 cascades/two-pass DST; DEC-232-236
  FROZEN f01459a, w27 battery 6/6 PASS, STAGE 1 COMPLETE. Workers never
  edit eval-findings.md/verification-log.md/decisions/. Batteries drain
  LATE, dead stubs VOID on rebind; recheck reflog; grep-code-not-prose.
- Wave post-production (DEC-237..246, compact): live eval reopened
  DEC-069 — render-sweep misses SPA-vs-route payload-KEY mismatches,
  hence DEC-239 route-level contract tests (DEC-246: SPA types.ts is
  contract of record). DEC-237 PBKDF2 100k cap+best-effort submit-
  confirm. DEC-238 mailer best-effort, organizer batch {sent,failed}
  never 500. DEC-240 supersedes DEC-029 (deliverable_kind+previous_
  file_id chain; DEC-248 widens task-file serve pop off 'handout'-
  only). DEC-241 dropdown-criteria col. DEC-242/244 portal speaker
  self-service, CHAIN-LATEST file serve (not organizer /files route).
  DEC-243 Tracks names/Format col (DEC-249 widens match to a 'format'/
  'session format' allowlist). DEC-245 SSR confirmations (save-draft
  ?draft=saved, 'Headshot uploaded.', #chq-login-submit). Human
  committed stage-2 (mailer, Airtable cron) on main, leave it. FIFTH
  late-drain: w1 lanes merged mid-planning, re-read refs first.
- Wave 3 (DEC-247..249): SIXTH late-drain — w2 lanes merged MID-PLANNING;
  never cite a file read before a drain w/o re-reading. DEC-244/245/246
  verified fully landed + conformant. Open set = w2-e closure log
  (docs/verification-log/task-w2-e-findings-closure.md): DEC-247
  /submissions/:id/files -> {items: flat DeliverableFile[]}, counts =
  chain ROOTS, silent .catch deleted; DEC-248 task-file population =
  submissionId-null + assignment-referenced, ANY kind (grep every
  population predicate when a decision widens a writer, mocked-repo
  tests hide predicate drift); DEC-249 Format allowlist {'format',
  'session format'} (adapt product to fixtures, never relabel).
  scripts/walkthrough/review.ts QueueItem stale (id->submissionId) —
  w3-d repairs before the wave-4 exit battery.