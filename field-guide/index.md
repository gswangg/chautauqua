# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all; brief/-
  images; sessionboard-reference; eval-rubric/*.yaml; fixtures (never product
  code). decisions/DEC-*.md binding; src/decisions.ts compile-checked,
  scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237
  amended, workerd 100k cap); DEC-005 route map+admin nav; DEC-002
  pure-core src/{auth,domain,forms,mail,lib} import nothing node:/cf.
  DEC-012/013: route files export Hono sub-apps, only src/index.ts
  mounts; middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}. DEC-015 append-only; DEC-016 locked=real cols; DEC-114
  sha rule; DEC-129 homonym guard matches full heading incl '@ <sha>'.
- Wave3-251 (Campaign1-3, compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074;
  DEC-068/069 log+exit predicate; DEC-139 exit battery+render-sweep+
  findings closure; criteriaForRound sole resolution (DEC-147..178);
  CRM=SegmentRule[]+'any'; Files=previous_file_id chains; DEC-179-231
  CSV formula-escape/login-limiter/lowercase+ci-dup emails/password-
  free SSR/checkbox===true/deleteTrack 409 cascades; DEC-232-236
  FROZEN f01459a, w27 battery 6/6 PASS (later reopened). Batteries
  drain LATE; recheck reflog; grep-code-not-prose; workers never edit
  eval-findings.md/decisions/. DEC-237-251 post-prod: DEC-069
  reopened — render-sweep misses SPA-vs-route KEY mismatches, hence
  DEC-239 contract tests (types.ts=contract, DEC-246); DEC-237 PBKDF2
  100k; DEC-240 supersedes DEC-029 (deliverable_kind chain, DEC-248
  widens serve pop); DEC-242/244 portal self-service CHAIN-LATEST;
  DEC-243/249 Tracks/Format col+allowlist; DEC-245 SSR confirms;
  DEC-247 flat {items} envelope. DEC-250 FREEZES battery at c211d4c,
  ended 5/6 (task-w4-b walkthrough FAILED on DEC-252 origin bug;
  triage-closure never landed) — DEC-069 NOT met. DEC-251 disposes
  Section D: D1-D4+D6 fixed, D5/D7-residual/D8 WAIVED. Human
  committed stage-2 (mailer, Airtable cron) on main, leave it.
- Campaign-2 wave 1 (DEC-252..255). VERIFIED on main @ b2127bb (not inherited):
  prior campaign's DEC-250 battery ended 5/6 — a/c/d/e logged OPEN ITEMS: 0,
  task-w4-b walkthrough FAILED (2 items), and the 6th section (triage-closure)
  never landed, so DEC-069 was never met: stage 1 is NOT complete. DEC-252:
  wrangler.jsonc's routes/custom_domain (human stage-2, untouchable) makes
  `new URL(c.req.url).origin` = chautauqua.cc under `wrangler dev`; sole fix is
  src/server/origin.ts resolveBaseUrl (PUBLIC_BASE_URL -> dev-only loopback
  Origin/Referer -> request origin) + RELATIVE same-origin hrefs; gates must
  never fetch an off-origin scraped href -- fail loudly instead. DEC-253 mobile
  bar 390x844: zero page-level h-overflow on public/submit/portal/login, agenda
  grid scrolls in its own container at minmax(140px,1fr), enforced by a second
  render-sweep pass. DEC-254 browser persona passes are SPEC 9.1's real bar
  (every last-round defect was invisible to unit/contract/render gates): one
  lane per J-area, own worktree + own port 88NN, fix only your listed files,
  regression test per fix, log docs/verification-log/task-w1-<x>-<scope>.md
  headed with the sha and ending 'OPEN ITEMS: n' / 'RESULT: PASS|FAIL'; a clean
  0-item PASS is a fine outcome -- never invent work. DEC-255: stage 1 closes
  only on a fresh six-section battery (build+test, walkthrough, perf, render-
  sweep incl. mobile, 6/7 audit, triage-closure of all w1 OPEN ITEMS) at one
  new frozen sha with OPEN ITEMS: 0 everywhere.
