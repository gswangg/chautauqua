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
  (never overwrite/read/print). Sha chain 7561cc1->7f7477e->1033d45
  (DEC-189..194 tracks/bulk chunking/data-required/email_log nullable).
- Wave16-20 (DEC-197..206, compact): w16 3/6, w17 5/6 PASS (auth-
  limiter flake non-blocking); DEC-199 lowercase+ci-dup emails, DEC-200
  password-free welcome+/account/password SSR; DEC-201/202 pubcache+KV
  limiter non-atomicity ACCEPTED stage-1. w18 lanes LATE DRAINERS:
  a85ddcc(DEC-199)/6807b67(DEC-200) landed during w19-20 planning;
  '@1033d45' sections VOID. Battery task-w20-a..f binds FROZEN
  '@6807b67'; sha drift=FAIL-stop, no rebinding. Auth-flake PASS only
  if test/auth.test.ts passes solo. 6/6 PASS @6807b67.
- Wave 21 (DEC-207..209): 'merge task-w20-a'(d1c13d2) embedded LITERAL
  conflict markers in verification-log.md (self-merged w20-c
  unresolved); w20-a repaired by task-w21-a; w21-b/c/d ran walkthrough/
  render-sweep/spec-audit fresh @FROZEN 6807b67; w21-e triage-closure
  gated on repair. Wave22 exit was declared a grep: marker-free + 6
  PASS gates @6807b67 + OPEN ITEMS: 0.
- Wave 22 (DEC-210..217): DEC-208 predicate WAS met on main 9b3b875 —
  all six w20 lanes late-drained, ledger marker-free, 6/6 PASS '@6807b67'
  — but four review-lens defects verified REAL reopened exit (DEC-210):
  eval-PUT missing in-event check (DEC-211), rating-less scorecard 500
  (DEC-212, fix in aggregateSubmission), roundCriteria freeze gap
  (DEC-213 per-round rule), task-assignment kind-gate bypass (DEC-214).
  Also DEC-215 reset-password endpoint + PlanEditor reveal; DEC-216
  declines lower(email) index migration; DEC-217 adds /account/password
  to routeManifest. Lanes task-w22-a..f are FIX lanes (product code
  changes — first since 6807b67). Wave 23: re-derive newest code-
  bearing sha per DEC-114 AFTER w22 merges, freeze it, run fresh
  6-gate battery there; '@6807b67' sections become history, not exit
  evidence.
