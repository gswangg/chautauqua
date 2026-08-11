# task-w1-h — J12 own-your-data + Settings surface browser persona pass

sha (base, before this task's fixes): 137dfe63d3043f5e3fa9403a067f1c0b49dce840
Branch: task-w1-h

Persona: sbek-organizer@example.com, event seed_event_0001 (DevFlow Conf 2027),
`npx wrangler dev --port 8808` against the seeded local D1 + R2. Driven via
authenticated curl (session-cookie login through `/login` with the double-submit
`chq_csrf` cookie, and bearer-token requests with no cookie at all) rather than
a real chromium session — no browser-automation tool was available in this
worker's toolset, so every check below is the equivalent HTTP traffic a
browser would issue, inspected byte-for-byte (headers, CSV parse, JSON parse,
row counts, cross-checks against the corresponding on-screen list API).

## Settings > Exports

- All 5 DEC-027 kinds (submissions, speakers, evaluations, agenda, email-log)
  downloaded in both `?format=csv` and `?format=json`: 10/10 requests 200 OK.
- Every CSV parsed cleanly with `csv.reader` (embedded-newline/quoted fields
  handled correctly — a naive `wc -l` undercounts, which is expected CSV
  shape, not a defect) and its header row matched the fixed DEC-027 column
  list exactly.
- Row counts cross-checked against the corresponding on-screen list:
  submissions 30/30, agenda (scheduled/placed) 5/5, email-log 3/3 — all match.
- `GET /api/v1/events/:eventId/exports/showflow.csv` (DEC-055) downloaded and
  parsed with the correct fixed header (ref,title,description,day,start,end,
  room,tracks,speakers,deck_file,deck_url), 8 rows (accepted submissions).
- **Gap flagged, not fixed**: the task brief lists "contacts" as one of the
  export kinds to prove, but DEC-027 is binding and enumerates exactly
  submissions | speakers | evaluations | agenda | email-log — no contacts
  kind exists anywhere in the code (not in `EXPORT_KINDS`, not in
  `ExportsPanel.tsx`, no separate CSV export button on the Contacts page).
  Narrowest interpretation taken: this is out of DEC-027's scope, so no new
  export kind was invented; flagging for the scribe/planner in case a
  contacts-export decision is intended for a future task.

## Settings > API tokens

- `POST /api/v1/tokens` (cookie session, `x-chq-csrf: 1`) mints a token,
  returned plaintext exactly once: `{"token":"chq_..."}`.
- The minted token authenticated `GET /api/v1/events/:eventId/submissions`
  and `GET /api/v1/submissions/:id` from a **fresh curl context with zero
  cookies**, `Authorization: Bearer chq_...` only — both 200 with correct data.
- `DELETE /api/v1/tokens/:id` (cookie session) revokes it; the same bearer
  token then gets 401 `{"error":{"code":"unauthorized","message":"Login
  required"}}` on the next request.
- No-IDOR / cross-org read: per DEC-027, bearer tokens always resolve to
  `role: 'organizer'` scoped to the minting org — there is no
  speaker/reviewer bearer-token concept in this codebase (`GET/POST/DELETE
  /api/v1/tokens` are all `requireOrganizer`-gated; minting itself requires
  a cookie session). The closest real equivalent — and the one that actually
  matters for IDOR — is cross-*org* isolation: a second org/user/token was
  inserted directly into local D1 for the duration of this check (deleted
  afterward, no seed/fixture/product-code change). That token got `total: 0`
  on `GET /api/v1/events`, 403 `"Event belongs to a different org"` on the
  first org's submissions list, 404 `"Event not found"` on that org's
  exports/showflow, and 403 `"Submission belongs to a different org"` on a
  direct submission-detail fetch by ID. No cross-org leakage anywhere in
  the surfaces this task covers. Flagging the "speaker/reviewer token"
  wording as a task-brief/implementation mismatch, not something fixed here
  (inventing a non-organizer bearer-token role would be a design decision
  outside this task's scope).

## /docs/api

Cross-checked every route file under `src/routes/**` against `docs.tsx`'s
`ROUTE_GROUPS` table by hand (regex extraction of every `.get/.post/.patch/
.put/.delete(...)` call across the tree, matched against `src/index.ts`'s
mount prefixes) and found real drift — fixed in `src/routes/docs.tsx`:

- `PATCH /api/v1/submissions/:id` (submission title/description edit) was
  mounted but entirely undocumented.
- `src/routes/api/portal-config.ts` (6 routes: portal-settings GET/PUT,
  resources GET/POST, `/resources/:resourceId` PATCH/DELETE) was mounted
  but had **no doc section at all** — directly relevant to this task's own
  Settings surfaces.
- `src/routes/api/pipeline.ts` (5 routes) was mounted but undocumented.
- `GET /api/v1/events/:eventId/overview` was mounted but undocumented.
- `POST /api/v1/events/:eventId/agenda/publish` was mounted but undocumented.
- `POST /api/v1/contacts/:id/headshot`, `POST /api/v1/contacts/:id/add-to-event`,
  `POST /api/v1/contacts/bulk-email/preview` were mounted but undocumented.
- `GET /api/v1/submissions/:id/revisions`,
  `POST /api/v1/submissions/:id/revisions/:revisionId/restore` were mounted
  but undocumented.
- `GET /api/v1/events/:eventId/files`, `POST /api/v1/events/:eventId/files/archive`
  were mounted but undocumented.
- `POST /api/v1/users/:id/reset-password` was mounted but undocumented.

All added to `ROUTE_GROUPS` with the correct method/path/role (spot-checked
every added route's actual middleware chain — all `requireOrganizer`).
No stale (documented-but-not-mounted) entries were found.

Regression: `test/docs-route-coverage.test.ts` — mounts every real `/api/v1`
sub-app the same way `src/index.ts` does (`ROUTE_GROUPS` exported from
`docs.tsx` for this purpose) and asserts the mounted route set and the
documented route set are identical. This will catch any future drift
regardless of which route file changes.

`GET /docs/api` returns 200, is reachable with no session/cookie set, and the
Auth/Envelope/CSRF prose matches the real behavior verified elsewhere in this
log (bearer exemption from CSRF, `{error:{code,message,fields?}}` envelope,
`{items,total,page,perPage}` list envelope).

## Settings > Embed generator

- All 5 surfaces (`sessions`, `speakers`, `agenda`, `schedule`, `gallery`)
  match `EMBED_SURFACES` in `app/src/pages/Settings.tsx` and `SURFACES` in
  `src/routes/public/shell.tsx` exactly.
- `GET /embed/devflow-conf-2027/<surface>` returns 200 for all 5, with real
  non-empty rendered HTML (2.9-10 KB each) and titles reflecting live data
  (see round-trip section below).
- No `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` header
  on any response, and `grep -rn "X-Frame-Options\|frame-ancestors\|Content-
  Security-Policy" src/` across the whole route tree returns nothing —
  confirmed structurally that nothing in this codebase ever sets a
  frame-blocking header, so the generated `<iframe>` snippets render
  chromeless content when pasted into any host page including a `data:` URL.

## Settings round-trip (event / tracks / portal / resources)

All verified via PATCH/PUT + re-GET, with the change also confirmed visible
on a public surface (not just echoed back by the same endpoint):

- Event settings: `PATCH /api/v1/events/:id` (name, timezone) — new name
  "DevFlow Conf 2027 (Updated)" persisted and appeared in the public embed
  page `<title>`. `recordPrefix` is intentionally read-only in the UI
  (`EventSettingsPanel.tsx`, disabled input) and silently ignored by the
  PATCH handler (not in its field whitelist) — correct by design, since refs
  already issued (e.g. `SES-001`) bake in the prefix at generation time and
  changing it retroactively would desync old vs. new refs; not a defect.
- Tracks: `PATCH /api/v1/tracks/:trackId` (name, color) — renamed "AI
  Engineering" -> "AI Engineering (Updated)", change visible immediately on
  `/embed/.../sessions`.
- Portal settings: `PUT /api/v1/events/:id/portal-settings` (welcomeMessage,
  accentColor, logoUrl) round-tripped on re-GET.
- Resources: `POST /api/v1/events/:id/resources` (wiki kind) — new resource
  appeared in the subsequent `GET` list (4 -> 5 items, all titles present).

## Build & tests

- `npm run build` — green (tsc x2 + vite build), before and after fixes.
- `npm test` — 186 test files / 1587 tests, all green, including the new
  `test/docs-route-coverage.test.ts`.

OPEN ITEMS: 0
RESULT: PASS
