# Multi-portal: build plan and architecture notes

Working notes for the build. Decisions that change the mock's behaviour go in DECISIONS.md.

## Model

**Participations** (the unit portal rules match), three kinds, each with a stable key:
- `p:<participantId>`: a person's role on a session (existing `participant` row).
- `c:<sponsorContactId>`: a person's membership of a sponsor company for this event (new `sponsor_contact`).
- `r:<eventRoleId>`: an event-level role with no session or company, e.g. Press, Volunteer (new `event_role`). The mock lists "Press · no session" and a Volunteers portal, so this kind is needed.

Participations whose `invite_status` is `declined` are dropped before matching ("declining ends the participation").

**Rule attributes per participation**: role, arrival (`submission.origin`: cfp / organizer / sponsor / import), session format (session_format answer), tracks, session status, participation status (invite_status), sponsor tier, sponsorship status, contact custom fields.

**Portals** (`portal`): per event; `rule_json` = OR of AND groups; conditions `{field, op, values}` with ops is / is_not / is_any_of / is_none_of / is_empty / is_not_empty. `field_permissions_json` (field -> hidden|view|edit, plus help text), `capabilities_json`, `note`, `notify_on_join`.

**Library** = `task` rows (kinds general, form, file_request, share_kit, plus system kinds acceptance and sponsor_sessions) and `resource` rows. New task columns: `scope` (person | participation), file constraints (`accepted_types_json`, `max_size_mb`, `max_files`).

**Portal items** (`portal_item`): portal × (task or resource), with per-portal display name, deadline (none / fixed date / N days after joining), required, grace days, allow edits after submit, view-only once done.

**Memberships** (`portal_membership`): materialised (portal, participation) with `joined_at` and `activated_at` (acceptance time for invited participations; relative deadlines count from it).

**Assignments**: portal items materialise as `task_assignment` rows. New columns: `scope_key` ('' for person items, the participation key for session/company items), `source` (direct | portal), `detached_at` (set when a portal row loses every source; finished work stays on the record, the item leaves the home). Unique index moves to (task_id, contact_id, scope_key).

Existing tasks and assignments stay exactly as they are (`source = direct`), so the Speakers grid, onboarding defaults and reminders keep working. Portal-sourced rows get their own reminder pass.

**Merging**: same task from two portals for the same scope shows once: earliest deadline, required if any requires it, longer grace. Profile fields: strictest visibility across the person's active memberships, with the participation that caused it named. Session fields: strictest among portals matching that participation. Capabilities: granted if any covering portal grants; participations no portal covers keep today's defaults.

**Notes**: a portal's note appears where its items appear: under the participation section for session/company items, under Your profile for person-only portals.

**Sponsors**: `sponsor_company` (org-level), `sponsor_tier` (per event), `sponsor_entitlement` (tier rows or per-sponsorship extras: count × format × minutes), `sponsorship` (event × company × tier, status pending|active), `sponsor_contact` (sponsorship × contact, invited|joined, primary flag), `sponsor_session` (+ `sponsor_session_speaker`): draft → submitted → changes_requested → approved | declined; approval creates an accepted `submission` (origin sponsor) with the speakers as participants.

**Audit**: `audit_event` append-only; written by preview-as-participant, portal rule/permission/item saves, entitlement changes, sponsor-session approvals/declines/requests and submits.

**Notifications**: `portal_notification` queue rows (contact, event, task ids). Rule saves enqueue only if the organizer chose to notify; organic gains enqueue when `portal.notify_on_join`. The 15-minute cron reconciles every active event, sends queued notifications (one email per person), and runs portal reminders.

## Architecture constraints (from the codebase survey)

- Migrations: hand-written `migrations/NNNN_*.sql` (next 0046); no PRAGMA/TEMP/ATTACH/transactions; every schema index needs a matching CREATE INDEX (`test/schema-migration-parity.scan.test.ts`); every uniqueIndex needs an allowlist row in `test/unique-index-guard-coverage.scan.test.ts`; every new table in `scripts/seed-lib.ts` `TABLES_IN_DELETE_ORDER`.
- Test DB: `makeTestDb()` pattern applies all migrations to `node:sqlite`.
- Routes: sub-apps declared `export const xRoutes = new Hono<`, mounted by a literal `app.route()` line in `src/index.ts`; literal paths. New `/portal` patterns go in `src/lib/portal-routes.ts`; admin patterns in `src/lib/admin-routes.ts` + `app/src/App.tsx` + `app/src/routeManifest.ts`.
- Ledgers a new route can trip: role-refusal, anonymous route/mutation probes, cross-org probes (event-scoped routes avoid the object probe), portal IDOR probe, route-authz enumeration (guard + CSRF), API docs (`src/routes/docs-endpoints.ts`), cacheability enumerations, list-envelope shape, touch-on-write for participant writes.
- Portal identity: `auth.contactId` from `user.contact_id`; `speakerGate`; claim links are KV `{contactId, eventId}`.
- Mail: `makeMailer`, `RenderedEmail` requires `eventId`; `resolvePortalLinks` for portal/claim links.
- Seed: `scripts/seed.ts` full wipe; additive pattern = `scripts/perf-seed.ts`.
