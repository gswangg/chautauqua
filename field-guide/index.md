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
  DEC-287 exit=planner-only grep over 8 files, stage1=greatest RECHECK
  (deferred at w9). Tripwires(test/): docs-route-coverage, spa-contract-
  sweep, schema-fk-indexes, migration-parity. W9: DEC-289 public/embed
  shared params (allowlisted, format=PATH SUFFIX); DEC-290 roster add/
  import=optional `eventId` on contact endpoints; DEC-291 GET /api/v1/
  task-assignments/:id/response (new routes MUST hit docs.tsx); DEC-292
  custom fields=key/value rows+`travel_logistics` textarea.
- Campaign-2 w10 (DEC-293..302) @ main=2eb80f81: DEC-287 GREP RUN,
  PREDICATE FAILS. a-e=FROZEN 80b811d+OPEN:0+PASS+RECHECK 5035438; f
  FAIL(7) g FAIL(2) h FAIL(1). DEC-293 waives 2 baseline-count doc-typo
  rows (never count OPEN again); other rows map to w9 (SPK-03/SPK-15/
  EMB-15) or w10 (304-as-500, off-origin link, public-404 cache header).
  DEC-294 BOUNDS THE TREADMILL: wave 11=battery-only, 8 sections, ONE
  frozen sha over waves 9+10, task-w11-<x>-c3-<scope>.md, ZERO product
  commits; wave-12 re-runs DEC-287 -> stage-1 sha; w10 is last product
  wave unless w11 reds. Fixes: DEC-295 fetchAdminShell 304 IS success
  (res.ok OR 304). DEC-296 .dev.vars.example ships PUBLIC_BASE_URL=
  localhost:8787; DEV_MODE-only, loopback origin outranks a LOOPBACK
  PUBLIC_BASE_URL. DEC-297 public non-200 => no-store. DEC-298 auto-
  schedule params=integer allowlist+bounds, 400 on violation, domain
  asserts loop termination. DEC-299 NULL title_at_time/org_at_time
  backfills on any contact title/company write. DEC-300 field delete=
  409 naming dependents unless ?cascade=1, then clear rules+delete
  answers+field. DEC-301 new event gets a 'General' track; zero OFFERED
  tracks=no requirement. DEC-302 dev-only npm audit accepted; w11
  build-test records `npm audit --omit=dev`.
