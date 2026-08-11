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
- Campaign-2 w1/w2 (DEC-252..257, compact): DEC-252 fix src/server/origin.ts
  resolveBaseUrl + RELATIVE hrefs. DEC-253 mobile 390x844 zero h-overflow.
  DEC-254 persona lanes log task-w1-<x>. DEC-255 superseded by DEC-256/262
  (freeze protocol, see below). 8 sections a-h incl g fresh-clone bootstrap
  (DEC-257, README-verbatim 8787), h=116 rubric ids -> file:line+test.
- Campaign-2 w4 (DEC-262..267). Verified main=6a3bb88+: w2 battery landed
  6/8 - b/c PASS@1e08bc8, d PASS@e002bc9, a FAIL(drift only), e FAIL(drift;
  3 narrow items), f FAIL(2 REAL defects); g/h NEVER ran. DEC-262: DEC-256
  step 1 amended - wait covers EVERY task-* ref + QUIESCENCE (main tip
  unchanged 120s, poll 15s/40min), verify in `git worktree add --detach S`,
  and the battery may only be scheduled in a wave with ZERO product tasks;
  battery moves w4 -> w5. DEC-264: w4 = DEC-261-permitted battery-FAIL
  fixes + sections g/h run as EVIDENCE (no FROZEN SHA); logs
  task-w4-<x>-c2-<scope>.md ('-c2-' mandatory, campaign-1 owns task-w4-a/
  -c/-d/-e names). WAIVED: w1-a baseline-count typo; b/c/d SHA
  non-uniformity (DEC-262 remedies). DEC-265 participant rows carry
  name+email server-side, `${first} ${last}`.trim(), POST==reload.
  DEC-266 contact q = AND-tokens x OR-columns, pure fns in src/domain/
  contacts.ts + superset SQL prefilter (repo layer has NO real-D1 harness,
  only fakeDb - put testable logic in the pure core). DEC-267 every *_id
  column indexed, tripwire test via getTableConfig; migration 0016, 0015
  RESERVED for wave-3 DEC-258. DEC-263 migrations are hand-authored,
  db:generate DELETED (meta/ stale at 0004), parity guarded by
  test/migration-parity.test.ts. Confirmed present, stop re-auditing:
  prefetch-on-hover app/src/App.tsx:50-95; ics SEQUENCE bump agenda.ts:409.
