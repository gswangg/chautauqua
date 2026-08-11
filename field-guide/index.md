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
- Wave16-20 (DEC-197..206, compact): DEC-199 lowercase+ci-dup emails,
  DEC-200 password-free welcome+/account/password SSR; DEC-201/202
  pubcache+KV limiter non-atomicity ACCEPTED stage-1. w18 lanes LATE
  DRAINERS: a85ddcc(DEC-199)/6807b67(DEC-200) landed during w19-20
  planning; '@1033d45' sections VOID. Battery task-w20-a..f binds
  FROZEN '@6807b67'; sha drift=FAIL-stop, no rebinding. 6/6 PASS
  @6807b67 (auth-flake PASS only solo).
- Wave 21 (DEC-207..209): 'merge task-w20-a' embedded LITERAL conflict
  markers in verification-log.md; repaired by task-w21-a; w21-b/c/d
  ran walkthrough/render-sweep/spec-audit fresh @FROZEN 6807b67.
  Wave22 exit declared a grep: marker-free + 6 PASS + OPEN ITEMS: 0.
- Wave 22 (DEC-210..217): DEC-208 predicate WAS met on main — but four
  review-lens defects reopened exit (DEC-210): eval-PUT missing
  in-event check (DEC-211), scorecard 500 (DEC-212), roundCriteria
  freeze gap (DEC-213), kind-gate bypass (DEC-214). DEC-215 reset-
  password endpoint+PlanEditor reveal; DEC-216 declines lower(email)
  migration; DEC-217 adds /account/password to routeManifest.
- Wave 23 (DEC-218..220): w22-a/b/d late-drained DURING w23 planning
  (merges 5cefa7b/d9c5b97/a486b5d after 6abb08d=w22-c) — all four
  defect fixes verified on main WITH tests (review.ts:627 in-event 404;
  evaluation.ts:83 zero-criteria aggregate; DEC-213 guard test;
  tasks.ts kind gates test). w22-e/f zero-commit dead stubs -> VOID,
  rebound (DEC-218): w23-a DEC-215 API + test/users-reset-password.test.ts, w23-b
  PlanEditor reveal button, w23-c DEC-217 manifest+sweep. DEC-219:
  battery ONLY when planner verifies all task-w* refs merged/VOID
  and freezes the sha LITERALLY in battery text (w20 pattern); wave
  24 runs fresh 6-gate battery. DEC-220: reset-password allows
  self-target, 404 only unknown/cross-org.
