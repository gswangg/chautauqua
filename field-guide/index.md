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
  handler, DEC-035 — no second bootstrap path). Middleware sessionLoader/
  requireOrganizer/requireReviewer/requireSpeaker/csrfJson/csrfForm; errors
  {error:{code,message,fields?}}, lists {items,total,page,perPage}. DEC-015
  migrations append-only; track membership is submission_track join.
  DEC-016 locked form fields persist to real columns.
- Wave-3: route sub-apps in src/routes/*.ts(x); repos in src/server/repo/;
  ApiError(code,message,fields?) from src/server/http.ts; makeDb/makeMailer/
  makeFileStore/systemClock from src/server/context.ts. DEC-017 migration
  0002 owned by w3-a, others append schema.ts columns only; legacy track_id
  cols frozen. DEC-024 SPA: useCurrentEvent.ts, useMe.ts, app/src/lib/api.ts
  (check existing helpers first; apiUpload sanctioned). Compose (DEC-019)
  atomic-or-nothing, >100 recipients rejects. Public data only through
  repo/public.ts's shared SQL gate; embeds frameable; cache max-age=60+SWR.
- Wave-4: RESERVED migration filenames (DEC-025): 0005 segment, 0006
  api_token, 0007 saved_view; 0004 for w3-a. Settings.tsx thin container
  (DEC-032). Portal sub-apps share routes/portal/shared.tsx (speakerGate +
  PortalLayout, DEC-028). Headshots kind 'headshot', public /headshots/:id.
  Bearer chq_ in sessionLoader (CSRF-exempt); minting cookie-only (DEC-027).
- Wave-5: DEC-036 open_date via formWindowState() in submit-core; isFormClosed
  frozen-exported. DEC-037 email HTML ONLY via escapeHtml/textToHtml in
  src/mail/render.ts — never renderTemplate into HTML with user vars.
  DEC-038 src/lib/rate-limit.ts canonical scoped KV limiter (login/claim
  20/15min/IP). DEC-039 /api/v1/review/* resolves plans only via
  getPlanForOrg — un-scoped getPlanById banned. DEC-040 form-answer uploads
  = file rows kind 'attachment', answer = file id. DEC-041 speaker editing
  routes/portal/edit.tsx (canEdit checked server-side). DEC-042 root
  README.md is the evaluator entrypoint.
- Wave-6: DEC-043/044 reviewer mgmt — org users via /api/v1/users (POST
  returns generated password ONCE, welcome mail text-only via textToHtml);
  plan_reviewer rows addressed by row id (GET list + DELETE /:reviewerId;
  body-DELETE removed). DEC-050 locked form fields: new forms use PK
  '<formId>:<name>'; lockedFieldName() in src/forms/types.ts is the ONLY
  locked-membership test; repo/forms' row→spec conversion normalizes locked
  spec ids to short names ('title'…). DEC-049 /admin runs worker-first via
  ASSETS binding (role redirects: anon→/login, speaker→/portal); GET / is
  an SSR landing. DEC-047 file resources: file rows kind 'resource'
  (submission_id null), organizer serve via /files, speaker via portal.
  DEC-048 seed writes .seed-assets/ + scripts/seed-r2.ts (wrangler r2
  object put --local) chained into npm run seed. Merge expectations:
  src/index.ts mount lines, App.tsx route/nav, rebuilt public/admin
  bundle hashes across SPA tasks — rebuild, don't pick.
