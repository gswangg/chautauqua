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
- Wave-3..9+Campaign3+Waves2-5 (very compact): sub-apps/repos/ctx DEC-
  012/013/019; uploads/ics/statuses/perf/headshots/walkthrough/claim
  DEC-040-074 (DEC-059 superseded DEC-084); 2nd barrier DEC-107 (DEC-
  108..111); DEC-068 log append-only; DEC-069 exit predicate; W19/W21
  VOIDED. Campaign3: DEC-139 exit battery+render-sweep(DEC-144)+
  findings closure; DEC-140 .ics roundtrip+overlap; DEC-141 reviewers
  via plan assignments; DEC-143 dupes; DEC-145/146 seed+date helpers.
  Waves2-5 (DEC-147..166): criteriaForRound sole resolution; CRM
  filters ARE SegmentRule[]+'any'; drill-ins SSR gated by visible
  SubmissionConditions; calendar via formatDateOnly UTC; Pipeline=
  pipeline_entry+activity; Files=previous_file_id chains; ZIP=STORE-
  only <=50. Workers never edit eval-findings.md/verification-log.md/
  decisions/. Wave6-9 (DEC-167..178): batteries drain LATE; W7/8 VOID
  dead stubs; W9 rebinds to task-w9-a. Wave19 (DEC-204): w18 lanes
  looked dead at planning; DEC-199/200 reissued as task-w19-a/b.
- Wave10-15 (DEC-179..196, very compact): CSV formula-escape; login-
  limiter failures-only; csrfFormOrHeader/logout; parseBoundedIdArray
  (64-char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts (never
  overwrite/read/print). S'=7561cc1 VOIDED->S''=task-w12-a->S'''=
  7f7477e (DEC-189 w13-a..f COOPERATIVE, dedupe by full heading '@
  sha'; ports walkthrough 8951/smoke 8952); 5/6, reopened by DEC-192/
  193 tracks+bulk chunking, DEC-194 data-required, DEC-191 email_log
  nullable; VOID once w14 merges. Wave15 (DEC-196): S''''=1033d45,
  6th-gen lanes w15-a..f, homonyms dead task-w15-a..k + VOID w12/13.
  Wave16-18 (DEC-197..203, compact): w16 3/6, w17 5/6 PASS (auth-
  limiter flake non-blocking, checklist TRUE @ d4ce240); reopened by
  DEC-199 lowercase+ci-dup emails and DEC-200 password-free welcome +
  /account/password SSR; DEC-201/202 pubcache bump + KV limiter non-
  atomicity ACCEPTED stage-1.
- Wave 20 (DEC-205/206): w18 lanes were LATE DRAINERS, not dead —
  'merge task-w18-a' (a85ddcc, DEC-199 + tests) and 'merge task-w18-b'
  (6807b67, full DEC-200: account.tsx, mount, password-free welcome,
  profile+Settings links, test/account-password.test.ts) landed
  during waves 19-20 planning. All '@ 1033d45' sections VOID (DEC-203
  original trigger). w19 refs deleted unmerged (zero commits, scope
  duplicated). Battery: task-w20-a..f bind FROZEN '@ 6807b67' — sha
  drift = FAIL-and-stop, no rebinding. Dead homonyms now include
  task-w19-a..e and task-w20-a/b '@ 8c7f479': FULL-heading matches
  only. Auth-flake PASS only if test/auth.test.ts passes solo. 6/6
  PASS @ 6807b67 -> wave 21 verifies ledger, declares stage-1 done.
