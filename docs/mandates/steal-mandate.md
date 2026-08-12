# MANDATE — competitive-steal round (apply AFTER the design round converges)

Source: code-level reads of three competing entries (speakerops, gatherpulse,
conference-engine). Most of their good ideas we already have — verified in-tree:
structured `conflicts[]` with typed kinds (`src/domain/schedule.ts`), 404-not-403
cross-org isolation (`test/exports-cross-org.test.ts`), bearer tokens barred from minting
tokens (`src/routes/api/tokens.ts`, DEC-027), and `chunkIds` + chunk-sweep tests for D1's
bound-parameter limit (`src/lib/chunk.ts`). **Do not re-implement those.**

Deliberately NOT stolen, do not add:
- **Reservation-row write locks** for scheduling. A competitor uses uniqueness constraints
  to *refuse* conflicting placements. That contradicts our warn-never-block decision
  (SPEC J9): the schedule is the most fluid artefact of an event, partial states must
  always save. Keep warning and counting; never block.
- **Durable Objects / response-schema validation / a new ORM.** Architecture changes with
  no time to verify them.

Ordered, each item independently shippable — stop anywhere and main stays green.

## 1. Auto-scheduler: per-item reasons for what it could not place

Today `autoSchedulePlan` reports counts only (`{unplaced: number, conflicts: number}`,
`src/domain/schedule.ts:75`). Return, and render, a reason per unplaced session — e.g.
"no free 45-minute slot in any room on any day", "speaker already booked in every
candidate slot", "not accepted". Keep the greedy placer's behaviour identical; this is
reporting, not new scheduling logic. Copy rule: name the constraint, promise nothing.

Why: turns a black box into a usable tool, and it is the difference between "the tool
gave up" and "the tool told me what to fix". The unplaced list is already on screen.

## 2. Blind review: freeze the anonymisation policy at assignment time

Anonymisation is currently read live from the plan. If an organizer toggles
"anonymise" mid-round, previously-assigned reviewers retroactively gain or lose identity.
Snapshot the flag onto the assignment row when it is created (additive migration; default
from the plan's current value) and read the snapshot in the reviewer surface.

Also verify — and add a test for — the file-serving path: a reviewer on an anonymised plan
must not be able to fetch a submission's attachments if those attachments carry identity.
A competitor's blind review is bypassable exactly there (their redaction happens at render
time only). Ours must fail closed at the repository, not the view.

## 3. Public embeds: a hardened embed element alongside the iframe snippet

We ship copyable iframe snippets. Add a small `embed.js` that defines a custom element
which: validates its `src` is our own origin, renders into a sandboxed iframe, and resizes
via `postMessage` with the message's `origin`, `source`, and instance id all validated and
the height clamped to a sane range. Keep the plain iframe snippet as the default — the
element is the upgrade, not a replacement.

Why: an embed script is the one piece of our code that runs on someone else's page. This
is the highest-blast-radius surface we own and currently the least defended.

## 4. Ship the self-audit

`docs/AUDIT.md` is written and staged; link it from the README. Keep it accurate — if this
round changes any of its claims (particularly the "not built" list), update it in the same
commit. An audit that drifts from the code is worse than no audit.

## Gates

Unchanged and all must stay green: `npm run build`, `npm test`,
`npm run gate:render-sweep`, `npm run walkthrough`, `npm run perf:smoke`. Items 1–3 each
need a test that would fail without the change.

## 5. Sessionboard importer — the one unclaimed differentiator

Not one of the thirteen entries read at code level ships a way to get an existing event
*out of Sessionboard and into the clone*. Every self-host pitch in this field quietly
assumes an empty database, which is exactly the thing that stops a team mid-season from
switching. This is a product argument nobody else is making, and it is the literal premise
of the competition ("we never have to pay for this closed source SaaS").

Build it in two layers, testable first:

**Layer 1 (build and test this — no credentials needed): import their export.**
Sessionboard exposes CSV/XLSX export over submissions, speakers, and sessions. Add
`POST /api/v1/events/:eventId/import/sessionboard` accepting an uploaded export file, with:
- column mapping (reuse the CRM CSV importer's mapping UI — it already does auto-mapping,
  a 5-row preview and per-row validation),
- a **dry run** that reports created/updated/skipped per entity *before* writing,
- idempotent upsert keyed on their record id stored in an `external_ref` column, so a
  re-import updates rather than duplicates,
- import into contacts + submissions + tracks + participants, preserving their record refs.

**Layer 2 (write it, label it honestly): their REST API.**
Sessionboard publishes an API (sessionboard.mintlify.app). Implement an adapter behind the
same importer — organizer pastes a Sessionboard API token, we page their endpoints and feed
the identical mapping pipeline. We have no account to test against, so **say so in the UI
and the README**: "implemented against Sessionboard's published API; not yet verified
against a live account." A competitor shipped exactly that kind of honesty note and it read
as credibility, not weakness — the opposite of shipping a simulator behind a full UI.

Acceptance: a judge can take a Sessionboard export, drop it in, and see their real event
appear — with a dry run first. That is the difference between "nice clone" and "we can
actually cancel the contract."
