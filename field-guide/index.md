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
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237
  amended, workerd 100k cap); DEC-005 route map+admin nav; DEC-002
  pure-core src/{auth,domain,forms,mail,lib} import nothing node:/cf.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts
  mounts; middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}. DEC-015 append-only; DEC-016 locked=real cols; DEC-114
  sha rule; DEC-129 homonym guard matches full heading incl '@ <sha>'.
- Wave3-28+Campaign3 (compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074;
  2nd barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via
  formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains; ZIP=STORE-only<=50; DEC-179-196 CSV
  formula-escape/login-limiter/csrfFormOrHeader/parseBoundedIdArray;
  DEC-197-222 lowercase+ci-dup emails, password-free SSR, pubcache+KV
  non-atomicity ACCEPTED, conflict-marker repair, reset-password
  reveal; DEC-223-231 checkbox===true/cookie HttpOnly-Secure/
  deleteTrack 409 cascades/two-pass DST; DEC-232-236 FROZEN f01459a,
  w27 battery 6/6 PASS, STAGE 1 COMPLETE (later reopened). Batteries
  drain LATE, dead stubs VOID on rebind; recheck reflog; grep-code-
  not-prose; workers never edit eval-findings.md/decisions/.
- Wave post-production (DEC-237..246, compact): live eval reopened
  DEC-069 — render-sweep misses SPA-vs-route payload-KEY mismatches,
  hence DEC-239 route-level contract tests (DEC-246: SPA types.ts is
  contract of record). DEC-237 PBKDF2 100k cap+best-effort submit-
  confirm. DEC-238 mailer best-effort, organizer batch never 500.
  DEC-240 supersedes DEC-029 (deliverable_kind+previous_file_id chain;
  DEC-248 widens task-file serve pop off 'handout'-only). DEC-241
  dropdown-criteria col. DEC-242/244 portal speaker self-service,
  CHAIN-LATEST file serve. DEC-243 Tracks/Format col (DEC-249 widens
  match to 'format'/'session format' allowlist). DEC-245 SSR confirms
  (?draft=saved, 'Headshot uploaded.', #chq-login-submit). Human
  committed stage-2 (mailer, Airtable cron) on main, leave it.
  DEC-247..249 (w3, 6th late-drain): flat {items} files envelope+
  chain-root counts, task-file pop widened to ANY kind submissionId-
  null+assignment-ref, Format allowlist exact; review.ts QueueItem fixed.
- Wave 4 (DEC-250/251): SEVENTH-NINTH late-drains — ALL five w3 lanes
  merged MID-planning; re-read .git/logs/HEAD before citing any file.
  Wave-3 verified conformant on main @ c211d4c. DEC-250 FREEZES the
  exit battery at sha c211d4c (allow-listed drift only: decisions/,
  field-guide/, docs/verification-log/, eval-findings.md,
  src/decisions.ts; FAIL-stop on product drift); six sections
  task-w4-a..f under docs/verification-log/, heading '@ c211d4c'
  disambiguates task-w4-* homonyms (DEC-129). DEC-251 disposes
  Section D: D1-D4+D6 fixed (cited), D5/D7-residual/D8 WAIVED. Six
  green sections + OPEN ITEMS: 0 => stage-1 complete (DEC-069); any
  product commit after c211d4c voids the battery.