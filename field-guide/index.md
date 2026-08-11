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
  VOIDED. Campaign3: DEC-139 exit needs battery+render-sweep(DEC-144)+
  findings closure, sha descends 2dd2f33; DEC-140 .ics roundtrip+
  overlap; DEC-141 reviewers via plan assignments; DEC-143 dupes; DEC-
  145/146 seed+date helpers. Waves2-5 (DEC-147..166): criteriaForRound
  sole resolution; CRM filters ARE SegmentRule[]+'any'; drill-ins SSR
  gated by visibleSubmissionConditions; calendar via formatDateOnly
  UTC; Pipeline=pipeline_entry+activity; CNT-11=submission_revision
  snapshots; Files=previous_file_id chains; ZIP=src/lib/zip.ts STORE-
  only <=50. Workers never edit eval-findings.md, verification-log.md,
  decisions/, src/decisions.ts. Wave6-9 (DEC-167..178): batteries
  drain LATE; W7/8 VOID dead stubs; W9 rebinds to task-w9-a. Verify
  execution via reflog+branch refs.
- Wave10-13 (DEC-179..190, compact): CSV formula-escape; login-limiter
  failures-only; csrfFormOrHeader/logout; parseBoundedIdArray (64-
  char,1000 cap); DEC-187 .dev.vars via ensure-dev-vars.ts from
  .example (never overwrite/read/print local); DEC-184 CLOSED. S'=
  7561cc1 VOIDED by DEC-188 (629d57e real secret). DEC-190 AIRTABLE_
  TOKEN CLOSED. S''=task-w12-a -> S'''=7f7477e (DEC-189 w13-a..f
  COOPERATIVE, dedupe by full heading '@ sha', 10-min wait). 4th-gen
  homonyms @0ee30dd/d4ebf7f/3b7ed3d. Ports: walkthrough 8951, smoke
  8952.
- Wave 14 (DEC-191..195): 7f7477e battery hit 5/6 but four real
  defects reopened exit: DEC-192/193 tracks fetch+client bulk chunking
  (bulk.ts,500/batch,stop-loudly+refetch); DEC-194 data-required
  restores DEC-008 contract; DEC-191 email_log.contact_id=contact-or-
  NULL (nullable col, no migration). DEC-195: ALL 7f7477e sections
  VOID once w14 merges. 5th-gen homonyms @64141d0/0ba550c/7c4101c/
  ce451d9/675219f.
- Wave 15 (DEC-196): w14 fixes verified merged (w14-b 64a4687, w14-a
  a8c8c69, w14-c 1033d45) with tests; other findings re-verified
  stale. Battery binds S''''=1033d45 ('merge task-w14-c'), lanes w15-a
  build+test/w15-b walkthrough@8951/w15-c perf-smoke@8952/w15-d
  render-sweep/w15-e triage-closure(dependsOn a)/w15-f spec-audit —
  mapped so no lane+type pair collides with dead w15 sections. 6th-
  gen homonyms: dead task-w15-a..k @0ba550c/7c4101c/ce451d9/675219f +
  VOID w12/w13 @7f7477e — match full heading '@ 1033d45'. Six PASS
  @1033d45 => wave 16 re-derives sha, verifies ledger, zero tasks
  (DEC-069/139/195/196).
