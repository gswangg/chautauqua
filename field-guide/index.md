# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding, src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash'(workerd 100k cap); 005 route map+admin nav; 002 pure-
  core src/{auth,domain,forms,mail,lib} import nothing node:/cf; 012/013
  route files export Hono sub-apps, only src/index.ts mounts, middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}; 015 append-only/016
  locked=real cols/114 sha rule/129 homonym=full heading. Never hand-
  edit src/decisions.ts.
- Wave3-16 (DEC-012..328): sub-apps/repos/ctx/uploads/ics/statuses/perf/
  headshots/walkthrough/claim; criteriaForRound sole resolution; CRM=
  SegmentRule[]+'any'; battery FROZEN sha; tripwires(test/)x4; drizzle-
  orm ^0.45.2; 309 perf p95 MINUS /health; 317 invite=3 gates; 322
  safeExternalUrl allowlist; 323 bare .ics=WHOLE agenda; lens citations
  age out—grep SYMBOL not line.
- w17-18 (DEC-329..339): 329 probe premise vs binding=defect, narrow
  FETCH ok weaken ASSERTION never. 335 listSubmissions=ONE stmt+EXISTS+
  LIKE ESCAPE+seq tiebreak. 336/337 contacts AND-tokens x OR-cols SQL,
  schema.ts idx w/o migration DOESN'T EXIST.
- w19-22 (DEC-340..358): 340/341/344/345 J5/J6/J8/results/files/queue
  server-paged, fan-out+resultsSort.ts+find-in-loop DELETED. 346 plan
  loads shed `description`. 347 perf BASELINE at pre-fix tip. 353
  archive=40MB TOTAL-byte guard, buildZip ONCE. 354 plan_reviewer scope
  validated at WRITE + event guard. 355 bulk accept=set-based SELECTs.
  356 CSV import=email-scoped chunked+2000-row cap. 357 roster-add=one
  chunked load+ONE updateSubmissionStatuses. 358 pubcache purge CLOSED
  (201/333/348); exit set SUPERSEDED by 359-362.
- w23 (DEC-359..362): 359 EXIT=SIX gates, render-sweep/spec-audit/
  fresh-clone stale since w15/w11/never. 360 gate lanes LOG-ONLY: own
  exactly ONE file, never patch product; red=OPEN ITEM file:line w24.
  361 every gate proves 10 w21/w22 merges ancestors of FROZEN SHA
  before boot; drift LOGGED never STOP. Ports b=8851 c=8852 d=8853
  f=8855. 362 goalComplete iff all six task-w23-{a..f}-c3-*.md OPEN
  ITEMS: 0 + RESULT: PASS (main or worktree, 307).
- w24 (DEC-363..365): STAGE 1 COMPLETE. All six w23 gates read OPEN
  ITEMS: 0/RESULT: PASS at FROZEN SHA e3d558e (a-e on main, f in its
  worktree per 362/307); every commit after e3d558e is a 360 log-only
  gate merge, so main's code == the certified tree. Re-verified: one-
  command zero-secret dev (package.json:6-7 -> ensure-dev-vars copies
  .dev.vars.example), 18 migrations (0011 gap intentional; gate f's
  "19" is a log typo), smart placement + */15 cron, README For-
  evaluators + Sessionboard-importer roadmap. 364 gate-e's two "not
  statically verifiable" items DISCHARGED by sibling live lanes at
  same sha (d: 2x browser loads /admin/content zero console errors;
  b: 4-persona walkthrough) — deferral whose lanes ran green is
  closed, never carried. 365 lens items adjudicated at file:line, all
  non-defects/already-fixed: perf-smoke bodyUsed guard fine (clone()
  drain inside run(), inside timed window, perf-smoke.ts:157-170);
  contacts LIKE escaping live (contacts/query.ts:55 + crud.ts:132-135
  ESCAPE). pubcache purge CLOSED (201/333/348/358) — read and STOP.
  Stage 2 (provisioning, deploy, Resend, Airtable, DNS, CI, prod
  cache/perf) is a separate swarm, never a stage-1 open item.
