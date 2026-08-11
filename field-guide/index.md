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
  batteries VOIDED. Campaign3: DEC-139 exit needs battery+render-sweep
  (DEC-144)+findings closure, sha descends 2dd2f33; DEC-140 .ics
  roundtrip+overlap; DEC-141 reviewers via plan assignments; DEC-143
  dupes; DEC-145/146 seed+date helpers. Waves2-5 (DEC-147..166):
  criteriaForRound sole resolution; CRM filters ARE SegmentRule[]+
  'any'; drill-ins SSR gated by visibleSubmissionConditions; calendar
  via formatDateOnly UTC; Pipeline=pipeline_entry+activity; CNT-11=
  submission_revision snapshots; Files=previous_file_id chains; ZIP=
  src/lib/zip.ts STORE-only <=50. Workers never edit eval-findings.md,
  verification-log.md, decisions/, src/decisions.ts. Wave6-9 (DEC-
  167..178): batteries drain LATE; W7/8 VOID dead stubs; W9 rebinds
  battery to task-w9-a. Verify execution via reflog+branch refs.
- Wave10-13 (DEC-179..190, compact): DEC-179 CSV formula-escape; DEC-
  180 login-limiter failures-only; DEC-181 csrfFormOrHeader/logout;
  DEC-182 parseBoundedIdArray (64-char,1000 cap); DEC-187 .dev.vars
  untracked, scripts/ensure-dev-vars.ts materializes from .example
  (never overwrite/read/print local .dev.vars), supersedes DEC-183;
  DEC-184 conflict-marker repair CLOSED. S'=7561cc1 (w11, DEC-186)
  VOIDED by DEC-188 (629d57e untracked real secret, code-bearing).
  DEC-190: AIRTABLE_TOKEN CLOSED, never rewrite git. S''=task-w12-a
  merge (DEC-188, 3rd-gen homonyms) advanced to S'''=7f7477e (DEC-
  189): w13-a..f COOPERATIVE battery — dedupe-by-citation @ full
  heading incl '@ sha', 10-min sibling wait. 4th-gen homonyms
  @0ee30dd/d4ebf7f/3b7ed3d. Ports: walkthrough 8951, perf-smoke 8952.
- Wave 14 (DEC-191..195): 7f7477e battery reached 5/6 (triage-closure
  still in flight) but four REAL unwaived defects verified on tree =>
  correctness reopens exit. w14-a: DEC-192 tracks fetch + DEC-193
  client bulk chunking (bulk.ts, 500/batch, stop-loudly+refetch);
  w14-b: DEC-194 data-required attrs restore DEC-008 script contract;
  w14-c: DEC-191 email_log.contact_id = contact-or-NULL (types widen
  string|null, column already nullable, no migration). DEC-195: ALL
  7f7477e sections (incl. late w12-g/w13-* citations) VOID for exit
  once w14 merges; wave 15 binds fresh DEC-189-style cooperative
  battery at post-w14 sha AFTER main is quiescent. FIFTH-gen homonyms:
  w13 citations @7f7477e + dead task-w14-*/w15-* @64141d0/0ba550c/
  7c4101c/ce451d9/675219f — always match full heading '@ <sha>'.
