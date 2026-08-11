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
  303 main moves UNDER planner, ports a-h(8791-8794/8787) '-c3-'
  MANDATORY; 308 drizzle-orm ^0.45.2(kit+config DELETED); 309 perf p95
  MINUS /health floor, schedule.ics=public; 310 getPublicAgendaByIds
  (never hydrate whole agenda); 312 SQL WHERE normative(precedent 317/
  318/323); 314 GATE polls 10x60s then PARTIAL+PROCEEDS; 315/316 exit-
  log rules superseded by 320/327.
- Campaign-2 w14-15 (DEC-317..327, compact): 317 invite=3 gates(public=
  visible+active,notify=active ONLY,portal read=not declined/write=
  active),zero-recipient compose rejects loudly. 318 4 public schedule_
  slot reads carry event bound. 319 batch=100+order+1h dedupe(cron=24h)
  +remainder,cap never reject. 321 default CFP optional locked job_
  title/company/bio,blank-only fill. 322 safeExternalUrl http/https
  allowlist. 320 EXIT=DEC-315 seven logs+w15 confirmation post-w14 sha.
  323 bare schedule.ics(no ?ids=)=WHOLE agenda via shared
  agendaIcsEvents mapper. 324 DEC-297->publicRoutes.onError(setCache
  Headers before throw,public 400/500=no-store). 325 pending-invitee
  FILE access follows WRITE gate(ACTIVE-only ratified). 326 probes
  derive dates from event under test,cite module that OWNS behaviour
  post-decomposition;repaired probe exposing product defect logs it,
  never loosens assertion. 327 EXIT=six w13 PASS logs+w15-a/b landed
  w/evidence+w15-c/d/e OPEN ITEMS:0/PASS; delta of only a/b never
  invalidates c/d/e. Ports: b=8795,d=8796,e=8797.
- Campaign-2 w16 (DEC-328)=ZERO-TASK WAIT per DEC-315/320/327: main
  tip='merge task-w15-a' ONLY, no w15 -c3- log anywhere, w15-b/c/d/e
  .wrangler/state=still running => DEC-327 predicate un-evaluable.
  ALL FOUR w16 lens findings STALE, closed by ANCHOR — auto-schedule=
  DEC-298(agenda.ts:129-153+schedule.ts:117-127,cited `numberOrDefault`
  absent); blank title/company=DEC-299+321(attribution.ts,profile.ts:
  138,crud.ts:109,submit.tsx:568-569); field delete=DEC-300(forms.ts:
  276-317,api/forms.ts:216-227 409/cascade=1); zero-track CFP=DEC-301
  (events.ts:223 'General'+submit-core.ts:49-51). RULE: lens citations
  age out — grep the SYMBOL not the line; absent/already-fixed=CLOSED,
  never a task. w13-b OPEN ITEM 2=PROBE defect(embed builder=settings/
  embedSnippet.ts not Settings.tsx). SPEC §10 items 2/3/4=DEC-061/085.
