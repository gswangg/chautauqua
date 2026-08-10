# Eval findings — consolidated (CC-native browser eval, 2026-08-10)

Source: a Claude Code browser-driving eval (subscription auth, no API key) that drives the
RENDERED app through a real browser against a fresh seeded `wrangler dev`, following
redirects — catching UI-reachability and real-data-shape bugs the API-level walkthrough
and unit tests miss. Six areas swept (CFP, abstract-mgmt, speaker-mgmt, content, agenda,
public-widgets, CRM).

## SWARM ROUND MANDATE

Resume from the current HEAD and address the items below. This is code-bearing → the
DEC-069 exit predicate reopens; re-run ALL gates before re-declaring stage-1 complete.
Do, in priority order:

1. **Ratify the two already-applied fixes** (Section A) and add their regression tests.
2. **Fix the P1 bugs** (Section B).
3. **Build the two new permanent gates** (Section F) — this is the highest-leverage item:
   it closes the systemic gap that let three render crashes ship.
4. **Enrich the seed** (Section E) — required so the content/portal flow is exercisable at
   all (by this eval AND by human graders).
5. **Fix P2 gaps** (Section C) as far as time allows, by rubric weight.
6. Section D (optional/low) only if everything above is green.

Overall the product is strong: agenda builder (7/8 rubric items pass, warn-not-block
conflict engine + auto-schedule working), public data consistency, CRM core, organizer
speaker tooling, deliberate-notify comms with templates/merge/preview all work well.

---

## A. Already fixed directly (RATIFY + add regression test)

- **P0 admin redirect loop** — `wrangler.jsonc` assets `html_handling: "none"` so the
  worker's explicit `/admin/index.html` fetch returns 200 instead of ASSETS'
  auto-trailing-slash 307→/admin/ loop. Add: authenticated redirect-following test that
  `GET /admin/` returns 200 SPA, not 3xx.
- **/admin/submissions "n is not iterable" crash** — `SubmissionsTable.tsx` now reads
  `apiGet<{fields}>('/events/:id/forms').then(r => r.fields)` instead of `apiList(...).items`
  (that endpoint returns a single form object, not a list envelope). Add: render test for
  /admin/submissions with seeded data.

## B. P1 — bugs that break a core flow

- **/admin/review/plans/:id (existing plan detail) SPA crash: "Invalid time value."** An
  unguarded Date format on a null/invalid plan date renders the plan-detail page (and its
  /assign, /reviewers sub-routes) fully blank. Blocks ABS-05 (reviewer assignment) and
  ABS-03/07 end-to-end. Fix: guard date formatting (render '—' for null/invalid) across
  the review pages; add a render test.
- **Reviewer queue empty despite assignments.** Organizer Progress shows sbek-reviewer
  12 assigned / 7 completed (5 pending), but the reviewer's "Your queue" says "Nothing
  left" and the reviewer's event selector shows only "No events" (can't select DevFlow
  Conf 2027). Root cause likely: reviewer-role users aren't granted event membership / the
  event-selector query excludes them, so their queue resolves to no event. Blocks all
  reviewer scoring (ABS-03/07).
- **Public itinerary `.ics` export always empty.** `/e/:slug/schedule.ics` returns a
  VCALENDAR with zero VEVENTs even with a saved pick, because picks live in localStorage
  and the server endpoint can't read them. Brief requires working calendar invites. Fix:
  either encode the selection into the .ics URL (query param of session ids) or add
  account-backed itineraries; the "Add to calendar" link must produce a populated .ics.
- **Overlapping session blocks intercept the itinerary checkbox click.** On the schedule/
  agenda grid, two overlapping sessions in one room column overlap visually and the top
  block eats pointer events, so the lower session's "Add to itinerary" checkbox is
  unclickable. Fix: z-index/pointer-events layout so every block's controls are hittable.
- **Speaker portal profile does not reflect to the organizer.** A speaker edits bio/
  social/headshot in /portal/profile (persists), but no organizer-side view (CRM contact
  record or submission detail) shows bio/social/headshot — so SPK-08's round-trip is
  broken and organizers can't see speaker-provided profile content. Fix: surface the
  portal profile model on the organizer contact/speaker record.
- **CSV import: reports success but row not persisted; and creates duplicates instead of
  merging.** A pasted row reports "Import 1 row(s)" but total count doesn't change and the
  contact isn't found. Separately, importing a person who already exists (same name+company,
  different email) creates a second contact rather than merging. Tie to the next item.
- **Near-duplicate detection fails to flag obvious dupes.** The Duplicates tab reports "No
  duplicate groups found" for two "Priya Raman" (same company) / two "Marcus Okafor"
  differing only by email, so merge can't be exercised. Fix the match rule (name+company,
  or normalized-name fuzzy) so the seeded dupes surface.

## C. P2 — real gaps aligned with rubric / brief (fix by weight)

