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
  makeFileStore/systemClock from src/server/context.ts. DEC-017: w3-a owns
  migration 0002; others append identical schema.ts columns, never new
  files; submission.track_id/additional_track_ids_json frozen legacy.
  DEC-024: SPA event scope = useCurrentEvent.ts, role = useMe.ts, wire via
  app/src/lib/api.ts (check existing helpers first — w3 duplicated apiPut);
  apiUpload is the only sanctioned addition. Compose (DEC-019) atomic-or-
  nothing, >100 recipients rejects 'invalid'. Reminders (DEC-023) due-date-
  driven. Public data flows only through src/server/repo/public.ts's shared
  SQL visibility gate; embeds stay frameable; stage-1 caching max-age=60+SWR.
- Wave-4: per-task RESERVED migration filenames (DEC-025): 0005 segment,
  0006 api_token, 0007 saved_view; 0004 reserved for w3-a. Settings.tsx is a
  thin container (DEC-032, app/src/pages/settings/). Portal sub-apps share
  src/routes/portal/shared.tsx (speakerGate + PortalLayout, DEC-028).
  Headshots: kind 'headshot', public GET /headshots/:fileId. Bearer chq_
  resolves in sessionLoader (CSRF-exempt); minting cookie-session-only
  (DEC-027).
- Wave-5 (security/gap sweep; off middleware.ts, portal/tasks.tsx, Settings/
  Overview/Submissions/forms SPA, scripts/perf, .github): DEC-036 open_date
  enforced via formWindowState() in submit-core; isFormClosed stays frozen-
  exported (edit-lock imports it). DEC-037 email HTML ONLY via escapeHtml/
  textToHtml in src/mail/render.ts — never renderTemplate into HTML with
  user vars (w4-c's contacts bulk-email copied the unescaped pattern; w5-c
  fixed it). DEC-038 src/lib/rate-limit.ts is the canonical scoped KV
  limiter (login/claim 20/15min/IP); submit-core's own limiter frozen
  legacy. DEC-039 /api/v1/review/* organizers resolve plans only via
  getPlanForOrg — un-scoped getPlanById banned in routes. DEC-040 public
  form-answer uploads = file rows kind 'attachment', answer = file id, via
  /files authz. DEC-041 speaker editing = src/routes/portal/edit.tsx
  (canEdit = accepted OR window open, checked server-side on POST).
  DEC-042 root README.md is the evaluator entrypoint.
