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
  locked=real cols/114 sha rule/129 homonym=full heading. Never hand-edit
  src/decisions.ts.
- Wave3-16 (DEC-012..328): sub-apps/repos/ctx/uploads/ics/statuses/perf/
  headshots/walkthrough/claim; criteriaForRound sole resolution; CRM=
  SegmentRule[]+'any'; battery FROZEN sha; tripwires(test/)x4; drizzle-
  orm ^0.45.2; 309 perf p95 MINUS /health; 317 invite=3 gates; 322
  safeExternalUrl allowlist; 323 bare .ics=WHOLE agenda; lens citations
  age out—grep SYMBOL not line.
- w17-18 (DEC-329..339): 329 probe premise vs binding=defect, narrow
  FETCH ok weaken ASSERTION never. 331 perf 5 surfaces+.ics. 333 STAGE-1
  scale=cost~TOTAL rows+observable on D1=>defect now. 335 listSubmissions
  =ONE stmt+EXISTS+LIKE ESCAPE+seq tiebreak. 336 contacts=AND-tokens x
  OR-cols SQL. 337 schema.ts idx w/o migration DOESN'T EXIST.
- w19-20 (DEC-340..349): 340 J6 grid server-paged, SUPERSEDES 023. 341
  J8 SQL filter+sort+page, fan-out DELETED. 342 queue+files DEFERRED
  ->344 files lib server-paged, find-in-loop DELETED. 345 results rank
  server-side, resultsSort.ts DELETED. 346 plan loads shed
  `description`, queue counts=GROUP BY. 347 perf BASELINE at pre-fix
  tip. 348 DEC-201/202 REAFFIRMED (pubcache purge OK as-is).
- w21 (DEC-350..352): 350 J5 picker server-paged(50)+q, selection SPANS
  pages. 351 /progress+/remind=listCompletedPairsForPlan, /results
  keeps listEvaluationsForPlan (buildResults); wire bytes unchanged.
  352 gate log dies only to a change altering what it ASSERTS: SPA-only
  / wire-identical shedding do NOT invalidate walkthrough/perf but DO
  need build/test re-run.
- w22 (DEC-353..358): 353 archive=40MB TOTAL-byte guard, buildZip ONCE.
  354 plan_reviewer trackId/submissionId validated at WRITE AND
  isSubmissionInReviewerScope gets event guard too. 355 bulk accept=
  set-based SELECTs. 356 CSV import=email-scoped chunked+2000-row cap.
  357 roster-add=one chunked load+ONE updateSubmissionStatuses;
  createSubmission per-row. 358 pubcache purge CLOSED (201/333/348);
  342 files-lib DISCHARGED by 344 — exit set SUPERSEDED by 359-362.
- w23 (DEC-359..362): 359 EXIT=SIX gates, not 358's three — render-sweep
  last ran w15 (BEFORE 340/341/344/345/350 SPA server-paging; no gate has
  loaded admin bundle in browser since), spec/rubric audit last ran w11,
  fresh-clone+cron never proven e2e (SPEC §0). 360 gate lanes LOG-ONLY:
  own exactly ONE file (own docs/verification-log/task-w23-X-c3-*.md),
  never patch product code, never touch shared docs/verification-log.md;
  red=OPEN ITEM w/ file:line for w24 (284/315). 361 every gate proves the
  10 w21/w22 merges are ancestors of its FROZEN SHA before a boot cycle
  (commit msg + 5 code facts), bounded wait then worktree recreate; drift
  LOGGED never STOP (280). Ports b=8851 c=8852 d=8853 f=8855. 362
  goalComplete iff all six task-w23-{a..f}-c3-*.md read OPEN ITEMS: 0 +
  RESULT: PASS (main or worktree, 307); else narrow fix wave. pubcache
  purge CLOSED (201/333/348/358) — read and STOP.
