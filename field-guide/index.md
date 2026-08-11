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
  5/6 (DEC-252 bug); DEC-251 Section D (D1-D4+D6 fixed, WAIVED rest). Human
  committed stage-2 (mailer, Airtable cron) — leave alone.
- Campaign-2 w1/w2 (DEC-252..257, compact): DEC-252 fix src/server/origin.ts
  resolveBaseUrl + RELATIVE hrefs. DEC-253 mobile 390x844 zero h-overflow.
  DEC-254 persona lanes log task-w1-<x>. DEC-255 superseded by DEC-256/262
  (freeze protocol, see below). 8 sections a-h incl g fresh-clone bootstrap
  (DEC-257, README-verbatim 8787), h=116 rubric ids -> file:line+test.
- Campaign-2 w4 (DEC-262..267, compact): w2 battery 6/8 (b/c/d PASS,
  a/e/f FAIL drift+2defects, g/h never ran). DEC-262 quiescence+worktree
  verify. DEC-266 contact q=AND-tokens x OR-columns, pure fns src/domain/
  contacts.ts (repo layer NO real-D1 harness, only fakeDb). DEC-267 every
  *_id indexed via getTableConfig; DEC-263 migrations hand-authored,
  db:generate DELETED, parity via migration-parity.test.ts.
- Campaign-2 w5 (DEC-268..273) @ main=73042c3+. VERIFIED all four w4 fixes
  LANDED (participants.ts:106,170; contacts.ts:229,245; migration 0016+
  schema-fk-indexes.test.ts; db:generate gone+migration-parity.test.ts).
  Battery g/h landed LATE as task-w2-g/h. DEC-269: g's off-origin-claim-link
  finding is STALE - lane froze at 2682c43, a PREVIOUS-campaign commit;
  resolveBaseUrl live at submit.tsx:580, comms.ts:267, contacts.ts:609/661.
  DEC-268: fresh clone never builds public/admin (gitignored, absent from
  Quickstart+render-sweep boot) -> /admin 404s empty; predev+render-sweep
  now vite-build, shell fetch fails loudly. DEC-271=ABS-12 recusal (only
  real rubric gap of 116); DEC-272 WAIVES ABS-14 (rubric's own N/A clause +
  zero-secret stage1). DEC-273: approve/maybe/deny = reviewer RECOMMENDATION
  (seeded dropdown), never a 6th status. DEC-270: wave 6 = battery ONLY,
  PLANNER names the 40-char frozen sha - lanes derived it wrong 3x, once
  from another campaign. New route/table tripwires (all test/): docs-route-
  coverage, spa-contract-sweep, schema-fk-indexes, migration-parity.
