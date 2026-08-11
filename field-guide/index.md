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
  DEC-016 locked=real cols; DEC-114 sha rule; DEC-129 homonym = full heading incl '@ <sha>'.
- Wave3-251 (Campaign1-3, ultra-compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; exit
  battery+render-sweep+findings DEC-068/069/139; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; Files=previous_file_id
  chains; DEC-179-231 CSV/login-limiter/email-ci-dup/SSR/checkbox/cascades;
  DEC-232-251 post-prod: batteries drain LATE, grep-code-not-prose, workers
  never edit eval-findings.md/decisions/; render-sweep misses SPA-vs-route
  KEY mismatches; PBKDF2 100k; deliverable_kind chain; portal CHAIN-LATEST;
  Tracks/Format allowlist; flat {items}. Human stage-2 (mailer, Airtable cron) — leave alone.
- Campaign-2 w1/w2/w4 (DEC-252..267): resolveBaseUrl+RELATIVE hrefs; mobile
  390x844 zero h-overflow; 8 sections a-h (g=fresh-clone bootstrap README-
  verbatim, h=116 rubric ids->file:line+test); quiescence+worktree verify.
  Contact q=AND-tokens x OR-columns, pure fns src/domain/contacts.ts; every
  *_id indexed via getTableConfig; migrations hand-authored, db:generate
  DELETED.
- Campaign-2 w5 (DEC-268..273): fresh clone never builds public/admin
  (gitignored) -> /admin 404s empty; predev+render-sweep now vite-build.
  DEC-271=ABS-12 recusal; DEC-272 WAIVES ABS-14; DEC-273 approve/maybe/deny
  = RECOMMENDATION never a 6th status. Tripwires (test/): docs-route-
  coverage, spa-contract-sweep, schema-fk-indexes, migration-parity.
- Campaign-2 w6/w7 (DEC-274..284, all LANDED by w6 merge, verified @
  main=80b811d): public.ts:42/53/71 split gates, middleware.ts:151 bearer
  re-resolve, agenda.ts:336 day-range. DEC-270/279/280 wave-N battery
  protocol, POST-S DELTA never a STOP; DEC-281 wave-8-IS-the-battery;
  DEC-282 SEVEN contact FK tables; DEC-283 assignToAllAccepted=ACTIVE only;
  DEC-284 gate lane reports red, never fixes it.
- Campaign-2 w8 (DEC-285..287) @ S=80b811d250285de0d37417ddc12f65445ce27f96:
  THE battery wave per DEC-281 — 8 sections a-h, zero product tasks. Wave 7
  still unmerged at S (task-w7-a @ tip w/ 0 commits, task-w7-c @ 5f54097),
  so POST-S DELTA is expected NON-EMPTY. DEC-285 pre-registers 2 known
  in-flight defects (contacts.ts:207 six of SEVEN contact FK tables ->
  pipeline.ts:161 throws org-wide; tasks.ts:263 unfiltered listAccepted-
  ContactIds): at S they're KNOWN IN-FLIGHT, re-checked in a SECOND
  detached worktree at recorded `RECHECK SHA:`, OPEN only if still present.
  DEC-286: logs = docs/verification-log/task-w8-<x>-c2-<scope>.md, -c2-
  infix MANDATORY (campaign-1 owns task-w8-a/b/d/e/f/g verbatim); ports
  b=8791 c=8792 d=8793 f=8794, g owns default 8787 alone. DEC-287: wave-9
  exit = planner-only grep, 8 files x {FROZEN SHA literal, OPEN ITEMS: 0,
  RESULT: PASS, RECHECK n/a-or-green}; stage 1 = greatest RECHECK SHA;
  failing predicate -> wave 9 fixes only cited file:lines, wave 10 re-runs
  only failing sections.