- **Public sessions cards omit date/time and room** (EMB-01 partial) — cards show title/
  speaker/track/description only. Add date/time + room to each card.
- **No public session keyword search** (EMB-02 not_found) — add a search box over the
  sessions list matching title AND speaker name.
- **No speaker/gallery drill-in detail** (EMB-05, EMB-08, EMB-13) — speakers-list entries,
  agenda session blocks, and gallery cards are non-interactive; add detail views (bio +
  their sessions; session full detail with description/format/track).
- **No agenda day-switcher** (EMB-07) — all three days render stacked; add day tabs/nav.
- **No headshots in speakers directory / gallery uses placeholders only** (EMB-04, EMB-12)
  — wire real headshot images (depends on Section E seed providing headshots).
- **No admin editing of session title/abstract** (CNT-09) and **no admin editing of speaker
  bio/headshot** (CNT-10) — submission detail is read-only; contact editor lacks bio/
  headshot. Add admin edit controls.
- **No reachable UI to set content-approval status** (CNT-12) — approval *gating works*
  (unapproved content is correctly excluded from public), but "Content: pending/approved"
  is display-only; expose an approve / request-changes control (currently gated behind a
  file-review path that's unreachable with no files).
- **Scorecard lacks a free-text criterion type** (ABS-03) — only rating + dropdown.
- **No per-round scorecard** (ABS-01) — "Rounds" is a count over one shared scorecard;
  allow a distinct scorecard per round.
- **Bulk email lacks named templates + merge preview in the CRM path** (CRM-11) — the
  event Comms path has templates/preview; bring parity to /admin/contacts bulk email.
- **CRM: no true multi-criteria filter** (CRM-02), **lossy segment-from-search** (saving a
  free-text search stores a wrong firstName-only rule → reopening returns 0), **metrics
  strip not a dashboard** (CRM-12).
- **Task due-date off-by-one** (TZ) in the speaker task matrix column headers (enter 5/25 →
  shows 5/24). Normalize date display to the event timezone.

## D. Optional / low (only after A–C + F green)

- CRM sourcing kanban pipeline + stage history (CRM-07/08) — optional area.
- Push-a-contact-into-an-event's-speakers (CRM-10).
- Content version history with attribution + restore (CNT-11); central browsable files
  library (CNT-13); multi-select ZIP bulk download (CNT-14).
- Agenda: no explicit publish/go-live action (AIA-07) — data flows to public continuously
  (arguably fine per warn-never-block design); add a publish button that reports success if
  cheap.
- Agenda Unscheduled panel lists an `accept_queue` session as placeable though the slot API
  correctly rejects it (AIA-08 low) — filter the queue to accepted-only.
- Soft-404: unknown /admin/* routes render the nav shell with an empty main instead of a
  404/redirect. Add a catch-all.
- A11y: admin contact-editor inputs have no accessible labels.
- No sign-out control found in admin or portal UI — add one.

## E. Eval-infrastructure — enrich the seed (REQUIRED for grading)

The current seed leaves the demo speaker (Priya Raman / sbek-speaker@example.com) with only
under-review submissions, so they have NO accepted session and NO assigned tasks — which
makes the entire content/portal deliverable flow un-exercisable by this eval AND by human
graders (SPK-09/11, CNT-02/04/05 all blocked on this). Fix the seed so the demo event has:
- at least one accepted session for the primary demo speaker, with 2–3 assigned onboarding
  tasks (including a file-request task) carrying due dates;
- at least one uploaded deliverable file WITH a second version and an admin↔speaker comment
  thread, so versioning/comments/approval are visible in a filled state;
- headshots on several speakers so the speakers directory/gallery show real images;
- the seeded near-duplicate contacts kept (they're the test vector for dedupe).

## F. Build these two permanent gates (HIGHEST LEVERAGE)

Three SPA render crashes (admin loop, submissions iterable, plan-detail date) all passed
898 unit tests + the API-level walkthrough + the DEC-069 gates, because nothing rendered
the admin SPA in a browser against real data. Close it with two gates:

1. **Serial browser render-sweep gate** (a DEC-069 gate lane, like the walkthrough/perf
   gates — one booted seeded server, one browser, serial; NOT parallel worker work, so it
   doesn't fight the swarm's concurrency). Script: boot seeded `wrangler dev`; ENUMERATE
   the entire route surface — every route in the SPA's React Router table + every portal
   route + every public route (not a hand-picked list); for each, authenticate as the
   correct role and load it; assert HTTP 200 + non-empty `#root` + ZERO console/page
   errors. Wire into CI as a third gate alongside walkthrough + perf-smoke.
2. **Parallel-safe component-render smoke tests** (vitest + jsdom + React Testing Library)
   that render each admin/portal page component against fixture-SHAPED API mocks (mirror
   the real endpoint envelopes, incl. the single-object /forms shape and null date fields)
   and assert it renders without throwing. These need no server/port, so individual workers
   run them in their worktrees as a first-line filter during implementation.
