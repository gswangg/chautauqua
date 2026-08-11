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
  012/013: route files export Hono sub-apps, only src/index.ts mounts;
  middleware sessionLoader/requireOrganizer/requireReviewer/require
  Speaker/csrfJson/csrfForm; errors {error:{code,message,fields?}};
  DEC-015 append-only; DEC-016 locked=real cols; DEC-114 sha rule;
  DEC-129 homonym guard: match full heading incl. '@ <sha>'.
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
  dead stubs; W9 rebinds to task-w9-a.
- Wave10-15 (DEC-179..196, compact): CSV formula-escape; login-limiter
  failures-only; csrfFormOrHeader/logout; parseBoundedIdArray (64-
  char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts (never
  overwrite/read/print local). S'=7561cc1 VOIDED DEC-188; S''=task-
  w12-a -> S'''=7f7477e (DEC-189 w13-a..f COOPERATIVE, dedupe by full
  heading '@ sha'); ports walkthrough 8951/smoke 8952. 7f7477e battery
  5/6, 4 defects reopened exit (DEC-192/193 tracks+bulk chunking 500/
  batch stop-loudly+refetch; DEC-194 data-required DEC-008; DEC-191
  email_log.contact_id nullable); DEC-195 VOID 7f7477e once w14 merges.
  Wave15 (DEC-196): w14 merged (w14-b 64a4687/a a8c8c69/c 1033d45);
  S''''=1033d45, lanes w15-a build+test/b walkthrough/c perf-smoke/d
  render-sweep/e triage-closure(dep a)/f spec-audit; 6th-gen homonyms
  dead task-w15-a..k + VOID w12/13@7f7477e (match full '@ 1033d45').
  Wave16-17 (DEC-197/198): two holds draining 1033d45 battery — w16
  3/6 (auth-limiter flake dispositioned non-blocking); w17 5/6 PASS,
  w15-e triage-closure verified-complete but uncommitted @ d550885.
- Wave 18 (DEC-199..203): DEC-197 checklist TRUE @ d4ce240 (six PASS
  @ 1033d45) — DEC-198 hatch moot. Reopened by 2 NEW defects: DEC-199
  emails stored lowercase+case-insensitive dup check; DEC-200 welcome
  email never carries password + /account/password SSR route
  (csrfForm, revoke-all+reissue), linked from profile/Settings. DEC-
  201/202 pubcache bump + KV limiter non-atomicity ACCEPTED stage-1.
  DEC-203: '@ 1033d45' sections VOID once any w18 fix merges; wave 19
  re-derives sha, binds 7th-gen battery (full-heading guard; auth-
  flake disposition carries; preconditions: toLowerCase in users.ts,
  lower( in users repo, accountRoutes mounted, email password-free).
