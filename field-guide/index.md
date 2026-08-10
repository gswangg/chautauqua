# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs = verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; brief/-images; sessionboard-reference; eval-rubric/*.yaml; fixtures
  (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports. DEC-003
  table/enums; DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route
  map + admin nav (exact strings). Pure-core (DEC-002):
  src/{auth,domain,forms,mail,lib} import nothing from node:/cloudflare.
- DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (via app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked form fields = real cols.
- Wave-3/4/5/6: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError http.ts; ctx factories context.ts; check app/src/lib/api.ts
  first. Compose (DEC-019) atomic, >100 recipients rejects. Public data
  only via repo/public.ts gate. RESERVED migrations 0005 segment/0006
  api_token/0007 saved_view. Portal sub-apps share
  routes/portal/shared.tsx. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only mint. DEC-036 open_date formWindowState(). DEC-037 email
  HTML ONLY escapeHtml/textToHtml. DEC-038 rate-limit.ts scoped KV.
  DEC-039 review resolves plans only via getPlanForOrg. DEC-040
  form-answer uploads kind 'attachment'. DEC-041 speaker edit
  routes/portal/edit.tsx. DEC-042 root README.md entrypoint. DEC-043/044
  reviewer mgmt /api/v1/users + plan_reviewer ids. DEC-050 locked fields
  PK '<formId>:<name>', lockedFieldName() ONLY test. DEC-049 /admin
  worker-first via ASSETS; GET / SSR. DEC-047 file resources kind
  'resource'. DEC-048 seed writes .seed-assets/ + seed-r2.ts.
- Wave-7/8: DEC-051 compose attachIcs, ics_sequence via 0008 (preview
  never bumps, send bumps once). DEC-057 submit-core legacy limiter
  DELETED, uses checkAndIncrementScopedLimit scope 'submit'. DEC-052
  App.tsx-only React.lazy + hover/focus prefetch. DEC-054/055/056 custom
  statuses deferred, showflow.csv, /docs/api SSR. Agenda drag-drop:
  app/src/pages/agenda/state.ts (extend, don't fork). DEC-058 perf
  ENFORCED — bundle-check.ts in CI (js+css < 300 KB gz, hard fail);
  placement.mode smart. DEC-059 headshots: client canvas downscale
  512px in portal profile inline script (server 8 MB cap authoritative);
  /headshots/:fileId immutable 1y (R2 keys unique — never reuse).
  DEC-060 verification modular: scripts/walkthrough/{producer,review,
  speaker,public,data}.ts, DEC-053 conventions (cookie jar, chq_csrf
  form login, 'x-chq-csrf: 1' on JSON mutations). DEC-061 closes §10:
  2+3 deferred, 4 via DEC-054, 5/8 stage-2; 1/6/7 landed.
- Wave-9: task-w7-e DROPPED (branch gone, script absent) — replanned as
  w9-a. DEC-062 scripts/walkthrough.ts = thin sequential runner over the
  five DEC-060 modules, fixed order producer->review->speaker->public->
  data; modules must pass in that order against ONE seeded server;
  sequence-tolerance fixes go in the module file, orchestrator owner is
  sole sanctioned scripts/walkthrough/* editor. DEC-063 CI job
  'walkthrough' (perf-smoke-shaped) runs `npm run walkthrough` per push.
  Post-merge verification is deliberately ONE task (w9-b) — wave-8
  workers only verified pre-merge; defects live in w8-b..g commit
  BODIES (git log <merge>^2 --format=%b). Unresolved Qs = 'PLANNER:' lines.
