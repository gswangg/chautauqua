# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding; src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237, workerd
  100k cap); DEC-005 route map+admin nav; DEC-002 pure-core src/{auth,
  domain,forms,mail,lib} import nothing node:/cf. DEC-012/013: route
  files export Hono sub-apps, only src/index.ts mounts; middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}. DEC-015 append-only;
  DEC-016 locked=real cols; DEC-114 sha rule; DEC-129 homonym=full
  heading incl '@ <sha>'. Workers never hand-edit src/decisions.ts.
- Wave3-251 (Campaign1-3, ultra-compact): sub-apps/repos/ctx DEC-012/013/
  019; uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074;
  exit battery+render-sweep+findings DEC-068/069/139; criteriaForRound
  sole resolution (DEC-147..178); CRM=SegmentRule[]+'any'; Files=
  previous_file_id chains; DEC-179-231 CSV/login-limiter/email-ci-dup/
  SSR/checkbox/cascades; DEC-232-251 batteries drain LATE, grep-not-prose.
- Campaign-2 w1-w9 (DEC-252..292, ultra-compact): resolveBaseUrl+
  RELATIVE hrefs; mobile 390x844; 8 battery sections a-h (g=fresh-clone
  README-verbatim, h=rubric ids->file:line+test); Contact q=AND-tokens x
  OR-cols; every *_id indexed; migrations hand-authored (db:generate
  DELETED); fresh clone never builds public/admin (gitignored); DEC-271
  recusal, DEC-272 WAIVES ABS-14, DEC-273 recommendation!=6th status;
  DEC-270/279/280/281 wave-N battery protocol (planner-named FROZEN sha,
  POST-S DELTA never a STOP); DEC-282 seven contact FK tables; DEC-283
  assignToAll=ACTIVE only; DEC-285/286 pre-register in-flight defects,
  logs=docs/verification-log/task-w8-<x>-c2-<scope>.md MANDATORY;
  DEC-287 exit=planner-only grep over 8 files (superseded w11 by DEC-303/
  304). Tripwires(test/): docs-route-coverage, spa-contract-sweep, schema-
  fk-indexes, migration-parity. W9: DEC-289 public/embed shared params
  (PATH SUFFIX); DEC-290 roster optional `eventId`; DEC-291 GET .../
  response new route; DEC-292 custom fields=key/value+`travel_logistics`.
- Campaign-2 w10 (DEC-293..302): DEC-287 grep FAILS(a-e PASS, f/g/h
  FAIL). DEC-293 waives 2 doc-typo rows; DEC-294 bounds treadmill=w11
  battery-only. Fixes: DEC-295 304=success; DEC-296 PUBLIC_BASE_URL=
  localhost:8787 DEV_MODE-only; DEC-297 public non-200=>no-store; DEC-
  298 schedule params int+bounds 400; DEC-299 title/org_at_time NULL
  backfill; DEC-300 field delete 409/cascade=1; DEC-301 new event=
  'General' track; DEC-302 npm audit --omit=dev.
- Campaign-2 w11 (DEC-303..306)=BATTERY-ONLY, 8 sections, ZERO product
  commits. main moved UNDER the planner, so DEC-303 kills planner-declared
  FROZEN literal: each lane resolves S=refs/heads/main live, passes 7-item
  WAVE-10 CONTENT GATE (304-not-500, PUBLIC_BASE_URL loopback default,
  public no-store, schedule param bounds, title/org_at_time backfill,
  field-delete cascade=1, event 'General' track), 60s x15min poll if
  MISSING. DEC-305 map/ports: a=build-test, b=walkthrough(8791), c=perf
  (8792), d=render(8793), e=spec-audit, f=triage(8794), g=fresh-clone
  (8787 DEFAULT no --var), h=rubric; logs=task-w11-<x>-c3-<scope>.md,
  '-c3-' infix MANDATORY (a-f collide w/ campaign-1 homonyms). DEC-304
  exit: 8 files x {GATE:PASS, OPEN:0, RESULT:PASS}, sha identity NOT
  required; w12 then declares stage1 at main, 0 tasks, goalComplete:true.
  DEC-306: merge.ts task_assignment tie-break is CORRECT (keeps KEPT row
  via FK repoint) — review claim refuted, never "fix" it.
