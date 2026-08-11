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
  DEC-129 homonym guard: match full ledger heading incl. '@ <sha>'.
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
  only <=50. Workers never edit eval-findings.md, verification-log.md,
  decisions/, src/decisions.ts. Wave6-9 (DEC-167..178): batteries
  drain LATE; W7/8 VOID dead stubs; W9 rebinds to task-w9-a.
- Wave10-13 (DEC-179..190, compact): CSV formula-escape; login-limiter
  failures-only; csrfFormOrHeader/logout; parseBoundedIdArray (64-
  char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts (never
  overwrite/read/print local). S'=7561cc1 VOIDED by DEC-188 (real
  secret). S''=task-w12-a -> S'''=7f7477e (DEC-189 w13-a..f
  COOPERATIVE, dedupe by full heading '@ sha'). 4th-gen homonyms
  @0ee30dd/d4ebf7f/3b7ed3d. Ports: walkthrough 8951, smoke 8952.
- Wave 14 (DEC-191..195): 7f7477e battery hit 5/6, 4 real defects
  reopened exit (DEC-192/193 tracks+bulk chunking bulk.ts 500/batch
  stop-loudly+refetch; DEC-194 data-required DEC-008 contract; DEC-191
  email_log.contact_id nullable). DEC-195 VOID all 7f7477e once w14
  merges. 5th-gen homonyms @64141d0/0ba550c/7c4101c/ce451d9/675219f.
- Wave 15 (DEC-196): w14 fixes merged w/tests (w14-b 64a4687, w14-a
  a8c8c69, w14-c 1033d45). Battery binds S''''=1033d45, lanes w15-a
  build+test/b walkthrough@8951/c perf-smoke@8952/d render-sweep/e
  triage-closure(dep a)/f spec-audit. 6th-gen homonyms dead task-w15-
  a..k + VOID w12/13@7f7477e — match full heading '@ 1033d45'.
- Wave 16 (DEC-197): hold, ZERO tasks — battery 3/6 @1033d45 (spec-
  audit/build+test/walkthrough PASS), lanes c/d/e live (perf 8952,
  render, triage); reissuing collides ports/mints homonyms. w15-a's
  auth-limiter full-suite-only flake DISPOSITIONED non-blocking, not
  an open item. Wave 17 declares complete iff: sha still 1033d45, six
  PASS full headings '@ 1033d45', zero conflict-markers, no live w15
  branch refs.
