## 2026-08-15 task-w50-g — J12 data-out adjudication @ 87cee8b9

NOT QUALIFYING (docs-only — DEC-069)

INVALIDATED BY: src/** app/src/** migrations/** package.json

Docs-only adjudication lane (DEC-099 w50): scope classifies to no slot —
not one of the five QUALIFYING claimants (build+test+bundle / walkthrough
/ perf-smoke / spec-audit / triage-closure). Touched nothing outside
`docs/**` (DEC-069 w50); no `src/**`, `app/src/**`, `migrations/**` or
`package.json` write in this worktree. Defects below are FILED, not
fixed (DEC-453), owner `wave-51 lane`.

Worktree branched from `main` tip `87cee8b9` (post scribe-wave-50 commit)
via `git worktree add`; no fetch/merge performed; `HEAD` at adjudication
time is `87cee8b9` (`git rev-parse --short=8 HEAD`). No other lane's
scope was read as authoritative beyond files cited by path below.

Population per SPEC.md:177-181 (J12 "the data stays theirs"): exports
everywhere CSV+JSON (submissions, speakers, evaluations, agenda, email
log — plus `contacts`, a sixth kind added post-J11), a REST API at
`/api/v1` with bearer tokens the admin SPA itself consumes, and an
optional one-way Airtable sync.

### Q1 — every SPEC-named export kind reachable in both format=csv and format=json, same row cap, same attachment disposition

CONFIRMED via source read + targeted test run, not asserted.

`src/server/repo/exports/kinds.ts:6` — `EXPORT_KINDS = ["submissions",
"speakers", "evaluations", "agenda", "email-log", "contacts"]` — a
superset of SPEC's five named kinds (submissions, speakers, evaluations,
agenda, email log); `contacts` is an additional J11/DEC-671 kind, not a
gap.

`src/routes/api/exports.ts:71-200` (single handler,
`GET /api/v1/events/:eventId/export/:kind`) builds ONE `table` via
`buildExport(...)` (line 169) BEFORE branching on `format`
(`c.req.query("format")`, lines 81-84, 192-200) — the truncation refusal
at lines 178-190 (`table.truncated` → `ApiError("invalid", ...
${EXPORT_MAX_ROWS}-row cap...)`) runs identically for both formats
because it executes before the `if (format === "json")` branch at line
192. `EXPORT_MAX_ROWS` (`src/server/repo/exports/table.ts:24`) = 20000,
enforced once per-kind inside each kind's own row query (e.g.
`src/server/repo/exports/submissions.ts:111,116`;
`speakers.ts:63,68`; `evaluations.ts:170,174`; `agenda.ts:79,83`;
`email-log.ts:60,64`; `contacts.ts:100,104` — each `.limit(EXPORT_MAX_ROWS
+ 1)` then `if (rows.length > EXPORT_MAX_ROWS)` sets `truncated`), so the
cap is a single population-level fact both formats read, not two
separately-enforced caps that could drift.

Attachment disposition: CSV branch (`exports.ts:197-200`) sets
`Content-Disposition: attachment` via `contentDispositionAttachment(
\`${kind}.csv\`)`; JSON branch (`exports.ts:192-195`) sets the SAME
header via `contentDispositionAttachment(\`${kind}.json\`)` before
`c.json(table.records)`. Both call the same `contentDispositionAttachment`
helper (`src/domain/files.ts`), differing only in the file extension
argument — no separate disposition logic exists for JSON.

The showflow export (`exports.ts:54-69`,
`GET /api/v1/events/:eventId/exports/showflow.csv`) is CSV-only by design
(DEC-055 — "a separate fixed-column surface on its own route", not one of
the six `EXPORT_KINDS`) — outside this clause's population, not a gap in
it.

Targeted test run (`npx vitest run test/audit-claims.test.ts`, this
worktree): `docs/AUDIT.md J12 export-kind claims vs EXPORT_KINDS`
describe block passed 3/3 — "every EXPORT_KINDS value is named in
backticks in the J12 section" and "no backticked kind-shaped token ...
names a kind absent from EXPORT_KINDS" both green, so the six kinds
above are also the six the docs claim, mechanically checked, not by
inspection.

RULING: clause CLOSES. Reachable in both formats, identical cap
(pre-format-branch), identical disposition mechanism.

### Q2 — bearer-token path org-scoping + closed set of cookie-session-only routes

CONFIRMED via existing scan tests, cited not re-derived.

Org scoping on every route the bearer path can reach:
`src/server/middleware.ts:145-162` (`resolveBearerAuth`) re-resolves the
minting user on EVERY request (no cached privilege on the token row
itself) and sets `auth.orgId = user.orgId` (line 159) — every downstream
handler's org-scoping check (`auth.orgId`) is therefore live per-request,
not a snapshot. `test/route-authz-enumeration.scan.test.ts` (13/13
passed, this run) derives EVERY route registration under `src/routes/**`
text-at-test-time and classifies GUARDED (names a role guard, a mount-
level guard, or an object-level ownership marker) / PUBLIC_BY_DESIGN /
GAP, failing on any GAP — this population is not bearer-vs-cookie
filtered, i.e. it covers every route a bearer token could reach (bearer
auth sets the identical `auth` shape cookie auth does; there is no
bearer-only route).

Closed set of cookie-session-only (credential-bearing) routes:
`test/credential-route-cookie-session.scan.test.ts` (4/4 passed, this
run) derives the credential-bearing population from
`src/routes/api/**` at test time via capability markers
(`generatePassword(`, `updateUserPasswordHash(`, `hashPassword(`,
`newApiToken(`, `updateUserRole(`) — not a hand list — and asserts every
member's registration text names `requireCookieSession`. Its tripwire
test ("derived population contains the four named routes") pins the
closed set to exactly `POST /api/v1/users`, `POST
/api/v1/users/:id/reset-password`, `PATCH /api/v1/users/:id`, `POST
/api/v1/tokens` (`grep -c requireCookieSession src/routes/api/*.ts`
independently confirms only `tokens.ts` and `users.ts` reference the
guard). A negative control asserts `POST /api/v1/contacts` — a bearer-
reachable, non-credential route — is correctly excluded from the
population, so the derivation isn't over-broad.

`test/users-bearer-containment.test.ts` (4/4 passed, this run) drives
the real `usersRoutes` sub-app with `auth.viaBearer = true` and asserts
403 on both credential routes, 2xx for the cookie-session equivalent —
this is the executable proof the scan's static claim actually holds at
request time, not just in source text.

RULING: clause CLOSES on both sub-questions — org scoping is live
per-request (not cached on the token) and the cookie-session-only set is
provably closed by a derived (not hand-listed) scan plus a request-level
containment test.

### Q3 — POST /api/v1/tokens has no per-org cap on api_token rows

CONFIRMED-DEFECT.

`src/routes/api/tokens.ts:64-94` (`POST /api/v1/tokens` handler): after
`requireOrganizer, requireCookieSession, csrfJson` and a `name` length
check (`MAX_NAME_LENGTH`, line 72), the handler unconditionally
`INSERT`s a new `schema.apiToken` row (lines 80-89) — no `COUNT(*) FROM
api_token WHERE org_id = ?` guard precedes the insert, unlike the
sibling credential-bearing route `POST /api/v1/users`
(`src/routes/api/users.ts` — an ANALOGOUS per-org population guarded at
`countOrgUsers`, `src/server/repo/users.ts:72`, read at
`src/routes/api/users.ts:62,185` before insert). No test in this
worktree (`grep -rn "MAX_.*TOKEN\|tokens.*cap" test/`) exercises a token-
count cap; `test/tokens.test.ts` (19/19 passed, this run) covers name
validation, prefix, list pagination and deletion, never a create-time cap.

Adjudicated against the STAGE principle ("A UNIVERSAL NEEDS A POPULATION
/ UNBOUNDED SURFACE NEVER PAGED"): the GET list (line 23-62) IS correctly
paged (`clampPage`/`listPerPage`), so the read side is not the gap named
here — the write side is. An organizer-authenticated, CSRF-protected
actor can grow `api_token` without bound for their own org; this is a
narrower risk class than an attacker-controlled unbounded surface (it is
self-inflicted storage/DoS by a privileged actor, same trust level as
`POST /api/v1/users`, which DOES cap), but the sibling route's cap is
direct evidence the codebase already treats "unbounded organizer-created
rows of a credential-bearing kind" as a defect class worth guarding, and
`tokens.ts` does not follow its own sibling's pattern. Ruled a real gap,
not deliberate — nothing in `decisions/` or `docs/clarifications.md`
names a token-count exemption, and the silence is inconsistent with the
users precedent rather than a considered choice.

CONFIRMED-DEFECT: `src/routes/api/tokens.ts:64-94` — POST /api/v1/tokens
has no per-org row-count cap, unlike the analogous `POST /api/v1/users`
(`countOrgUsers` guard). Owner: wave-51 lane.

### Q4 — published API surface vs the real composed route table

CONFIRMED via two independent bidirectional scans, both re-run this wave.

`test/docs-api-manifest.scan.test.ts` (10/10 passed, this run) diffs
`API_DOC_ENDPOINTS` (`src/routes/docs-endpoints.ts`, the single source
`docs.tsx` renders from) against `enumerateRegisteredRoutes()` — a real
router scan — in both directions (undocumented-live, stale-doc,
stale-omission), plus a floor tripwire (>=100 live, >=80 documented) so
neither side can quietly go empty.

`test/api-docs-enumerated.test.ts` (4/4 passed, this run) independently
diffs `ROUTE_GROUPS` (`src/routes/docs.tsx`) against `app.routes` — the
actual mounted Hono app exported by `src/index.ts` — again bidirectional,
with a >=100-route floor and a closed, reasoned
`UNDOCUMENTED_BY_DESIGN` allowlist (currently just `GET /api/v1`, the
meta endpoint).

`test/audit-claims.test.ts`'s two DEC-618 describe blocks (23/23 passed
across the whole file, this run) add a THIRD independent direction:
`docs/AUDIT.md`'s prose route claims (both bare `` `/path` `` and
`` `METHOD /path` `` forms) are resolved against `ROUTE_MANIFEST` and the
composed app respectively, so prose documentation (not just the
structured `docs.tsx`/`docs-endpoints.ts` pair) is mechanically checked
too.

RULING: clause CLOSES. Three independent, router-derived (never
hand-mirrored) bidirectional scans exist and were green this run; the
published API cannot drift from the implementation without one of these
three failing by name.

### Q5 — Airtable sync

DEFERRED-STAGE-2, per `docs/clarifications.md:22-23` ("Airtable:
nice-to-have, not a minus if unused. Read-only is fine ... Never the
primary DB."). Code exists (`src/sync/airtable.ts`,
`DEC_435`/`DEC_450`/`DEC_725` in `src/decisions-data/`) and is described
by those decisions as "stage-1 code correctness, stage-2 wiring" —
`src/server/env.ts:27-33` gates it behind optional `AIRTABLE_TOKEN`/
`AIRTABLE_BASE_ID`/`AIRTABLE_ORG_ID` secrets that STAGE 1 forbids running
with present. No scope opened here; not re-adjudicated beyond citing the
governing decisions and clarification.

RESULT: FAIL — PARTIAL: Q1, Q2, Q4 CLOSE on cited evidence (targeted test runs
quoted above: route-authz-enumeration.scan 13/13,
credential-route-cookie-session.scan 4/4, users-bearer-containment 4/4,
tokens 19/19, docs-api-manifest.scan 10/10, api-docs-enumerated 4/4,
audit-claims 23/23 — 77/77 total, all green this run); Q3 is a
CONFIRMED-DEFECT (`src/routes/api/tokens.ts:64-94`, owner wave-51 lane);
Q5 is DEFERRED-STAGE-2 per clarifications, no scope opened.
OPEN ITEMS: 1
