# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/images/eval-rubric/*.yaml/fixtures never product code.
  decisions/DEC-*.md binding, src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility. STAGE 1 zero-secret wrangler dev;
  external services behind ports. 003 table/enums; 004 hash 'pbkdf2$v1$
  100000$salt$hash'(workerd 100k cap); 005 route map+admin nav; 002 pure-
  core src/{auth,domain,forms,mail,lib} import nothing node:/cf; 012/013
  route files export Hono sub-apps, only src/index.ts mounts, middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}; 015 append-only/016
  locked=real cols/114 sha rule/129 homonym=full heading. Never hand-
  edit src/decisions.ts.
- Wave3-16 (DEC-012..328): sub-apps/repos/ctx/uploads/ics/statuses/perf/
  headshots/walkthrough/claim; criteriaForRound sole resolution; CRM=
  SegmentRule[]+'any'; battery FROZEN sha; tripwires(test/)x4; drizzle-
  orm ^0.45.2; 309 perf p95 MINUS /health; 317 invite=3 gates; 322
  safeExternalUrl allowlist; 323 bare .ics=WHOLE agenda; lens citations
  age out—grep SYMBOL not line.
- w17-22 (DEC-329..358): 335 listSubmissions=ONE stmt+EXISTS+LIKE
  ESCAPE+seq tiebreak; 336/337 contacts AND-tokens x OR-cols SQL. J5/J6/
  J8/results/files/queue server-paged, fan-out/find-in-loop DELETED.
  353 archive=40MB TOTAL-byte guard, buildZip ONCE. 354 plan_reviewer
  scope validated at WRITE+event guard. 355-357 bulk ops set-based
  (accept/CSV-import/roster-add). 358 pubcache purge CLOSED; exit set
  SUPERSEDED by 359-362.
- w23-24 (DEC-359..365): STAGE 1 COMPLETE. Six w23 gates all OPEN
  ITEMS: 0/RESULT: PASS at FROZEN SHA e3d558e; gate lanes LOG-ONLY (own
  ONE file, never patch product). 364/365 discharge deferred+lens items
  file:line, all non-defects. Stage 2 (provisioning/deploy/Resend/
  Airtable/DNS/CI/prod cache) = separate swarm, never a stage-1 item.
- REDESIGN RUN w1 (DEC-366..371): stage-1 FUNCTION IS FROZEN/COMPLETE
  (six w23 gates PASS @ e3d558e). New binding mandate = docs/design/
  README.md + 11 *.dc.html + screens/*.png, ranked just under
  clarifications.md for visual/layout/copy; SPEC still governs behaviour,
  authz, data model, perf. Settled items (pubcache 201/333/348/358,
  ABS-14 272, all stage-2 wiring) are NEVER open items.
- 367 tokens: --chq-paper F4F1E8 / surface FAF8F2 / sunk EFEBDF / ink
  1B1D17 / muted 565A4B / hairline E1DDCE / rule D3CFC0 / border BAB6A6
  / brand olive 4E5C31 / on-brand F7F9F0. NO RED, no third accent —
  lateness+clash are TYPE (.chq-flag 10-11px/800/.09-.11em/upper/ink).
  Fonts self-hosted /fonts/*-var.woff2, woff2-variations + weight RANGE.
  Floors: 10px type, 44px phone tap, AA, no shadows, nav underline =
  box-shadow inset 0 -2px 0 (never border-bottom). No new deps.
- 368 CSS ownership: app/src/styles.css = SHELL LANE ONLY (all shared
  .chq-* classes). Page lanes add co-located <area>.css imported by the
  page module, classes .chq-<area>-* — never redefine a shared class.
- 369 chrome: sidebar DELETED; top header (wordmark+horizontal nav+event
  +user) + phone 5-tab bar; nav = destinations only, badge only for
  exceptions from overview aggregates. 371 SSR: one THEME_CSS string in
  src/views/theme.ts inlined by every SSR shell (watch hono/jsx escaping
  — unquoted attribute selectors); per-event accent recolours only
  --chq-brandable-accent, never palette/text/buttons.
- 370 Overview = worklist payload v2 (rows+deadlines, v1 aggregate keys
  RETAINED, rows capped 5); actions reuse existing endpoints; NO "next
  free slot"/published-at copy — never assert what no endpoint stores.
