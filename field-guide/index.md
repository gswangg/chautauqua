# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all; brief/
  images/sessionboard-reference/eval-rubric/*.yaml/fixtures (never product
  code). decisions/DEC-*.md binding; src/decisions.ts compile-checked.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$100000$salt$hash' (DEC-237 amended,
  workerd 100k cap); DEC-005 route map+admin nav; DEC-002 pure-core
  src/{auth,domain,forms,mail,lib} import nothing node:/cf. DEC-012/013:
  route files export Hono sub-apps, only src/index.ts mounts; middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/csrfJson/
  csrfForm; errors {error:{code,message,fields?}}. DEC-015 append-only; DEC-016
  locked=real cols; DEC-114 sha rule; DEC-129 homonym=full heading incl '@ <sha>'.
- Wave3-251 (Campaign1-3, ultra-compact): sub-apps/repos/ctx DEC-012/013/019;
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; exit
  battery+render-sweep+findings DEC-068/069/139; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; Files=previous_file_id
  chains; DEC-179-231 CSV/login-limiter/email-ci-dup/SSR/checkbox/cascades;
  DEC-232-251: batteries drain LATE, grep-code-not-prose; portal CHAIN-LATEST; flat {items}.
- Campaign-2 w1/w2/w4/w5 (DEC-252..273): resolveBaseUrl+RELATIVE hrefs;
  mobile 390x844 zero h-overflow; 8 sections a-h (g=fresh-clone bootstrap
  README-verbatim, h=116 rubric ids->file:line+test). Contact q=AND-tokens
  x OR-columns; every *_id indexed; migrations hand-authored, db:generate
  DELETED. Fresh clone never builds public/admin (gitignored)->/admin 404s
  empty; predev+render-sweep now vite-build. DEC-271=ABS-12 recusal; DEC-272
  WAIVES ABS-14; DEC-273 approve/maybe/deny=RECOMMENDATION never 6th status.
  Tripwires(test/): docs-route-coverage, spa-contract-sweep, schema-fk-indexes, migration-parity.
- Campaign-2 w6/w7/w8 (DEC-274..287, battery frozen @ S=80b811d25028...):
  public.ts:42/53/71 split gates, middleware.ts:151 bearer re-resolve,
  agenda.ts:336 day-range. DEC-270/279/280 wave-N battery protocol, POST-S
  DELTA never a STOP; DEC-281 wave-8-IS-the-battery; DEC-282 SEVEN contact
  FK tables; DEC-283 assignToAllAccepted=ACTIVE only; DEC-284 gate lane
  reports red never fixes; DEC-285 pre-registers 2 known in-flight defects
  (contacts.ts:207, tasks.ts:263), re-checked in SECOND worktree at
  `RECHECK SHA:`; DEC-286 logs=docs/verification-log/task-w8-<x>-c2-
  <scope>.md MANDATORY, ports b=8791 c=8792 d=8793 f=8794 g=8787; DEC-287
  wave-9 exit=planner-only grep, 8 files x {FROZEN SHA, OPEN ITEMS: 0,
  RESULT: PASS, RECHECK n/a-or-green}, stage1=greatest RECHECK SHA.
- Campaign-2 w9 (DEC-288..292) @ main=5ccd4d63: NOT the exit grep — .git
  shows only `merge task-w8-a` landed (b/c/d unmerged, e/f/g zero commits, h
  never created); DEC-287 runs verbatim at first planner after all 8 -c2-
  logs exist, battery re-runs at NEW sha incl. wave 9 (stage1 sha != w8
  greatest RECHECK). Wave 9 builds the 3 rows a battery can't close (task-
  w4-e-c2:164/165/167): SPK-03 roster import, SPK-15 travel/logistics,
  EMB-15 embed config; EMB-03 stays NOT-open (no submission.format col,
  yaml bar=Track). DEC-289 public/embed URL: shared params q/trackId/page/
  day/limit/fields/accent (allowlisted, invalid->default, never 500);
  format is a PATH SUFFIX (.json, agenda.ics); flat {items}; feeds read
  repo/public.ts. DEC-290 roster add/import=optional `eventId` on the two
  EXISTING contact endpoints riding pushContactToEvent, skip-set=
  listAcceptedContactIds; phone+bio join import targets. DEC-291 form-task
  responses were write-only — GET /api/v1/task-assignments/:id/response
  (organizer, 404 cross-org) + `kind` on grid tasks[]; new /api/v1 routes
  MUST hit src/routes/docs.tsx. DEC-292 custom fields=key/value rows+
  reserved `travel_logistics` textarea; dup/blank keys are loud errors.
