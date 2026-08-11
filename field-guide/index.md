# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all; brief/
  images; sessionboard-reference; eval-rubric/*.yaml; fixtures (never
  product code). decisions/DEC-*.md binding; src/decisions.ts compile-
  checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237 amended,
  workerd 100k cap); DEC-005 route map+admin nav; DEC-002 pure-core
  src/{auth,domain,forms,mail,lib} import nothing node:/cf. DEC-012/013:
  route files export Hono sub-apps, only src/index.ts mounts; middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}. DEC-015 append-only;
  DEC-016 locked=real cols; DEC-114 sha rule; DEC-129 homonym guard matches
  full heading incl '@ <sha>'.
- Wave3-251 (Campaign1-3, ultra-compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074;
  DEC-068/069 log+exit predicate; DEC-139 exit battery+render-sweep+findings
  closure; criteriaForRound sole resolution (DEC-147..178); CRM=SegmentRule[]
  +'any'; Files=previous_file_id chains; DEC-179-231 CSV formula-escape/
  login-limiter/lowercase+ci-dup emails/password-free SSR/checkbox===true/
  deleteTrack 409 cascades; DEC-232-236 FROZEN f01459a w27 6/6 (reopened) —
  batteries drain LATE, recheck reflog, grep-code-not-prose, workers never
  edit eval-findings.md/decisions/. DEC-237-251 post-prod: DEC-069 reopened
  (render-sweep misses SPA-vs-route KEY mismatches, hence DEC-239 contract
  tests, types.ts=contract DEC-246); DEC-237 PBKDF2 100k; DEC-240 supersedes
  DEC-029 (deliverable_kind chain, DEC-248 widens serve pop); DEC-242/244
  portal self-service CHAIN-LATEST; DEC-243/249 Tracks/Format col+allowlist;
  DEC-245 SSR confirms; DEC-247 flat {items}. DEC-250 FREEZES c211d4c ended
  5/6 (walkthrough FAILED DEC-252 origin bug; triage never landed) — DEC-069
  NOT met. DEC-251 disposes Section D (D1-D4+D6 fixed, rest WAIVED). Human
  committed stage-2 (mailer, Airtable cron) on main, leave it.
- Campaign-2 wave 1 (DEC-252..255, compact): prior DEC-250 battery ended 5/6
  -> stage 1 NOT complete. DEC-252 origin bug: wrangler custom_domain makes
  req.url origin=chautauqua.cc under `wrangler dev`; fix = src/server/
  origin.ts resolveBaseUrl + RELATIVE hrefs; gates never fetch off-origin
  scraped hrefs. DEC-253 mobile 390x844 zero h-overflow, agenda grid
  scrolls in own container. DEC-254 one browser-persona lane/J-area, log
  task-w1-<x> w/ sha, 'OPEN ITEMS: n'/'RESULT:'. DEC-255 superseded DEC-256.
- Campaign-2 wave 2 (DEC-256/257). VERIFIED by direct .git read, not
  inherited: main=e0d3379 (task-w1-b..f STILL unmerged w/ live worktrees at
  planning time) -> no literal freeze sha nameable. DEC-256: freeze BY RULE
  — wait (<=15min) for every task-w1-* ref to be ancestor of main, then
  S=newest first-parent commit touching anything outside {decisions/,
  field-guide/, docs/verification-log/, docs/eval-findings.md,
  src/decisions.ts appends}; print `FROZEN SHA:`, head log `# task-w2-<x> -
  <scope> @ <sha>` (DEC-129: w2-d/e logs exist), re-derive S at end —
  movement=DRIFT=FAIL. 8 sections: a build+test, b walkthrough(8821),
  c perf-smoke(8822), d render-sweep incl DEC-253 mobile, e SPEC6/7+
  clarifications, f triage-closure of w1 OPEN ITEMs, g fresh-clone
  evaluator bootstrap (DEC-257, README-verbatim default 8787 — the stranger
  test no worktree gate can run, only check-shape that'd catch DEC-252),
  h all 116 rubric ids -> file:line+test. Lanes read-only: 1 log file, 0
  product commits (DEC-069). Stage 1 declares only 8/8 PASS, OPEN ITEMS:0,
  1 FROZEN SHA literal.
