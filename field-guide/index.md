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
  (app.ts + scheduled.ts, DEC-035). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm;
  errors {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked fields = real cols.
- Wave-3/4/5/6: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError http.ts; ctx factories context.ts; check app/src/lib/api.ts
  first. Compose (DEC-019) atomic, >100 recipients rejects. Public data
  only via repo/public.ts gate. Portal sub-apps share
  routes/portal/shared.tsx. Bearer chq_ in sessionLoader (CSRF-exempt),
  cookie-only mint. DEC-036 open_date formWindowState(). DEC-037 email
  HTML ONLY escapeHtml/textToHtml. DEC-038 rate-limit.ts scoped KV.
  DEC-039 review resolves plans only via getPlanForOrg. DEC-040
  form-answer uploads kind 'attachment'. DEC-041 speaker edit
  routes/portal/edit.tsx. DEC-043/044 reviewer mgmt /api/v1/users +
  plan_reviewer ids. DEC-050 locked fields PK '<formId>:<name>'. DEC-049
  /admin worker-first via ASSETS; GET / SSR. DEC-047 resources kind
  'resource'. DEC-048 seed writes .seed-assets/ + seed-r2.ts.
- Wave-7/8: DEC-051 compose attachIcs, ics_sequence via 0008. DEC-057
  submit-core legacy limiter DELETED, uses scoped limiter scope
  'submit'. DEC-052 App.tsx-only React.lazy. DEC-054/055/056 custom
  statuses deferred, showflow.csv, /docs/api SSR. DEC-058 perf ENFORCED
  in CI (js+css < 300 KB gz). DEC-059 headshots: client canvas downscale
  512px at upload; /headshots/:fileId immutable 1y (R2 keys unique —
  never reuse; superseded by DEC-067). DEC-060 verification modular:
  scripts/walkthrough/{producer,review,speaker,public,data}.ts, DEC-053
  conventions (cookie jar, chq_csrf form login, 'x-chq-csrf: 1' on JSON
  mutations). DEC-061 closes §10.
- Wave-9: task-w7-e DROPPED — replanned w9-a. DEC-062 walkthrough.ts =
  thin runner over DEC-060 modules, order producer->review->speaker->
  public->data. DEC-063 CI job 'walkthrough' runs `npm run walkthrough`.
  Unresolved Qs = 'PLANNER:' lines.
- Wave-10: w8-e, w9-a AND w9-b all DROPPED with ZERO commits (branches
  exist but point at main — check `git log main..<branch>` before
  trusting wave summaries; 3 of last 4 verification-lane tasks vanished
  this way). Rebuilt as ONE task w10-a (sole owner of
  scripts/walkthrough/* + package.json + ci.yml + README, DEC-062). Four
  NEW defects: DEC-064 claim POST peeks via readClaimToken, consumes only
  right before user insert; DEC-065 task-assignment uploads (kind
  'handout') served via third GET /files/:fileId branch — organizer
  org-match or owning speaker; DEC-066 reviewers download submission
  files iff plan_reviewer on a plan for that event (pure flag into
  canAccessFile, comments stay organizer/speaker); DEC-067
  /headshots/:fileId 404s unless a contact.headshotUrl references it —
  unauthenticated requires exact repo/public.ts predicate, org/own
  speaker get private-cache fallback, else 404.
