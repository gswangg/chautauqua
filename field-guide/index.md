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
  domain,forms,mail,lib} import nothing from node:/cloudflare. DEC-
  012/013 route files export Hono sub-apps, only src/index.ts mounts,
  middleware sessionLoader/requireOrganizer/requireReviewer/require
  Speaker/csrfJson/csrfForm, errors {error:{code,message,fields?}};
  DEC-015 append-only; DEC-016 locked=real cols; DEC-114 sha rule;
  DEC-129 homonym guard match full heading incl. '@ <sha>'.
- Wave3-15+Campaign3 (compact history): sub-apps/repos/ctx DEC-012/013/
  019; uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-
  074; 2nd barrier DEC-107; DEC-068/069 log+exit predicate; DEC-139
  exit battery+render-sweep(144)+findings closure; criteriaForRound
  sole resolution (DEC-147..178); CRM=SegmentRule[]+'any'; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+activity; Files=
  previous_file_id chains; ZIP=STORE-only<=50. Workers never edit
  eval-findings.md/verification-log.md/decisions/. Batteries drain
  LATE, dead stubs VOID on rebind. DEC-179-196: CSV formula-escape;
  login-limiter failures-only; csrfFormOrHeader/logout; parseBounded
  IdArray(64-char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts
  (never overwrite/read/print). Sha chain 7561cc1->7f7477e->1033d45.
- Wave16-20 (DEC-197..206, compact): lowercase+ci-dup emails, password-
  free welcome+/account/password SSR, pubcache+KV limiter non-atomicity
  ACCEPTED stage-1. w18 LATE DRAINERS a85ddcc/6807b67 landed during
  w19-20 planning; '@1033d45' VOID. Battery FROZEN @6807b67, 6/6 PASS.
- Wave 21 (DEC-207..209): 'merge task-w20-a' embedded LITERAL conflict
  markers in verification-log.md, repaired task-w21-a; battery fresh
  @FROZEN 6807b67, grep marker-free.
- Wave 22 (DEC-210..217): four review-lens defects reopened exit (eval-
  PUT in-event check, scorecard 500, roundCriteria freeze gap, kind-
  gate bypass); DEC-215 reset-password endpoint+PlanEditor reveal;
  DEC-216 declines lower(email) migration; DEC-217 /account/password
  in routeManifest.
- Wave 23 (DEC-218..220): w22-a/b/d late-drained DURING w23 planning
  (verified on main w/ tests). w22-e/f called dead stubs -> VOID,
  rebound w23-a/b/c (DEC-218). DEC-219: battery only after planner
  verifies all task-w* merged/VOID, sha frozen LITERALLY in task text.
  DEC-220: reset-password self-target allowed, 404 only unknown/cross-org.
- Wave 24 (DEC-221/222): w22-e/f were NOT dead — THIRD late-drain of
  campaign (f459735=w22-f, 0a263d2=w22-e landed during w23 planning).
  Entire w23 remit already on main (users.ts:101 reset-password +
  users-api.test.ts DEC-215 block; PlanEditor reveal; manifest x3) ->
  DEC-221 VOIDs zero-commit task-w23-a/b/c; drop unmerged; late w23
  merge = sha drift FAIL-stop. DEC-222: FROZEN literal 0a263d2e6e4d
  bf438f6ad9e98bffa6af527b965c (merge task-w22-e; 617679b scribe=
  bookkeeping-only), 6 gates task-w24-a..f, each writes ONLY docs/
  verification-log/task-w24-*.md, own worktree+port (walkthrough
  8961, perf 8962). Wave25: complete IFF 6/6 PASS @0a263d2 + zero
  new defects. LESSON: recheck reflog before trusting "dead stub".
