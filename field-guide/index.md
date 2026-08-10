# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is the source of truth (J1-J12 = acceptance bar, sbek rubric
  IDs = verification hooks, §2 = principles). docs/ precedence: clarifications.md
  overrides all; brief.md/-images; sessionboard-reference; eval-rubric/*.yaml;
  fixtures (never referenced by product code). decisions/DEC-*.md binding;
  src/decisions.ts compile-checked, scribe-owned.
- House invariants: fail loudly; status changes never auto-email; authz on
  every route, server-side visibility filtering for public data. STAGE 1:
  zero-secret local wrangler dev; external services behind ports (email →
  dev sink + email_log + dev mailbox route). DEC-003 table names/enums;
  DEC-004 hash 'pbkdf2$v1$600000$salt$hash'; DEC-005 route map + admin nav
  (exact strings). Pure-core (DEC-002): src/{auth,domain,forms,mail,lib}
  import nothing from node:/cloudflare — Web APIs only.
- DEC-012/013: route files export Hono sub-apps, only src/index.ts mounts
  (via src/server/app.ts's createBaseApp + src/server/scheduled.ts's cron
  handler, DEC-035). Middleware sessionLoader/requireOrganizer/
  requireReviewer/requireSpeaker/csrfJson/csrfForm; errors
  {error:{code,message,fields?}}, lists {items,total,page,perPage}.
  DEC-015 migrations append-only; DEC-016 locked form fields = real cols.
- Wave-3/4: route sub-apps src/routes/*.ts(x); repos src/server/repo/;
  ApiError(code,message,fields?) from src/server/http.ts; makeDb/makeMailer/
  makeFileStore/systemClock from src/server/context.ts. app/src/lib/api.ts
  — check existing wire helpers first (apiPut/apiUpload already exist).
  Compose (DEC-019) atomic-or-nothing, >100 recipients rejects. Public
  data only via repo/public.ts's shared SQL gate. RESERVED migrations:
  0005 segment, 0006 api_token, 0007 saved_view. Portal sub-apps share
  routes/portal/shared.tsx (speakerGate + PortalLayout). Bearer chq_ in
  sessionLoader (CSRF-exempt); minting cookie-only.
- Wave-5: DEC-036 open_date via formWindowState(). DEC-037 email HTML
  ONLY via escapeHtml/textToHtml in src/mail/render.ts. DEC-038
  src/lib/rate-limit.ts canonical scoped KV limiter. DEC-039
  /api/v1/review/* resolves plans only via getPlanForOrg. DEC-040
  form-answer uploads = file rows kind 'attachment'. DEC-041 speaker
  editing routes/portal/edit.tsx. DEC-042 root README.md is the evaluator
  entrypoint.
- Wave-6: DEC-043/044 reviewer mgmt via /api/v1/users + plan_reviewer rows
  by row id. DEC-050 locked form fields: PK '<formId>:<name>';
  lockedFieldName() in src/forms/types.ts is the ONLY locked-membership
  test. DEC-049 /admin worker-first via ASSETS binding; GET / SSR landing.
  DEC-047 file resources: kind 'resource'. DEC-048 seed writes
  .seed-assets/ + scripts/seed-r2.ts chained into npm run seed.
- Wave-7: DEC-051 compose attachIcs — submission.ics_sequence via RESERVED
  migration 0008_w7_ics_sequence.sql (journal idx 8); preview never bumps,
  send bumps once/submission; UID stays uidFor(submissionId); public
  schedule.ics untouched (sequence 0). DEC-057 supersedes DEC-038's
  freeze: submit-core's legacy limiter DELETED, public submit uses
  checkAndIncrementScopedLimit scope 'submit' (KV keys unchanged).
  DEC-052 App.tsx-only React.lazy per route + NavLink hover/focus chunk
  prefetch; pages keep named exports. DEC-053 scripts/walkthrough.ts is
  the J1→J12 vehicle (cookie jar, form login w/ chq_csrf, JSON mutations
  need 'x-chq-csrf: 1'). DEC-054 custom statuses deferred — five DEC-003
  statuses are the stage-1 contract. DEC-055 showflow.csv cols fixed;
  DEC-056 /docs/api hand-maintained SSR. Agenda drag-drop lives in
  app/src/pages/agenda/state.ts (optimistic + reconcile — extend, don't
  fork). Merge: rebuilt admin bundle hashes (w7-c/d/f), src/index.ts
  mount lines (w7-g), one-line README adds (w7-e/g).
