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
- Wave3-22+Campaign3 (compact history): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; 2nd
  barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139 exit
  battery+render-sweep(144)+findings closure; criteriaForRound sole resolution
  (DEC-147..178); CRM=SegmentRule[]+'any'; calendar via formatDateOnly UTC;
  Pipeline=pipeline_entry+activity; Files=previous_file_id chains; ZIP=STORE-
  only<=50. Workers never edit eval-findings.md/verification-log.md/decisions/.
  Batteries drain LATE, dead stubs VOID on rebind. DEC-179-196: CSV formula-
  escape; login-limiter failures-only; csrfFormOrHeader/logout;
  parseBoundedIdArray(64-char,1000 cap); DEC-187 .dev.vars via
  ensure-dev-vars.ts (never overwrite/read/print). Sha chain 7561cc1->
  7f7477e->1033d45. DEC-197-206: lowercase+ci-dup emails, password-free
  welcome+/account/password SSR, pubcache+KV limiter non-atomicity ACCEPTED
  stage-1; w18 late drainers a85ddcc/6807b67, FROZEN @6807b67 6/6 PASS.
  DEC-207-217: conflict-marker repair, review-lens defects, reset-password+
  PlanEditor reveal, lower(email) migration. DEC-218-222 (w23-24): w22-e/f
  wrongly called dead->VOID (THIRD late-drain) then rebound w23-a/b/c
  zero-commit; late w23 merge=drift FAIL-stop; FROZEN 0a263d2, 6 gates
  task-w24-a..f, ports 8961/8962. LESSON: recheck reflog before trusting
  "dead stub".
- Wave25-27 (compact): DEC-223..225 FOURTH late-drain, refroze LITERAL
  b2dc2c1, late-drain-immune accounting (exit counts only verification-log
  files), battery task-w25-a..f ports 8963/8964; search-tool '//' mangling
  LESSON. DEC-226..231 w25 lane-a-only drain, 4 live defects fixed (checkbox
  ===true, cookie HttpOnly/Secure all 8 sites, deleteTrack 409 tracks_json/
  filters_json/track_id never cascade, two-pass DST gap-forward/overlap-
  earlier), CRM-02 grep-code-not-prose lesson. DEC-232..234 w26 fix lanes
  drained DURING planning, recheck refs mid-session; FROZEN LITERAL f01459a;
  battery task-w27-a..f ports 8965/8966; deleteField dangling refs fail-safe,
  fix declined.
- Wave 28 (DEC-235/236): w27 battery drained 6/6 PASS @ f01459a — a/d/e/c/f
  merged (main 4ef4448), b committed d8fe456 mid-session (SIXTH mid-session
  drain; counted per DEC-224 late-drain-immune accounting, merge routine).
  Prompt's "new" review-lens quartet verified STALE — pre-fix line numbers,
  all closed by DEC-211..214 with regression tests; do not reopen (DEC-236).
  STAGE 1 DECLARED COMPLETE at f01459a (DEC-235). Housekeeping only: prune
  task-w27-* and tmp-main-check refs after b's log lands.
