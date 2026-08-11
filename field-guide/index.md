# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding; src/decisions.ts compile-checked.
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
- Wave3-251+Campaign2 w1-w16 (DEC-012..328, ultra-compact): sub-apps/
  repos/ctx/uploads/ics/statuses/perf/headshots/walkthrough/claim;
  criteriaForRound sole resolution; CRM=SegmentRule[]+'any'; batteries
  LATE grep-not-prose; resolveBaseUrl+RELATIVE hrefs; mobile 390x844; 8
  sections a-h; battery FROZEN sha POST-S DELTA never STOP, recusal/
  WAIVES ABS-14; tripwires(test/)x4; PUBLIC_BASE_URL=localhost:8787
  DEV-only, NULL backfill; drizzle-orm ^0.45.2(kit/config DELETED); 309
  perf p95 MINUS /health floor,schedule.ics=public; 310
  getPublicAgendaByIds(never hydrate whole agenda); 312 SQL WHERE
  normative; 314 GATE polls 10x60s then PARTIAL+PROCEEDS; 317 invite=3
  gates; 318 4 public schedule_slot reads event-bound; 319 batch=100+
  dedupe; 322 safeExternalUrl allowlist; 323 bare schedule.ics=WHOLE
  agenda; 326 probes derive dates from event under test,repaired probe
  never loosens assertion; 327 EXIT=six w13 PASS+w15-a/b landed+w15-c/
  d/e OPEN ITEMS:0/PASS; 328 lens citations age out—grep SYMBOL not
  line;absent/fixed=CLOSED never a task.
- Campaign-2 w17 (DEC-329..332): 329 probe premise vs binding DEC=
  PROBE defect: rewrite BOTH directions, narrowing a FETCH allowed,
  weakening an ASSERTION never. DEC-274 REAFFIRMED: hiding participant
  hides SPEAKER. 330 EXIT=DEC-327+w17-a/b/d/e green. 331 perf covers
  all 5 public surfaces+agenda.ics+BARE schedule.ics; over budget=
  logged finding, never raised budget/dropped check. 332 repo/public.ts
  =BARREL over public/{gates,event,...,agenda}.ts—cite the submodule;
  decomposition never sheds guards (DEC_258 marker in EVERY module).
- Campaign-2 w18 (DEC-333..339): 333 STAGE-1 scale rule=cost scales w/
  TOTAL rows not page size AND observable on local D1=>product defect
  now; stage-2 only if needs real edge/provider (201 pubcache coarse
  bump, 202 KV rate limit stay CLOSED). Lens findings closed by anchor:
  public agenda date-bound=318 at public/agenda.ts:40/:120; remindNow
  capped=319. 334 dashboard numbers=SQL COUNT/MAX, never materialized
  rows (email_log sent_at=timestamp_ms, bind NUMBER); aggregateComms
  Counts DELETED. 335 listSubmissions=ONE paginated stmt, q/trackId=
  correlated EXISTS, LIKE escapes \\%_ w/ ESCAPE, ORDER BY carries seq
  tiebreaker; sortSubmissionRows deleted. 336 contacts q=exact AND-
  tokens x OR-cols in SQL (266 semantics kept), matchesContactQuery
  deleted; segment/rules=only documented whole-directory path. 337
  index in schema.ts w/o a CREATE INDEX migration DOESN'T EXIST—parity
  test covers indexes; 0018 single-lane-owned. 338 perf covers
  onboarding grid/reviewer queue/email-log; seed grows tasks+
  assignments+5k email_log; `optional:true` removed. 339 w18 supersedes
  w17-c build/test: wave19 re-runs ONLY build+test+tripwires,
  walkthrough producer+data,perf:smoke. Ports: a=8795 b=8796 c=8797
  d=8798.
