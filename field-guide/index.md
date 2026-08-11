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
  uploads/ics/statuses/perf/headshots/walkthrough/claim DEC-040-074; exit
  battery+render-sweep+findings DEC-068/069/139; criteriaForRound sole
  resolution (DEC-147..178); CRM=SegmentRule[]+'any'; Files=previous_file_id
  chains; DEC-179-231 CSV/login-limiter/email-ci-dup/SSR/checkbox/cascades;
  DEC-232-251 post-prod: batteries drain LATE (recheck reflog, grep-code-
  not-prose, workers never edit eval-findings.md/decisions/), render-sweep
  misses SPA-vs-route KEY mismatches, PBKDF2 100k, deliverable_kind chain,
  portal CHAIN-LATEST, Tracks/Format allowlist, flat {items}. Human stage-2
  (mailer, Airtable cron) — leave alone.
- Campaign-2 w1/w2/w4 (DEC-252..267): resolveBaseUrl+RELATIVE hrefs; mobile
  390x844 zero h-overflow; 8 sections a-h (g=fresh-clone bootstrap README-
  verbatim, h=116 rubric ids->file:line+test); quiescence+worktree verify.
  Contact q=AND-tokens x OR-columns, pure fns src/domain/contacts.ts (repo
  NO real-D1, only fakeDb); every *_id indexed via getTableConfig;
  migrations hand-authored, db:generate DELETED.
- Campaign-2 w5 (DEC-268..273): fresh clone never builds public/admin
  (gitignored) -> /admin 404s empty; predev+render-sweep now vite-build.
  DEC-271=ABS-12 recusal; DEC-272 WAIVES ABS-14; DEC-273 approve/maybe/deny
  = reviewer RECOMMENDATION, never a 6th status. Tripwires (test/):
  docs-route-coverage, spa-contract-sweep, schema-fk-indexes, migration-parity.
- Campaign-2 w6 (DEC-274..279): DEC-274 public gates SPLIT
  visibleSessionConditions/visibleParticipantConditions, speakerless
  sessions render speakers:[]. DEC-275/278 landed w7 (see below); DEC-276
  bearer re-resolves minting user/request; DEC-277 slot day in event range
  on WRITE else unscheduled. DEC-270/279: wave-N battery-only protocol,
  moved to first ZERO-product-task wave.
- Campaign-2 w7 (DEC-280..284) @ main=1a4d55b: wave 6 PARTLY landed —
  DEC-275 (create.ts:194) + DEC-278 (status.ts:133) ARE in; DEC-274/276/277
  still in flight (public.ts:38, middleware.ts:155, agenda.ts:353
  unchanged). DEC-280 amends DEC-270 step 3: post-S product commits are a
  recorded POST-S DELTA to re-check, never a STOP; steps 1/2/4 (planner
  names 40-char literal, detached worktree, verbatim FROZEN SHA) unchanged.
  DEC-281: wave 8 IS the battery, zero product tasks, only a P1 may
  displace it. DEC-282: contact merge covers SEVEN contact FK tables
  (pipeline_entry was missing -> listPipelineForOrg:161 threw); both-
  enrolled keeps further-along stage, activities repointed; task_assignment
  deduped completion-wins; twin login accounts=conflict; CONTACT_FK_TABLES
  locked by getTableConfig tripwire. DEC-283: assignToAllAccepted expands
  to ACTIVE participants only. DEC-284: pre-battery gate lane reports red,
  never fixes it.
