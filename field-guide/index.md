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
- Wave3-251+Campaign2 w1-w10 (DEC-012..302, ultra-compact): sub-apps/
  repos/ctx/uploads/ics/statuses/perf/headshots/walkthrough/claim;
  criteriaForRound sole resolution; CRM=SegmentRule[]+'any'; batteries
  LATE grep-not-prose; resolveBaseUrl+RELATIVE hrefs; mobile 390x844; 8
  sections a-h(g=fresh-clone,h=rubric->file:line+test); 270-282 wave-N
  battery FROZEN sha POST-S DELTA never STOP, recusal/WAIVES ABS-14,
  seven contact FK tables; 285-287 logs MANDATORY, exit superseded by
  303/304/307/315/320; tripwires(test/)x4; 289-302: embed PATH SUFFIX,
  `travel_logistics`, PUBLIC_BASE_URL=localhost:8787 DEV-only, public
  non-200=>no-store, schedule int+bounds 400, NULL backfill, field
  delete 409/cascade=1.
- Campaign-2 w11-13 (DEC-303..316, compact): w11 303 main moves UNDER
  planner, ports a-h(8791-8794/8787) '-c3-' MANDATORY(305/314). w12: 308
  drizzle-orm ^0.45.2(kit+config DELETED); 309 perf p95 MINUS /health
  floor, schedule.ics=public; 310 getPublicAgendaByIds(never hydrate
  whole agenda); 312 SQL WHERE normative(precedent 317/318/323). w13:
  314 GATE polls 10x60s then PARTIAL+PROCEEDS; 315 exit=seven -c3- logs
  OPEN ITEMS:0/PASS(superseded 320/327); 316 §D row=OPEN ITEM only if
  action fails.
- Campaign-2 w14 (DEC-317..322)=NARROW FIX, not battery. 317: invite=3
  gates — public(visible AND active), notify(active ONLY), portal(read=
  not declined,write=active); zero-recipient compose rejects loudly
  (unscheduledIcsFields-style). 318: 4 public schedule_slot reads carry
  event [startDate,endDate] bound. 319: batch=100+order+1h dedupe(cron=
  24h)+remainder, cap never reject. 321: default CFP gains optional
  locked job_title/company/bio, blank-only fill. 322: safeExternalUrl
  http/https allowlist gates first user href. 320 EXIT: DEC-315's seven
  logs AND wave-15 confirmation post-w14 sha; (i) not (ii)=>wait.
- Campaign-2 w15 (DEC-323..327)=NARROW FIX on w13-b's FAIL + DEC-320(ii)
  confirmation. VERIFIED live: ALL SIX wave-14 fixes on main (317/318/319/
  321/322 anchors at file:line); DEC-315 now evaluates and FAILS — six w13
  -c3- logs PASS, task-w13-b-c3-walkthrough.md = OPEN ITEMS: 3 / FAIL, all
  three reproduce. 323: bare schedule.ics (no ?ids=) publishes the WHOLE
  agenda via shared agendaIcsEvents mapper; inline duplicate mapping
  deleted. 324: DEC-297 moves to publicRoutes.onError (setCacheHeaders
  runs BEFORE the throw, so public 400/500 shipped max-age=60). 325:
  pending-invitee FILE access follows the WRITE gate — files-authz
  ACTIVE-only is ratified, never an open item. 326: probes derive dates
  from the event under test, cite the module that OWNS the behaviour post-
  decomposition; a repaired probe exposing a product defect logs it, never
  loosens the assertion. 327 EXIT: six w13 PASS logs + w15-a/b landed with
  their own evidence + w15-c/d/e at OPEN ITEMS:0/PASS. Delta of only w15-
  a/b never invalidates c/d/e. Ports this wave: b=8795, d=8796, e=8797.
