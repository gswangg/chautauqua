# Field Guide

Owned by the swarm. The scribe appends lessons each wave and keeps this file
under a hard budget of 60 lines, compacting older entries when needed. Content
here is injected into every agent at spawn.

- SPEC.md is the source of truth on requirements — jobs J1–J12 are the
  acceptance bar, sbek rubric IDs are verification hooks, §2 product
  principles govern judgment calls. Underlying sources are vendored in docs/
  (precedence in docs/README.md): clarifications.md overrides all; brief.md +
  brief-images/ screenshots; sessionboard-reference/ behavior docs;
  eval-rubric/*.yaml; fixtures/ seed data (never referenced by product code).
- Design decisions live in decisions/DEC-*.md and are binding; constants in
  src/decisions.ts are the compile-checked index; src/decisions.ts is
  scribe-owned, workers never edit it.
- House invariants: fail loudly; status changes never auto-email; authz on
  every route, server-side visibility filtering for all public data.
- STAGE 1 (SPEC.md §0): everything runs locally with zero secrets on
  wrangler dev; external services go behind ports with local dev
  implementations (email → dev sink + email_log + dev mailbox route).
- Wave-1 contracts: DEC-003 owns table names + enum literals, DEC-004 owns
  the hash format 'pbkdf2$v1$600000$salt$hash', DEC-005 owns the route map +
  admin nav. Use exact strings; never invent parallel enums.
- Pure-core rule (DEC-002): src/{auth,domain,forms,mail,lib} import nothing
  from node:, cloudflare, or drizzle — Web APIs only, plain-vitest testable.
- DEC-012/013 binding on all server code: route files export Hono sub-apps,
  only src/index.ts mounts; middleware sessionLoader/requireOrganizer/
  requireReviewer/requireSpeaker/csrfJson/csrfForm; API errors
  {error:{code,message,fields?}}, lists {items,total,page,perPage}.
- DEC-015: migrations are append-only — never edit a committed migration.
  Track membership is the submission_track join, never a form answer.
- DEC-016: locked form fields persist to real columns; submission_answer
  holds custom fields only. Speaker views never leak internal queue states:
  accept_queue/decline_queue display as 'Under review'.
- Wave-3 layout: route sub-apps in src/routes/*.ts(x); repos in
  src/server/repo/; ApiError = new ApiError(code, message, fields?) from
  src/server/http.ts; makeDb/makeMailer/makeFileStore/systemClock come from
  src/server/context.ts.
- DEC-017: task w3-a owns migration 0002 (plan_reviewer.submission_id;
  task_assignment.response_json/file_id/last_reminded_at); others may
  append identical schema.ts columns but never create migration files.
  Track reads/writes use submission_track only; submission.track_id and
  additional_track_ids_json are frozen legacy — drop in a cleanup wave.
- DEC-024: SPA event scope = useCurrentEvent.ts, role = useMe.ts (both in
  app/src/lib/); create-if-missing exactly per the DEC (expected merge
  duplicate). All SPA wire traffic via app/src/lib/api.ts; apiUpload is the
  only sanctioned addition (multipart).
- Declared wave-3 overlap files (merge unions): src/index.ts, src/db/
  schema.ts, app/src/App.tsx (reviewer nav), app/src/lib/useCurrentEvent.ts
  / useMe.ts, app/src/pages/Settings.tsx (embeds panel).
- Reviewer endpoints check role inline (reviewer OR organizer); never widen
  requireReviewer/requireOrganizer. Plan progress/results/exports stay
  producer-only.
- Compose (DEC-019) is atomic-or-nothing: validate every recipient's merge
  render before the first send; >100 recipients rejects 'invalid'.
  Reminders (DEC-023) are due-date-driven only; nothing sends on status
  change.
- Public data flows only through src/server/repo/public.ts's shared SQL
  visibility gate (accepted + content-approved + participant.visible);
  embeds stay frameable; stage-1 caching is Cache-Control max-age=60 + SWR.
