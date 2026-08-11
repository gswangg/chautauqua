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
  battery to task-w9-a. Verify execution via reflog+branch refs+
  ledger tail, never summaries.
- Wave 10 (DEC-179..185): DEC-179 CSV formula-escape; DEC-180 login-
  limiter failures-only; DEC-181 csrfFormOrHeader on /logout; DEC-182
  parseBoundedIdArray (64-char,1000 cap); DEC-183 DEV_MODE in
  .dev.vars (superseded by DEC-187); w8-b's raw conflict markers:
  DEC-184 one-time repair, CLOSED. DEC-185 rebinds battery to S'.
- Wave 11 (DEC-186/190, VOID for exit): S'=7561cc1, battery fully
  drained LATE (w11-a..e PASS; w11-f's FAIL was a sibling-merge race,
  not a defect) but still void (629d57e postdates it). AIRTABLE_TOKEN
  CLOSED (DEC-190): operator untracked .dev.vars; never rewrite git.
- Wave 12 (DEC-187/188): operator 629d57e untracked .dev.vars (real
  secret had landed in it) — binding+code-bearing, voiding w11-a's
  PASS too. DEC-187: .dev.vars untracked; scripts/ensure-dev-vars.ts
  materializes from .dev.vars.example (never overwrite/read/print
  local .dev.vars), wired via predev+render-sweep+ci.yml. DEC-188:
  six-gate battery at S''=merge of task-w12-a; THIRD-gen homonyms.
- Wave 13 (DEC-189): task-w12-a MERGED mid-planning => S'''=7f7477e,
  DEC-187 conformant. w12-b..g gates may drain CONCURRENTLY: w13-a..f
  run COOPERATIVE battery — each gate first searches ledger for same-
  type PASS @ S''' full-heading (either battery) and cites it instead
  of re-running; triage-closure waits up to 10 min for sibling merges.
  FOURTH-gen homonyms @0ee30dd/d4ebf7f/3b7ed3d. Ports: w13 walkthrough
  8951, perf-smoke 8952. Five gate-types PASS + green triage-closure
  at one S''' => wave 14 declares stage-1 complete.
