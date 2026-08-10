# Field Guide

Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.

- SPEC.md is the source of truth (jobs J1–J12 = acceptance bar, sbek
  rubric IDs = verification hooks, §2 = product principles). Vendored
  sources in docs/ (precedence in docs/README.md): clarifications.md
  overrides all; brief.md/brief-images/; sessionboard-reference/;
  eval-rubric/*.yaml; fixtures/ (never referenced by product code).
  decisions/DEC-*.md are binding; src/decisions.ts is the compile-
  checked, scribe-owned index.
- House invariants: fail loudly; status changes never auto-email; authz
  on every route, server-side visibility filtering for public data.
  STAGE 1: zero-secret local wrangler dev; external services behind
  ports (email → dev sink + email_log + dev mailbox route).
- DEC-003 owns table names/enums, DEC-004 the hash format
  'pbkdf2$v1$600000$salt$hash', DEC-005 the route map + admin nav — use
  exact strings. Pure-core (DEC-002): src/{auth,domain,forms,mail,lib}
  import nothing from node:/cloudflare/drizzle — Web APIs only.
- DEC-012/013: route files export Hono sub-apps, only src/index.ts
  mounts; middleware sessionLoader/requireOrganizer/requireReviewer/
  requireSpeaker/csrfJson/csrfForm; errors {error:{code,message,
  fields?}}, lists {items,total,page,perPage}. DEC-015: migrations
  append-only, never edit a committed one; track membership is
  submission_track join, never a form answer. DEC-016: locked form
  fields persist to real columns; speaker views show accept_queue/
  decline_queue as 'Under review'.
- Wave-3 layout: route sub-apps in src/routes/*.ts(x); repos in
  src/server/repo/; ApiError(code,message,fields?) from src/server/
  http.ts; makeDb/makeMailer/makeFileStore/systemClock from
  src/server/context.ts. DEC-017: w3-a owns migration 0002 (task_
  assignment.response_json/file_id/last_reminded_at etc); others append
  identical schema.ts columns but never create migration files;
  submission.track_id/additional_track_ids_json are frozen legacy.
- DEC-024: SPA event scope = useCurrentEvent.ts, role = useMe.ts
  (app/src/lib/, create-if-missing per DEC). SPA wire via app/src/lib/
  api.ts; apiUpload is the only sanctioned addition. Reviewer endpoints
  check role inline; never widen requireReviewer/requireOrganizer.
  Compose (DEC-019) atomic-or-nothing, >100 recipients rejects
  'invalid'. Reminders (DEC-023) due-date-driven only.
- Public data flows only through src/server/repo/public.ts's shared SQL
  visibility gate (accepted + content-approved + participant.visible);
  embeds stay frameable; stage-1 caching is max-age=60 + SWR.
- Wave-4 migrations use per-task RESERVED filenames (DEC-025): 0005
  segment (w4-c), 0006 api_token (w4-e), 0007 saved_view (w4-g); 0004
  stays reserved for w3-a; never recreate DEC-017's ALTERs; journal +
  schema.ts appends are unions.
- Settings.tsx is a thin container — add panels only as app/src/pages/
  settings/<Name>Panel.tsx plus an import line (DEC-032). Portal is
  three sub-apps (index/profile/tasks) sharing create-if-missing
  src/routes/portal/shared.tsx (speakerGate + PortalLayout, DEC-028);
  portal form/file completion writes DEC-017 columns needing w3-a's
  migration at runtime — no wave-4 migration for them. Headshots:
  file.kind 'headshot', public GET /headshots/:fileId — never route
  through /files authz. Bearer auth: chq_ tokens resolve in
  sessionLoader with viaBearer=true, CSRF-exempt; token minting is
  cookie-session-only (DEC-027). Canonical exports at
  /api/v1/events/:id/export/:kind; track columns come from
  submission_track only.
