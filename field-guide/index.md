# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 acceptance bar, sbek rubric IDs =
  verification hooks, §2 principles). docs/ precedence: clarifications.md
  overrides all; brief/-images; sessionboard-reference; eval-rubric/*.yaml;
  fixtures (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz on
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table names/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005
  route map + admin nav (exact strings). Pure-core (DEC-002):
  src/{auth,domain,forms,mail,lib} import nothing from node:/cloudflare.
- DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (via src/server/app.ts + scheduled.ts, DEC-035). Middleware
  sessionLoader/requireOrganizer/requireReviewer/requireSpeaker/
  csrfJson/csrfForm; errors {error:{code,message,fields?}}, lists
  {items,total,page,perPage}. DEC-015 migrations append-only; DEC-016
  locked form fields = real cols.
- Wave-3/4: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError from http.ts; makeDb/makeMailer/makeFileStore/systemClock from
  context.ts; check app/src/lib/api.ts wire helpers first. Compose
  (DEC-019) atomic-or-nothing, >100 recipients rejects. Public data only
  via repo/public.ts's shared SQL gate. RESERVED migrations: 0005
  segment, 0006 api_token, 0007 saved_view. Portal sub-apps share
  routes/portal/shared.tsx. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only minting.
- Wave-5/6: DEC-036 open_date via formWindowState(). DEC-037 email HTML
  ONLY via escapeHtml/textToHtml. DEC-038 rate-limit.ts canonical scoped
  KV limiter. DEC-039 review resolves plans only via getPlanForOrg.
  DEC-040 form-answer uploads = kind 'attachment'. DEC-041 speaker edit
  routes/portal/edit.tsx. DEC-042 root README.md evaluator entrypoint.
  DEC-043/044 reviewer mgmt via /api/v1/users + plan_reviewer row ids.
  DEC-050 locked fields PK '<formId>:<name>', lockedFieldName() in
  forms/types.ts is the ONLY locked-membership test. DEC-049 /admin
  worker-first via ASSETS binding; GET / SSR landing. DEC-047 file
  resources kind 'resource'. DEC-048 seed writes .seed-assets/ +
  scripts/seed-r2.ts chained into npm run seed.
- Wave-7: DEC-051 compose attachIcs — ics_sequence via 0008; preview never
  bumps, send bumps once. DEC-057 submit-core legacy limiter DELETED,
  public submit uses checkAndIncrementScopedLimit scope 'submit'.
  DEC-052 App.tsx-only React.lazy per route + hover/focus prefetch.
  DEC-053 scripts/walkthrough.ts is J1→J12 vehicle (cookie jar, form
  login w/ chq_csrf, JSON mutations need 'x-chq-csrf: 1'). DEC-054/055/056
  custom statuses deferred, showflow.csv, /docs/api SSR. Agenda drag-drop:
  app/src/pages/agenda/state.ts (extend, don't fork).
- Wave-8: DEC-058 perf budgets ENFORCED — scripts/bundle-check.ts in CI
  after build (entry js+css combined < 300 KB gz, hard fail);
  wrangler.jsonc placement.mode smart. DEC-059 headshots: client-side
  canvas downscale to 512px max-edge in portal profile inline script
  (server 8 MB cap stays authoritative); /headshots/:fileId now
  Cache-Control immutable 1y (R2 keys unique per upload — never reuse).
  DEC-060 verification is modular: scripts/walkthrough/{producer,review,
  speaker,public,data}.ts standalone runnables, same DEC-053 conventions;
  area tasks NEVER edit scripts/walkthrough.ts or package.json. Fix rule:
  fixes stay in task's named files; out-of-area defects go in commit body
  for planner. DEC-061 closes stage-1 §10: items 2+3 deferred, 4 via
  DEC-054, 5/8 stage-2; 1/6/7 landed.
