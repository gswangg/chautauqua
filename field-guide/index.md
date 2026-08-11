# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all; brief/-
  images; sessionboard-reference; eval-rubric/*.yaml; fixtures (never product
  code). decisions/DEC-*.md binding; src/decisions.ts compile-checked, scribe-
  owned.
- House invariants: fail loudly; status changes never auto-email; authz every
  route, server-side visibility filtering for public data. STAGE 1 zero-secret
  local wrangler dev; external services behind ports. DEC-003 table/enums;
  DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route map+admin nav;
  DEC-002 pure-core src/{auth,domain,forms,mail,lib} import nothing from
  node:/cloudflare. DEC-012/013: route files export Hono sub-apps, only
  src/index.ts mounts; middleware sessionLoader/requireOrganizer/
  requireReviewer/requireSpeaker/csrfJson/csrfForm; errors {error:{code,
  message,fields?}}. DEC-015 append-only; DEC-016 locked=real cols; DEC-114 sha
  rule; DEC-129 homonym guard matches full heading incl '@ <sha>'.
- Wave3-22+Campaign3 (compact history): sub-apps/repos/ctx DEC-012/013/ 019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; 2nd
  barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole resolution
  (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via formatDateOnly UTC;
  Pipeline=pipeline_entry+activity; Files=previous_file_id chains; ZIP=STORE-
  only<=50. Workers never edit eval-findings.md/verification-
  log.md/decisions/. Batteries drain LATE, dead stubs VOID on rebind.
  DEC-179-196: CSV formula-escape; login-limiter failures-only;
  csrfFormOrHeader/logout; parseBoundedIdArray(64-char, 1000 cap); DEC-187
  .dev.vars via ensure-dev-vars.ts (never overwrite/read/print). Sha chain
  7561cc1->7f7477e->1033d45. DEC-197-206: lowercase+ci-dup emails, password-
  free welcome+/account/password SSR, pubcache+KV limiter non-atomicity
  ACCEPTED stage-1; w18 late drainers a85ddcc/6807b67, '@1033d45' VOID, FROZEN
  @6807b67 6/6 PASS. DEC-207-217: conflict-marker repair, four review-lens
  defects, reset-password endpoint+PlanEditor reveal, lower(email) migration,
  /account/password manifest. DEC-218-222 (w23-24): w22-a/b/d late-drained,
  w22-e/f wrongly called dead->VOID (THIRD late-drain, 0a263d2=w22-e) then
  rebound w23-a/b/c which VOIDed zero-commit since w23 remit already on main;
  late w23 merge=drift FAIL-stop; FROZEN 0a263d2, 6 gates task-w24-a..f, ports
  8961/8962. LESSON: recheck reflog before trusting "dead stub".
- Wave 25 (DEC-223..225, compact): FOURTH late-drain — w23-a (871ee28)/ w23-b
  (b2dc2c1) landed after DEC-222 froze 0a263d2; w24-a FAIL-stopped, w24-b..f no
  evidence. DEC-223 accepts late content, re-freezes LITERAL
  b2dc2c103309433732bc689b933610fc7cfb3b06. DEC-224: w24 battery VOID, LATE-
  DRAIN-IMMUNE accounting — exit counts ONLY docs/verification-
  log/task-w25-*.md; stray w24 log merges allow-listed, never drift. DEC-225:
  battery task-w25-a..f, ports 8963/8964, sha check allow-lists
  decisions//field-guide//docs/verification-log//eval-findings//decisions.ts-appends.
  LESSON: search-tool rendering can mangle '//' — verify via raw Read.
- Wave 26 (DEC-226..231, compact): w25 battery drained ONLY lane a (build+test
  PASS@b2dc2c1); w25-b..f stubs, moot — planner VERIFIED 4 live defects at
  frozen sha, DEC-225 fixes-first fired. DEC-227 required checkbox must be
  ===true (validate.ts only); DEC-228
  buildCsrfCookie/buildDraftCookie+isSecureRequest in src/auth/cookies.ts,
  HttpOnly+conditional Secure all 8 mint sites; DEC-229 deleteTrack 409s on
  form.tracks_json/plan filters_json/plan_reviewer.track_id refs, never
  cascades; DEC-230 two-pass DST, gap->forward, overlap->earlier. DEC-226:
  b2dc2c1 freeze SUPERSEDED, wave 27 reruns FULL 6-gate battery at a fresh sha.
  DEC-231: CRM-02 closed (contacts.ts:224-288) — w24-f open item was prose-grep
  false negative; grep code symbols, not report prose.
