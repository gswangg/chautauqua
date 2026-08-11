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
  DEC-016 locked=real cols; DEC-114 sha rule; DEC-129 homonym guard = full heading incl '@ <sha>'.
- Wave3-251 (Campaign1-3, ultra-compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074;
  DEC-068/069 log+exit predicate; DEC-139 exit battery+render-sweep+findings
  closure; criteriaForRound sole resolution (DEC-147..178); CRM=SegmentRule[]
  +'any'; Files=previous_file_id chains; DEC-179-231 CSV formula-escape/
  login-limiter/lowercase+ci-dup emails/password-free SSR/checkbox===true/
  deleteTrack 409 cascades; DEC-232-236 FROZEN f01459a w27 6/6 (reopened) —
  batteries drain LATE, recheck reflog, grep-code-not-prose, workers never
  edit eval-findings.md/decisions/. DEC-237-251 post-prod: render-sweep
  misses SPA-vs-route KEY mismatches (DEC-239 contract tests, types.ts=
  contract DEC-246); DEC-237 PBKDF2 100k; DEC-240 supersedes DEC-029
  (deliverable_kind chain, DEC-248 widens serve pop); DEC-242/244 portal
  self-service CHAIN-LATEST; DEC-243/249 Tracks/Format col+allowlist;
  DEC-245 SSR confirms; DEC-247 flat {items}. DEC-250 FREEZES c211d4c ended
  5/6 (walkthrough FAILED DEC-252 bug); DEC-251 Section D (D1-D4+D6 fixed,
  rest WAIVED). Human committed stage-2 (mailer, Airtable cron), leave it.
- Campaign-2 w1/w2 (DEC-252..257): DEC-252 fix = src/server/origin.ts
  resolveBaseUrl + RELATIVE hrefs, gates never fetch off-origin hrefs.
  DEC-253 mobile 390x844 zero h-overflow. DEC-254 one persona lane/J-area,
  log task-w1-<x>, 'OPEN ITEMS: n'/'RESULT:'. DEC-255 superseded by DEC-256:
  freeze BY RULE — wait for every task-w1-* ref ancestor of main, S=newest
  first-parent commit outside {decisions/, field-guide/, docs/verification-
  log/, docs/eval-findings.md, src/decisions.ts}; print `FROZEN SHA:`,
  re-derive at end, movement=DRIFT. 8 sections a-h incl g fresh-clone
  evaluator bootstrap (DEC-257, README-verbatim default 8787), h all 116
  rubric ids -> file:line+test; lanes read-only, declares only 8/8 PASS,
  OPEN ITEMS:0, 1 FROZEN SHA.
- Campaign-2 w3 (DEC-258..261) is the LAST product-touching wave; DEC-256
  battery lanes only log. main=1e08bc8; wave-1 a/b/c/d/h PASS OPEN ITEMS:0
  (e/f/g never landed); no campaign-2 w2 log on main yet. DEC-258: participant
  .title_at_time/org_at_time snapshot at creation, migration-backfilled;
  public/exports/showflow/.ics read SNAPSHOT ONLY (no fallback), CRM/portal
  read LIVE contact — last unimplemented clarifications.md item. DEC-259:
  logs at task-w3-<x>-c2-<scope>.md ('-c2-' MANDATORY, DEC-129); fix ONLY
  inside owned-file list w/ failing-before regression test, else OPEN ITEM;
  evidence, never a battery section/FROZEN SHA. DEC-260: multi-form CFP
  stays out. DEC-261: w4 re-runs DEC-256's 8 sections unchanged, only
  battery-FAIL fixes after; stage 1 declares w4+. Lane craft: playwright
  drivers in .scratch/ (NOT gitignored, delete before commit); non-default
  port needs --var PUBLIC_BASE_URL:http://localhost:PORT; commit early,
  worktrees reclaimable mid-task; migrations/ skips 0011.
