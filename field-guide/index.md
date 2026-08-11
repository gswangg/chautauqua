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
  exit battery+render-sweep+findings closure DEC-068/069/139; criteriaForRound
  sole resolution (DEC-147..178); CRM=SegmentRule[]+'any'; Files=
  previous_file_id chains; DEC-179-231 CSV/login-limiter/email-ci-dup/SSR/
  checkbox/cascades; DEC-232-251 post-prod hardening: batteries drain LATE
  (recheck reflog, grep-code-not-prose, workers never edit eval-findings.md/
  decisions/), render-sweep misses SPA-vs-route KEY mismatches (contract
  tests, types.ts=contract), PBKDF2 100k, deliverable_kind chain, portal
  self-service CHAIN-LATEST, Tracks/Format allowlist, flat {items}. Human
  committed stage-2 (mailer, Airtable cron) — leave alone.
- Campaign-2 w1/w2 (DEC-252..257): resolveBaseUrl+RELATIVE hrefs; mobile
  390x844 zero h-overflow; 8 sections a-h incl g fresh-clone bootstrap
  (README-verbatim), h=116 rubric ids -> file:line+test.
- Campaign-2 w4 (DEC-262..267): w2 battery 6/8. Quiescence+worktree verify.
  Contact q=AND-tokens x OR-columns, pure fns src/domain/contacts.ts (repo
  layer NO real-D1 harness, only fakeDb). Every *_id indexed via
  getTableConfig; migrations hand-authored, db:generate DELETED, parity test.
- Campaign-2 w5 (DEC-268..273) @ main=73042c3+: all four w4 fixes LANDED.
  Fresh clone never builds public/admin (gitignored) -> /admin 404s empty;
  predev+render-sweep now vite-build. DEC-271=ABS-12 recusal; DEC-272 WAIVES
  ABS-14; DEC-273 approve/maybe/deny = reviewer RECOMMENDATION, never a 6th
  status. DEC-270: wave 6 = battery ONLY, PLANNER names the 40-char frozen
  sha. Tripwires (test/): docs-route-coverage, spa-contract-sweep,
  schema-fk-indexes, migration-parity.
- Campaign-2 w6 (DEC-274..279) @ main=ade5aa7: wave 5 STILL IN FLIGHT (only
  task-w5-a merged; recusal SPA files present but migration 0017 +
  schema.reviewRecusal NOT). DEC-279 re-points DEC-270's battery to first
  ZERO-product-task wave (w7); protocol unchanged/binding. DEC-274 public
  gates SPLIT: visibleSessionConditions (accepted+content-approved) vs
  visibleParticipantConditions (visible+invite); session queries drop
  mandatory innerJoin(participant), EMB-02 search -> gated leftJoin,
  speakerless sessions render speakers:[]. DEC-275 clone copies ACTIVE
  participants only, reset invite 'none'. DEC-276 bearer auth re-resolves
  minting user every request (exists+role=organizer+org match), no expiry
  col. DEC-277 slot day must be in event range on WRITE; out-of-range reads
  unscheduled, counts in summary.unplaced, payload shape frozen. DEC-278
  ensureOnboardingTasks fires at LAST of (accepted, participant active);
  invited/declined excluded; ACTIVE_INVITE_STATUSES twin of DEC-274 SQL gate.
