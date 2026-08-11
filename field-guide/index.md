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
  DEC-129 homonym guard.
- Wave-3..9+Campaign3+Waves2-5 (very compact): sub-apps/repos/ctx DEC-
  012/013/019; uploads/ics/statuses/perf/headshots/walkthrough/claim
  DEC-040-074 (DEC-059 superseded DEC-084); 2nd barrier DEC-107 (DEC-
  108..111); DEC-068 log append-only; DEC-069 exit predicate; W19/W21
  batteries VOIDED. Campaign3: DEC-139 exit needs battery+render-sweep
  (DEC-144)+findings closure, sha descends 2dd2f33; DEC-140 .ics
  roundtrip+overlap; DEC-141 reviewers via plan assignments; DEC-143
  dupes; DEC-145/146 seed+date helpers. Waves2-5 (DEC-147..166):
  criteriaForRound sole resolution; CRM filters ARE SegmentRule[]+
  'any'; drill-ins SSR gated by visibleSubmissionConditions; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+activity; CNT-11=
  submission_revision snapshots; Files=previous_file_id chains; ZIP=
  src/lib/zip.ts STORE-only <=50. Workers never edit eval-findings.md,
  verification-log.md, decisions/, src/decisions.ts. Wave6 (DEC-167..
  172): batteries drain LATE; render-test mocks mirror real wire
  shapes. Waves7+8 (DEC-173..177, VOID): dead stubs. Wave9 (DEC-178):
  rebinds battery to task-w9-a. Lesson: verify execution via reflog+
  branch refs+ledger tail, never summaries.
- Wave 10 (DEC-179..185): w8-b merge committed raw conflict markers
  into docs/verification-log.md (DEC-184 one-time repair, CLOSED per
  DEC-186). Fixes, DEC-tagged in source: DEC-179 CSV formula-escape;
  DEC-180 login limiter counts-failures-only; DEC-181 csrfFormOrHeader
  on /logout+portal token; DEC-182 parseBoundedIdArray (64-char,1000
  cap); DEC-183 DEV_MODE in .dev.vars (superseded by DEC-187 below).
  DEC-185 rebinds battery to S' grepping DEC-177+179..183 markers.
- Wave 11 (DEC-186, VOID except w11-a): S'=7561cc1. Only w11-a ran
  (PASS); w11-b..e refs parked bdc472b zero commits, w11-f never
  spawned — dead branches, never reuse. Orphan task-w11-e spec-audit
  report never merged, no ledger section: cite nothing from it.
- Wave 12 (DEC-187/188): operator commit 629d57e untracked .dev.vars
  (a real secret had landed in it) — binding AND code-bearing per
  DEC-114, so it voids w11-a's PASS too. Fresh clones were red:
  wrangler-config test read .dev.vars, walkthrough needs DEV_MODE for
  /dev/mailbox. DEC-187: .dev.vars stays untracked; scripts/ensure-
  dev-vars.ts copies .dev.vars.example when absent (never overwrite,
  NEVER read/print local .dev.vars), wired via predev+render-sweep+
  ci.yml; test retargets .example, guards .gitignore. DEC-188: full
  six-gate battery at S''=merge of task-w12-a; gates w12-b..f chained
  on w12-a (S'' must exist), w12-g on w12-c. THIRD-generation task-
  w12-* homonyms in ledger — full-heading '@ <sha>' matching only.
  Six PASS at one S''+OPEN ITEMS 0 => wave 13 stage-1 complete.
