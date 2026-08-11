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
- Wave3-251+Campaign2 w1-w13 (DEC-012..316, ultra-compact): sub-apps/
  repos/ctx/uploads/ics/statuses/perf/headshots/walkthrough/claim;
  criteriaForRound sole resolution; CRM=SegmentRule[]+'any'; batteries
  LATE grep-not-prose; resolveBaseUrl+RELATIVE hrefs; mobile 390x844; 8
  sections a-h(g=fresh-clone,h=rubric->file:line+test); battery FROZEN
  sha POST-S DELTA never STOP, recusal/WAIVES ABS-14, seven contact FK
  tables; tripwires(test/)x4; embed PATH SUFFIX, `travel_logistics`,
  PUBLIC_BASE_URL=localhost:8787 DEV-only, public non-200=>no-store,
  schedule int+bounds 400, NULL backfill, field delete 409/cascade=1;
  303 main UNDER planner,ports a-h(8791-8794/8787)'-c3-' MANDATORY; 308
  drizzle-orm ^0.45.2(kit/config DELETED); 309 perf p95 MINUS /health
  floor,schedule.ics=public; 310 getPublicAgendaByIds(never hydrate
  whole agenda); 312 SQL WHERE normative(317/318/323); 314 GATE polls
  10x60s then PARTIAL+PROCEEDS; 315/316 exit-log superseded 320/327.
- Campaign-2 w14-16 (DEC-317..328, compact): 317 invite=3 gates(public/
  notify/portal read+write). 318 4 public schedule_slot reads event-
  bound. 319 batch=100+dedupe. 321 CFP optional locked job_title/
  company/bio. 322 safeExternalUrl allowlist. 323 bare schedule.ics=
  WHOLE agenda(agendaIcsEvents). 324 publicRoutes.onError no-store. 325
  pending-invitee files follow WRITE gate. 326 probes derive dates from
  event under test,cite module OWNS behaviour,repaired probe never
  loosens assertion. 327 EXIT=six w13 PASS+w15-a/b landed+w15-c/d/e
  OPEN ITEMS:0/PASS. 328 lens citations age out—grep SYMBOL not line;
  absent/fixed=CLOSED never a task(auto-sched=298,blank attr=299+321,
  field delete=300,zero-track=301). SPEC §10 items2/3/4=DEC-061/085.
- Campaign-2 w17 (DEC-329..332): DEC-327 predicate MET live on main—six
  w13 PASS + w15-a/b merged + w15-c/d/e ALL OPEN ITEMS:0/PASS (w15-d
  @2fe1ea0, six live w14 probes green). Sole blocker=w15-b OPEN ITEM 1.
  329 probe premise vs binding DEC=PROBE defect: rewrite BOTH directions
  (what must vanish AND what must remain) or repair rots to no-op;
  narrowing a FETCH(?q= vs PER_PAGE=12,?day=) allowed, weakening an
  assertion never. DEC-274 REAFFIRMED: hiding only participant hides the
  SPEAKER; session stays public with speakers:[]. 330 EXIT=DEC-327+w17-a
  green FULL public module+build/test at post-decomposition sha+w17-
  b/d/e OPEN ITEMS:0; nothing else re-runs. 331 perf must time all 5
  public surfaces+agenda.ics+BARE schedule.ics; over budget=logged
  product finding, never raised budget/dropped check. 332 repo/public.ts
  =BARREL over public/{gates,event,sessions,speakers,detail,agenda}.ts
  —cite the submodule; decomposition never sheds guards (DEC_258 marker
  in EVERY module reading title_at_time/org_at_time). gate:render-sweep
  boots OWN seed+findFreePort—never brief one w/external --url/port.
  Ports: a=8791 b=8792 e=8793 d=8794.
