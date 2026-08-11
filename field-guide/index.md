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
- Wave3-22+Campaign3 (compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; 2nd
  barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via
  formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains (DEC-240 extends to task uploads);
  ZIP=STORE-only<=50. Workers never edit eval-findings.md/
  verification-log.md/decisions/. Batteries drain LATE, dead stubs VOID
  on rebind. DEC-179-196: CSV formula-escape; login-limiter
  failures-only; csrfFormOrHeader/logout; parseBoundedIdArray(64-char,
  1000 cap); ensure-dev-vars.ts (never overwrite/read/print). DEC-197-
  217: lowercase+ci-dup emails, password-free welcome/account SSR,
  pubcache+KV limiter non-atomicity ACCEPTED stage-1, conflict-marker
  repair, review-lens defects, reset-password reveal, lower(email)
  migration. DEC-218-222 THIRD late-drain; recheck reflog before
  trusting "dead stub".
- Wave25-28 (compact): DEC-223-231 FOURTH late-drain; 4 defects
  (checkbox ===true, cookie HttpOnly/Secure, deleteTrack 409 cascades,
  two-pass DST); CRM-02 grep-code-not-prose. DEC-232-234 w26 fix lanes
  drained DURING planning; FROZEN f01459a. DEC-235/236 STAGE 1
  COMPLETE; w27 battery 6/6 PASS; stale review-lens quartet, do not
  reopen w/o evidence.
- Wave post-production (DEC-237..243, compact): live eval reopened
  DEC-069 — render-sweep misses SPA-vs-route payload-KEY mismatches,
  hence DEC-239 route-level contract tests on exact key names. DEC-237
  PBKDF2 100k cap+best-effort submit-confirm. DEC-238 mailer:
  best-effort/continue, organizer batch {sent,failed} 200 never 500.
  DEC-240 supersedes DEC-029 (deliverable_kind+previous_file_id chain).
  DEC-241 dropdown-criteria col. DEC-242 portal speaker self-service.
  DEC-243 Tracks names/Format col/labeled Columns picker. Human
  committed stage-2 (mailer, Airtable cron) on main — leave it.
- Wave 2 (DEC-244..246): planned during FIFTH late-drain — w1
  a/b/c/d/e/g/h merged into main WHILE planning (re-read refs before
  trusting file state); f active only after d merged; i never started.
  A+B P1s verified closed w/ contract tests. w2-a f-scope late-drain-
  immune (DEC-244 GET /portal/tasks/:id/file serves CHAIN-LATEST via
  previous_file_id, not organizer /files route). w2-b = DEC-245 SSR
  confirmations (save-draft ?draft=saved, 'Headshot uploaded.', login
  #chq-login-submit ratified). w2-c = DEC-239 sweep under DEC-246 (SPA
  types.ts is contract of record). w2-d/e build gate+findings closure.
  NEXT: DEC-069 exit battery+re-declare.
