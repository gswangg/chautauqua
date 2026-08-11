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
- Wave-3..9+Campaign3+Waves2-9 (compact history): sub-apps/repos/ctx
  DEC-012/013/019; uploads/ics/statuses/perf/headshots/walkthrough/
  claim DEC-040-074; 2nd barrier DEC-107; DEC-068 log append-only;
  DEC-069 exit predicate. Campaign3: DEC-139 exit battery+render-sweep
  (DEC-144)+findings closure; DEC-140 .ics roundtrip; DEC-141 reviewers
  via plan assignments; DEC-143 dupes. Waves2-9 (DEC-147..178):
  criteriaForRound sole resolution; CRM filters ARE SegmentRule[]+
  'any'; calendar via formatDateOnly UTC; Pipeline=pipeline_entry+
  activity; Files=previous_file_id chains; ZIP=STORE-only<=50. Workers
  never edit eval-findings.md/verification-log.md/decisions/. Batteries
  drain LATE; W7/8/19 VOID dead stubs; W9 rebinds to task-w9-a.
- Wave10-15 (DEC-179..196, compact): CSV formula-escape; login-limiter
  failures-only; csrfFormOrHeader/logout; parseBoundedIdArray (64-char,
  1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts (never overwrite/
  read/print). S'=7561cc1 VOIDED->S''=task-w12-a->S'''=7f7477e (DEC-189
  w13-a..f COOPERATIVE, dedupe '@ sha'; ports 8951/8952); reopened by
  DEC-192/193 tracks+bulk chunking, DEC-194 data-required, DEC-191
  email_log nullable. Wave15: S''''=1033d45, 6th-gen lanes w15-a..f,
  homonyms dead task-w15-a..k + VOID w12/13.
- Wave16-20 (DEC-197..206, compact): w16 3/6, w17 5/6 PASS (auth-
  limiter flake non-blocking, checklist TRUE @d4ce240); reopened by
  DEC-199 lowercase+ci-dup emails, DEC-200 password-free welcome+
  /account/password SSR; DEC-201/202 pubcache+KV limiter non-atomicity
  ACCEPTED stage-1. w18 lanes LATE DRAINERS not dead — 'merge
  task-w18-a'(a85ddcc,DEC-199) & 'merge task-w18-b'(6807b67,DEC-200)
  landed during w19-20 planning; all '@1033d45' sections VOID. Battery
  task-w20-a..f binds FROZEN '@6807b67'; sha drift=FAIL-stop, no
  rebinding. Dead homonyms: task-w19-a..e, task-w20-a/b '@8c7f479'
  (FULL-heading only). Auth-flake PASS only if test/auth.test.ts passes
  solo. 6/6 PASS @6807b67 -> wave21 verifies ledger, declares done.
- Wave 21 (DEC-207..209): 'merge task-w20-a'(d1c13d2) embedded LITERAL
  conflict markers in docs/verification-log.md (self-merged w20-c
  unresolved); w20-a+w20-c PASS content both on main but shared one
  footer; w20-b walkthrough PASSed @6807b67 (detail file on main) but
  stranded on unmerged ref 3106e5c; w20-e/f never ran. Newest code-
  bearing sha still 6807b67. task-w21-a deletes the 3 marker lines,
  restores w20-a's own footer, cross-checks vs d1c13d2^2+ref task-w20-c;
  w21-b/c/d run walkthrough(8951)/render-sweep/spec-audit fresh @FROZEN
  6807b67 (confirm-else-run if a w20 homonym '@6807b67' drains late);
  w21-e triage-closure gated on repair. No 'task-w21' homonyms. Wave22
  exit=grep: marker-free + 6 PASS gates @6807b67 + OPEN ITEMS: 0.
