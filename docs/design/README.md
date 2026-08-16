# Handoff: Chautauqua admin, portal and public redesign

## Overview

Chautauqua is an open-source speaker & event-content management platform (a Sessionboard replacement) — one Cloudflare Worker serving an admin SPA at `/admin`, a speaker portal at `/portal`, server-rendered public event pages at `/e/:slug/*`, and a public CFP form at `/submit/:slug`.

The app is functionally complete but visually unstyled (a single 327-line `app/src/styles.css` with browser-default form controls). This bundle is a full visual redesign of **every route in `app/src/routeManifest.ts`**, plus the modals that never appear in that manifest, at desktop (1240px) and phone (390px) widths — 72 frames across 11 files.

Two structural changes go beyond styling, and both are deliberate:

1. **Overview stopped being a directory.** It used to show six cards, each a count linking to the tab with the same count — while the sidebar showed those counts too. Three copies of one fact. The redesign puts the work itself on Overview: named speakers with Remind on the row, named submissions with Accept/Decline, sessions with Approve. The sidebar carries destinations only, with a badge solely when something is wrong.
2. **The agenda works on a phone.** Not by shrinking the 5-column × 15-minute grid, but by changing the interaction: one room in view, time down the page, tap-to-place instead of drag. This maps onto the existing `PUT /submissions/:id/slot` body `{day, startMin, endMin, roomId}` — dragging was only ever the desktop's way of naming those four values.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour. They are **not production code to copy**. They use a streaming component runtime (`support.js`) with inline styles; do not port that runtime.

The task is to **recreate these designs in Chautauqua's existing environment**: React 18 + React Router v6 + Vite for the admin SPA (`app/src/`), and Hono JSX server-rendered components for the portal and public surfaces (`src/routes/`). Keep the existing route structure, data fetching (`app/src/lib/api.ts`), optimistic-update patterns and role gating exactly as they are — this is a re-skin plus the two structural changes above, not a rewrite.

Styling approach: the current `app/src/styles.css` already uses a `--chq-*` custom property convention. Replace those values with the tokens below and add the new component classes there; the design needs no CSS framework.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, and copy. Recreate pixel-perfectly. Every hex, size and weight in this document is the value used in the mocks.

Two caveats: the mocks show static states (no real hover/focus animation), and long-list frames show 3–8 rows where production paginates at 25–50 (`PER_PAGE` in each page module).

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| Paper | `#F4F1E8` | Page ground (oat) |
| Surface | `#FAF8F2` | Inputs, cards on paper |
| Surface sunk | `#EFEBDF` | Secondary buttons, footers, bulk bars |
| Ink | `#1B1D17` | Primary text, 2px section rules, inverted panels |
| Ink text secondary | `#3F4237` | Body copy |
| Muted | `#565A4B` | Metadata, labels, captions (5.2:1 on paper — this is the floor) |
| Disabled | `#8E8A7A` | Inert controls, undeletable rows |
| Hairline | `#E1DDCE` | Row dividers |
| Rule | `#D3CFC0` | Table top/bottom rules, frame borders |
| Border | `#BAB6A6` | Input and secondary-button borders |
| Border strong | `#CFC7B7` | — |
| **Brand (olive)** | `#4E5C31` | Primary buttons, links, active nav, positive/complete states |
| Brand hover | `#3C471F` | Link hover |
| On-brand | `#F7F9F0` | Text on olive |

**There is no red, and no third accent.** Lateness, clashes and "not reviewed" are set in **type** — 10–11px, weight 800, `letter-spacing: 0.09–0.11em`, uppercase, in Ink. This was a deliberate decision after the palette read as green-and-red (Christmassy) with a red alarm colour. Do not reintroduce a semantic red without revisiting it.

On dark surfaces (`#1B1D17`): text `#F4F1E8`, muted `#B5AFA2` (7:1), hairline `#3A3D32`.

Merge screen only: the discarded value is `#565A4B` with `text-decoration: line-through` in `#A8A392` — legible, because merge is irreversible and the discarded value is the evidence for the decision.

### Typography

Two families, from Google Fonts:

- **Familjen Grotesk** — headings, numerals, row titles, wordmark. Weights 400/500/600/700.
- **Figtree** — body, labels, metadata, buttons. Weights 400/500/600/700/800.

| Role | Size / weight / tracking |
|---|---|
| Page title (desktop) | 36px / 700 / `-0.04em` |
| Page title (phone) | 25–27px / 700 / `-0.04em` |
| Overview headline | 44px / 700 / `-0.042em` / lh 1.04 |
| Section label | 11px / 700 / `0.12em` / uppercase, above a 2px Ink rule |
| Row title | 15–21px / 600 / `-0.015…-0.02em` |
| Body | 15–16px / 400 / lh 1.6–1.7 |
| Metadata | 12–13px / 400–600, Muted |
| Micro label | 10–11px / 700–800 / `0.09–0.12em` / uppercase |
| Deadline value | 30px / 400, nearest one 700 |

**10px is the absolute type floor** anywhere in the UI, including placeholder labels.

### Spacing, radius, elevation

- Desktop frame padding `26–34px`. Content max-width follows the three container classes above: 820 reading, 1440 tables, uncapped canvases; forms sit at `660–760px` within the reading measure.
- Section gap `26–36px`; row padding `13–18px` vertical.
- Radius: `4px` desktop controls, `6px` phone controls, `5–6px` cards, `20px` phone frame, `99px` pills.
- Borders: `1px` hairlines; `2px solid #1B1D17` under every section label. One `2px` rule per section — that rule *is* the section header.
- No shadows inside the UI. Frame shadows in the mocks (`0 18px 44px rgba(27,29,23,0.13)`) are canvas presentation only — do not port them.

### Controls

Three visible tiers, one filled primary per row:

- **Primary** — `background:#4E5C31; color:#F7F9F0`, no border, weight 700.
- **Secondary** — `background:#EFEBDF; border:1px solid #CFC7B7; color:#2E2A24`, weight 600.
- **Tertiary** — text only in brand olive, weight 700; or Muted with a hairline underline.

**Every interactive element is ≥44px on phone** (`min-height:44px` plus centred flex, not padding). Desktop rows use `padding:8–10px 14–18px`.

Nav underline uses `box-shadow: inset 0 -2px 0 #4E5C31`, **not** `border-bottom` — a border adds 2px below the text box and knocks the item off the row's baseline.

## Open decisions

**DEC-382 vs. the home page.** `src/routes/tools.css.ts` records that the three operator surfaces (`GET /`, `/docs/api`, `/dev/mailbox`) "are chrome, not designed screens" sharing one `TOOLS_CSS` module. This bundle designs `GET /` as a real public surface, which revises that decision for `/` only — `/docs/api` and `/dev/mailbox` stay chrome — including under the new `/docs` site, which links out to the API reference as a leaving link rather than absorbing it. The home page should draw on the public CSS family (`public.css.ts`), not `TOOLS_CSS`.

**`GET /` is an anonymous event hub, and needs more data than it reads today.** Decisions taken: one org per deployment, so the hub is simply "our events"; a signed-in organiser or reviewer **redirects to `/admin`** and a speaker to `/portal`, so this page only ever renders for anonymous visitors — all of which is new work. `GET /` does not read `c.var.auth` today; it renders the same landing page for everyone. The redirects that already exist are on `/admin` (anonymous → `/login`, speaker → `/portal`) and do not fire on `/`; and it lists **only events with an open CFP or a published programme** — never an unannounced future event, since `/` has no auth.

The route currently calls only `getFirstEventSlug()`. It now needs a list of the org's events with, per event: name, slug, dates, location, the default form's window via `formWindowState(openDate, closeDate, now, timezone)`, and a published-session count. Rows carry public-safe facts only — dates, venue, CFP deadline, session count. Deliberately excluded: submission counts, review progress and speaker-task health, which are internal and would leak an event's health to anyone.

Listed: an event whose CFP is open (`formWindowState` → `open`), or one with published sessions. Hidden: `not_yet_open` CFPs (announcing a date you have not announced), events with no published sessions (a link to an empty page), and the gap between a CFP closing and a programme going up. The test for any new field is one question — would you mind a competitor reading it?

Kept off every row deliberately: submission count, review progress, speaker-task health, acceptance rate, last activity. Each describes how well an event is *going* rather than what a visitor can *do*, and a thin CFP or a stalled review wave is the organiser's business.

"Published programme" stays true after an event ends, so a finished event would sit at the top of a flat list forever. Rows are therefore grouped **Open for submissions / Programme published / Already happened**, which fixes that and matches what a visitor arrived to find out. Within a group: soonest deadline first, then soonest event; past events newest first.

**Every state is drawn at both widths.** Desktop lays an event out as a three-column row — dates, name and state, action. Phone stacks the same fields into a card with a full-width button. Both keep all three groups on screen; a chip strip that showed one group at a time was tried and rejected, because each group holds one to three rows and filtering left the phone showing fewer events than the desktop.

**Three states, not two.** A published programme stays published, so once an org has run a single event the hub always has something to show:

1. **Full hub** — an open CFP, an upcoming published programme, and an archive.
2. **Between cycles** — no open CFP and nothing upcoming, but past programmes are still up. The archive *leads* the page rather than sitting at the bottom under two empty headings.
3. **Fresh deploy** — nothing has ever been published. This is the only genuinely empty state, and the only one that shows just a sign-in.

The masthead carries the **org's** name, not the product's — matching the public event pages, which lead with the event name. Chautauqua is named once, in the footer, as a GitHub attribution link; that is the only place the product appears on a customer-facing surface. The design file carries a "Rules you can't see on the page" panel alongside the frames with the same reasoning.

**Dates are not reconciled with the seed — do not treat them as fixture-accurate.** The mocks show the CFP closing 16 August; `scripts/seed.ts` seeds `close_date: Date.UTC(2027, 2, 1, 23, 59)` — **1 March 2027** — corroborated by the comment in `src/lib/submit-core.ts`. The seeded form has no `open_date` (so it opens immediately), and the form's `description` is `"Default CFP form for DevFlow Conf 2027"`, an internal label rather than public intro copy. Two further consequences, unresolved at time of writing:

- The deadline strip's "Doors open" and "Review wave 2" values derive from an implied "today" that the seed does not support. Recompute both from whichever "today" you adopt: doors are `event.startDate` = 12 May 2027, and the seeded evaluation plan closes `Date.UTC(2027, 4, 20)` = 20 May 2027.
- **Under the seed, "CFP closes in 6 days" and "3 speaker tasks overdue" cannot both be true.** Every seeded task is due between 1 April and 1 May 2027, all after the 1 March close. Overview currently shows both. Pick a single "today" and let every countdown and status follow it — mid-April 2027 keeps the overdue worklist and closes the CFP; late February keeps the CFP open and empties the overdue section.

The screens are correct as *design*; the numbers on them are illustrative until that one decision is made.

## Screens

All 33 routes in `app/src/routeManifest.ts` are covered. File → routes:

| File | Routes / views |
|---|---|
| `Chautauqua Docs.dc.html` | `/docs` — index, article, phone article, screenshot rules. **New route.** |
| `Chautauqua Home.dc.html` | `GET /` — the org's event hub, anonymous only: three states (full hub, between cycles, fresh deploy), each at 900 and 390 |
| `Chautauqua Overview.dc.html` | `/admin/overview` (desktop + phone), New event modal |
| `Chautauqua Submissions.dc.html` | `/admin/submissions`, `/admin/submissions/:id`, `/admin/submissions/forms` (+ phone), New submission and Save-view modals |
| `Chautauqua Review.dc.html` | `/admin/review` organiser tree, reviewer queue, reviewer scorecard, `/review/plans/:id` (+ phone) |
| `Chautauqua Speakers.dc.html` | `/admin/speakers` (+ phone), roster (phone), New task and Task response modals |
| `Chautauqua Content.dc.html` | `/admin/content` worklist + deliverable detail, files library (+ phone) |
| `Chautauqua Agenda.dc.html` | `/admin/agenda` day grid, phone tap-to-place |
| `Chautauqua Comms.dc.html` | `/admin/comms` compose step 3, templates, send history (phone) |
| `Chautauqua Contacts.dc.html` | `/admin/contacts` directory, drawer, import, pipeline, merge (each + phone), Bulk email and Add-to-event modals |
| `Chautauqua Settings.dc.html` | `/admin/settings` all 7 sections, 7 phone subscreens |
| `Chautauqua Public and Portal.dc.html` | `/e/:slug/{sessions,speakers,gallery,agenda,schedule}`, `/submit/:slug` + confirmation + closed, `/portal` and its 5 sub-routes |
| `Chautauqua Account.dc.html` | `/login`, `/account/password`, `/admin/*` not-found (+ phone) |

### Layout pattern (applies to every admin screen)

```
header (border-bottom 1px #1B1D17, padding 15px 34px)
  wordmark "chautauqua" — Familjen Grotesk 22px/700/-0.03em, lowercase
  nav — 13px/600, gap 15px, line-height 1, each item padding 4px 0
        active: box-shadow inset 0 -2px 0 #4E5C31
        no counts; olive/ink badge only for exceptions ("3 LATE", "2 CLASH")
  right: event name 13px/600 · user 11px/700/0.1em uppercase Muted

main (padding 26px 34px 34px)
  h1 + one-line factual summary (13px Muted)
  toolbar between 1px #D3CFC0 rules
  numbered sections: 11px/700/0.12em uppercase label + 2px #1B1D17 rule,
                     right-aligned action link, then rows split by 1px #E1DDCE
```

### Overview (the one to build first)

Deadline table across the top: 4 equal cells between 1px rules, each a link. Cell = 10px/700/0.12em uppercase Muted label + 30px Familjen value. The nearest deadline is weight 700, the rest 400. First cell has no left border. Data: `form.closeDate`, min `task.dueDate`, `plan.closeDate`, `event.startDate`.

Then `<h1>` "Four things need your attention" (44px/700). **No subtext** — and never a time estimate.

Five sections: `01 — Overdue speaker tasks`, `02 — Submissions awaiting triage`, `03 — Session content awaiting approval`, `04 — Unplaced sessions and conflicts`, `No action needed`. Rows carry the real object and its action inline. Section 01's caption reads "Skips anyone reminded in the last hour" — that is `MANUAL_DEDUPE_WINDOW_MS` in `src/domain/reminders.ts`, and it must stay next to the send button.

Row grids align on **first baselines** (`align-items:baseline`), not centre — cells are stacks of differing height, and centring each independently leaves nothing on a shared line. Button groups get `align-self:center`. Never put `align-self` on a cell that should sit on the baseline; it opts the cell out of baseline alignment entirely.

### Phone pattern

`390 × 844`, three regions: fixed header, `flex:1; min-height:0; overflow-y:auto` body, fixed footer with the primary action. Chip strips are `overflow-x:auto; -webkit-overflow-scrolling:touch` with `flex-shrink:0` chips — with `overflow:hidden` the last chip becomes unreachable. Five-item bottom tab bar (Overview, Submissions, Speakers, Content/Contacts, More) with an olive dot on the active item and an exception dot where relevant.

## Interactions & behaviour

Preserve today's behaviour exactly; the redesign changes none of it.

- **Optimistic updates with loud rollback** — task toggles, bulk status, agenda placement all render immediately and revert on `ApiError` (see `OnboardingGrid.toggleCell`, `SubmissionsTable.applyBulkStatus`, `AgendaPage.handlePlace`). Bulk status refetches rather than restoring a stale snapshot, since committed batches must not visually roll back (DEC-193).
- **Bulk selection spans pages** and is sent in batches of 100 (`chunkSelection`). The bulk bar says so.
- **Conflicts are surfaced, never blocked** (README J9). Placement writes, then reconciles the server's conflicts summary. A double-booked cell inverts to Ink with the label "Two sessions in one room"; it does not refuse the drop.
- **Reminders are bulk-per-event** with an optional `taskIds` filter — there is no per-person send. Row action is therefore "Remind this task". The endpoint skips anyone reminded within the hour and caps at 100 contacts, returning `{sent, skipped, remaining}`; surface all three.
- **Deciding never emails.** Status changes are silent; notification happens in Comms. The submission-detail decision panel states this.
- **Reviewers are confined to `/review`** (`RoleGate`) and see only queue + scorecard.
- **Task assignment status is `pending | complete` only** — no "waive".
- **Public itinerary** lives in `localStorage` under `chq_itinerary_<slug>` and travels to `schedule.ics?ids=` (300 cap) — `src/lib/itinerary.ts`.
- **Drafts** (public CFP) live in KV and are deleted on successful submit; button label "Save draft".

Hover: rows and nav items get `#EFEBDF`; links go `#4E5C31` → `#3C471F`. Focus: 2px olive outline, 2px offset.

## Review criteria — interaction rules

Implements the appended spec in `docs/eval-findings.md` (2026-08-12). A criterion is **label + optional one-line guidance + relative integer weight**. Shown in `03-review.png`.

- **Scale is plan-wide, never per-criterion.** It sits with Opens / Closes / Reviews per talk in the plan fields, captioned "Applies to every criterion in this plan".
- **Editing is inline rows**, the same pattern as the CFP form builder — no dialog. "Add criterion" is a tertiary link. Soft cap stated honestly: "3 of about 7 · more than that and reviewers rush the last ones".
- **Weights are relative integers with a computed share beside each** ("3 · 50%"). Never forced to sum to 100. Section caption: "Scores average by weight".
- **Criteria freeze at the first submitted review** (the anonymization-snapshot precedent). Locked rows are read-only under "Locked — 7 reviews scored against these criteria", with the reason given — "Changing these would rescore work already done" — and *Start a new wave* as the way forward. Delete follows the same rule.
- **A new plan prefills three editable defaults** (Relevance / Depth / Speaker readiness, equal weights) rather than an empty list.
- **The scorecard** renders each criterion as label + guidance + rating pills; the overall is the computed weighted mean, displayed and not editable.
- **Weights in the mock are 3/2/1, not equal**, so weighted ≠ naive is visible: pills 5/4/4 give **4.5**, and the panel says so — "A plain average of 5, 4, 4 would be 4.33". The reviewer queue chip and the wave-1 results row for that submission both read 4.5; all three derive from the one formula. Seed plans should carry distinct weights for the same reason.

## Speakers grid — interaction rules

Three things the first version of this design left unstated, each of which the build then invented an answer to. Shown in `04-speakers.png`.

- **Status cells are controls, not labels.** Clicking one toggles complete ↔ pending (`PATCH /task-assignments/:id`, optimistic with loud rollback — `toggleCell`). All three states share one control shape — filled olive for complete, outlined for pending, ink-outlined bold caps for overdue — with a hover ring and `cursor:pointer`. The grid footer states it: "Click any status to mark it complete or pending". Overdue must not be bare text; it looked passive and was the state most likely to be clicked.
- **Reading a form response: one quiet link, conditional.** A "Response" text link, styled exactly like the existing "File" link, appears **only on completed form-kind cells**. Never on pending cells (there is nothing to read), never on upload- or acknowledge-kind tasks. The grid carries a real form-kind column — *Hotel stay form* — so the link, the task-response modal and the speaker portal all name the same task. Do not render a bordered button per cell: at 12 speakers × 2 form columns that is 24 controls serving about 10 responses, and it doubles every row's height.
- **Reminding one person.** Each row with something outstanding carries a quiet "Remind ‹first name›" link; rows that are fully complete carry nothing, by the same conditional-and-quiet rule as the Response link. The bulk "Remind all outstanding" stays on the title row for the whole-event case. **This needs a scope that does not exist yet.** `src/routes/tasks.ts:444` `POST /events/:eventId/onboarding/remind` parses only an optional `taskIds` and calls `remindNow(db, mailer, eventId, taskIds, now, kv, baseUrl)`; its sibling `/remind/preview` (:464) calls `previewRemindNow` with the same signature. Neither takes a recipient. Add an optional `contactIds` to **both** — preview must scope identically or the review dialog will show more drafts than the send delivers — keeping the one-hour dedupe window and the 100-contact cap, and returning the same `{sent, skipped, remaining}` shape so one result-reporting helper serves both paths. Until then an organiser's only option is to mail everyone, which is why the build had no per-person control to render.
- **The response modal has exactly one action: *Reopen this task*.** It PATCHes `/task-assignments/:id` back to `pending` — the same call the grid cells make, optimistic with loud rollback, and the open modal and the grid row must agree. That is enough on its own: reminders target whatever is outstanding, so the task re-enters the chase loop automatically. The modal says so beside the button. There is deliberately no *Mark complete* here — the modal is only reachable from the Response link, which only appears on completed cells, so a complete action would be permanently dead. Marking complete happens by clicking the status cell in the grid.

  An earlier draft of this design said *"Ask for more"*, which implied sending the speaker a reason. Nothing supports that: `buildReminderMessage(eventName, timezone, assignments, portalLink)` renders from the assignments alone and takes no custom body, and task assignments have no note field (`notes` lives on contacts; the only note feed is the pipeline's). If you want a real "here's what's missing" message, that is a schema change — a note column on `task_assignment` plus a `buildReminderMessage` parameter — not a button. Note also that `ResponseModal` is currently a read-only viewer, so even this one action is new work.
- **Many tasks scroll sideways.** The grid keeps its column-per-task shape and scrolls horizontally below ~1060px of content rather than compressing headers into wrapped stacks. Real events run 7+ tasks; the seed's five is not the ceiling.
- **Row identity is one line**: "Company · has account". Email belongs in the contact drawer — in the grid it wraps to two or three lines and doubles every row.

## Content — required implementation

**Two screens, not one.** `/admin/content` is the worklist: every session needing a decision, nothing speaker-specific. One session's deliverables, versions and notes live on their own route, `/content/:submissionId`, opened from a row. An earlier draft of this design showed both in one frame, which made a list page look like it belonged to one speaker.

**"Ask for changes" must send an email, and today nothing does.** `POST /submissions/:id/content-status` (`src/routes/files.ts:194`) accepts only `{contentStatus}` and flips a column; `POST /files/:fileId/comments` inserts a row and returns. Neither touches the mailer. As built, a speaker learns their deliverable was rejected only if they happen to open the portal — so the design specifies a notification that does not exist yet:

- On `changes_requested`, email the submission's speakers with the note body, the session title, and a portal link. Route it through the existing `Mailer` port and log it like every other send, so it appears in Comms history.
- Decide whether `approved` also notifies. The design assumes **not** — an approval needs no action from the speaker, and a silent approval is not a trap the way a silent rejection is.
- A plain *Send note only* should notify too, or the thread is a message nobody is told about.

Until that exists, the "emails the speaker" copy in these frames describes intent, not behaviour. **Do not ship the flip without the send.**

**The worklist row offers only *Approve* and *Open*.** Approving needs no reason, so it can fire from the row. Asking for changes always carries a note, so it cannot — it lives on the session screen beside the composer, and the row's second control just opens that screen. Desktop and phone rows are identical in this.

**Two composer actions, one distinction:** *Ask for changes* emails the note **and** sets `changes_requested`; *Send note only* emails the note and leaves the status alone — for a clarifying question that isn't a rejection ("can you confirm the font sizes?"). Both post to the same thread; only the first moves the session out of the queue.

## Content — supporting rules

**One deliverable at a time.** A submission can carry several deliverables — slides, a recording, a workshop pack — and each is a separate version chain with its own comment thread. The detail panel therefore names the session in its heading, offers a chip per deliverable ("Slides · 3 versions", "Recording · 1 version"), and scopes both the version list and the note thread to the selected one: "Versions and notes below are for the selected deliverable". A heading like "Files for ‹session›" over a single chain is wrong — it promises every file and shows one thread with no way to tell which.

The thread is titled after the deliverable, not after a speaker: per DEC-573 it belongs to the version *chain*, and a session can have several speakers. Posting a comment **sends no email** — `POST /files/:fileId/comments` inserts a row and returns, with no mailer in that path — so the composer says "the speaker sees it in their portal", never "emailed to". If a note should notify, that is a new mailer call, not a copy change.

Comment threads are real and already built: `GET/POST /api/v1/files/:fileId/comments`, organiser or the submission's speaker, anchored to the whole version **chain** rather than one file row (DEC-573), so a reply survives a re-upload. The speaker sees the same thread in `/portal/tasks`.

## Contacts — pipeline stages

The board's columns are the five fixed stages from `src/server/repo/pipeline.ts:13` (DEC-157), in order and by their own names: **identified · contacted · interested · confirmed · declined**. They are a closed set — `isPipelineStage` rejects anything else and both `/api/v1/pipeline` write routes 400 with "must be one of …" — so the board must not invent friendlier labels. An earlier draft of this design used *Idea / Asked / Said yes / Not this year*, which dropped `interested` entirely and left two columns that no stage id maps to.

**Labels are custom fields, not a tags column.** `contact` has no `tags` — `src/server/repo/exports/contacts.ts:48` emits an empty string for it with the comment "no data-model support yet". What does exist is `customFields` (`Record<string, string>`), settable on import via `mapImportRow`'s `custom.<key>` targets and addressable in segment rules. So the directory's Labels column and the drawer's Labels row render custom-field values (`role: speaker`, `year: 2027`), and the saved segments are written in the DSL that actually evaluates:

```
custom.role is speaker
custom.year contains 2026
custom.role is reviewer
company is Independent
```

Labels render in **one keyed format everywhere** — `role speaker · year 2027` in the directory, the drawer, the phone rows and the merge screen. The key is what makes a rule writable: an organiser reading `SPEAKER · 2027` has no way to know it is `custom.role` + `custom.year`.

**The merge screen shows the two fields `mergeContacts` actually reasons about.** Labels/customFields are **combined**, not chosen (`{...duplicate.customFields, ...primary.customFields}`), and notes are **appended** — primary's kept, duplicate's added after a `\n\n---\n\n` separator when they differ (DEC-266). Both are shown in the keep column rather than as a keep/discard pair, and the footer says so: "Labels combine, notes are appended". Merge is irreversible, so the one rule that is not "pick a side" has to be visible before committing.

The rule vocabulary is fixed by `SEGMENT_STANDARD_FIELDS` — `email`, `firstName`, `lastName`, `company`, `title` — plus `any` (which fans out across all five, DEC-149) and any `custom.<key>`. `matchesSegment` **throws** on an unknown standard field rather than treating it as empty, so a segment written against a field that doesn't exist fails loudly at evaluation. Do not offer a rule builder that can express fields outside that set. An earlier draft of this design wrote segments as "Tag is speaker · status accepted" and "Tag contains 2026" — neither is expressible, and event participation and submission status are not contact fields at all.

**Every card shows its age, derived from the newest `move` in `pipeline_activity`** — "Added 6 days ago", "Replied 5 days ago", "Confirmed 3 days ago". On `contacted` it reads "No reply · N days", and past 30 days it sets in bold caps. This is deliberately **not** a sixth stage: silence is the most common outcome of outreach and nobody decides it, so it belongs on the card as age rather than as a status somebody has to set. Without it `contacted` becomes a graveyard that organisers stop reading.

**`declined` carries a reason**, because the stage conflates two opposite things: "They declined · no capacity" versus "We passed · off-topic". Same column, completely different follow-up next year.

**The board is five columns and scrolls sideways** below 1000px rather than compressing — it was laid out for four before the stages were corrected.

**Fit score and rationale are NEW columns — they do not exist.** `pipeline_entry` is `{orgId, contactId, stage, …}` and `enrollContact(db, orgId, contactId, stage, {userId, name})` takes neither; `pipeline_activity` stores only `fromStage`/`toStage`. The design adds two nullable columns, `fit_score` (integer 1–5) and `rationale` (short text), set in the enroll dialog and editable after.

They answer a question stage cannot: stage says how far along someone is, fit says how much you want them. Two people can sit in `contacted` for six weeks with completely different worth in chasing. Every card therefore shows `Fit 5` (olive, same family as the review scorecard's score pills) or a dashed **Unrated** — unrated must stay visible, or an organiser reads absence as a low score. Fit ranks people **within** a column; it never reorders stages.

The enroll dialog sets stage (the five chips), fit (1–5, optional), and a one-line "Why them" shown on the card, and states the two things that surprise people: adding writes a move to the activity feed, and no email is sent.

Moving a card writes a `move` activity; notes write a `note` activity to the same append-only feed (`pipeline_activity`). Neither sends email — the module comment is explicit that pipeline moves and notes never touch the mailer.

## Embeds — saved, not stateless

`EmbedsPanel.tsx` is a **stateless builder** today: every knob (surface, format, track, day, limit, fields, accent) maps onto `buildEmbedUrl`/`buildSnippet` query params and is lost on reload. The design adds the lifecycle around it, in Settings → Public pages and embeds, below the existing surface rows.

- **Saved embeds list** — one named row each, reusing the `PublicPagesPanel` row shape: name + recipe ("Sessions · iframe · AI Engineering · 6 fields"), where it is in use, an **On/Off** state pill in the same live/muted tones `stateTone` already produces, and two actions: *Get code* and *Turn on/off*. The section caption states the consequence — "Turning one off breaks it wherever it is pasted" — because an embed is live HTML on somebody else's site.
- **The builder becomes an editor of one saved embed.** Same knobs, plus a **Name** field, headed "Editing · ‹name›". Its primary action is *Save changes*, not *Copy snippet* — copying is secondary once the embed persists.
- **The saved embed's URL carries its name** (`?embed=ai-track`), which is the point of saving: editing filters later updates every page it is pasted on. A stateless snippet freezes its filters at copy time.
- Phone gets the list, the On/Off toggle and *Get code*; editing filters says "easier on a laptop".

**New work:** there is no embed table. This needs a persisted row per embed (org/event, name, surface, format, params, enabled) and a resolver so `?embed=<slug>` expands to the stored params at request time. `enabled: false` should return an empty 200 rather than a 404 — a disabled embed is an intentional blank, not a broken page.

## Speakers — participation status

`participant.invite_status` (`src/db/schema.ts:274`, default `"none"`) is organiser-set and today read-only in the admin, surfacing only as a chip on submission detail. The roster row now carries it as a control under the speaker's name — **Not invited / Invited / Confirmed / Declined** — with a caret, because it is a menu moving between named states rather than the two-state toggle the task cells use.

It deliberately reuses the DEC-730 control shapes (filled olive = confirmed, outlined = invited, ink-outlined caps = declined, dashed = not invited) so the grid has one visual vocabulary, but it sits in the **identity column**, not among the task cells: the task cells are speaker-driven and toggle on click; this one is organiser-driven and opens a menu. The filter row gains **Any participation ▾** beside the existing task filters, and the old "Any status" is relabelled "Any task status" — with two status axes on one screen, an unqualified "status" is ambiguous.

## Contacts — filter rules

The backend supports AND-composed `SegmentRule` sets (`{field, op, value}`, DEC-149) but the UI builder was removed in the DirectoryRail redesign, leaving only company-rail clicks and saved segments. The design restores it as a **rules row directly under the tab row**, so it composes with the search box and Segment control already there rather than replacing them:

```
Matching all of   [company ▾][is ▾][Latticework Systems][Remove]   [custom.role ▾][is ▾][speaker][Remove]   Add a rule        41 of 318 match   Save as a segment
```

"Matching all of" states the AND without a boolean control. The match count sits at the end of the row, next to *Save as a segment* — the one moment a rule set becomes durable. A company-rail click writes its rule into this same row, so the drill-through and the builder are visibly one mechanism. Field options are bounded by `SEGMENT_STANDARD_FIELDS` + `custom.<key>` (see below). On phone, each rule is a removable chip with a dashed **+ Rule** at the end.

## Review — the queue is scoped to a plan

A reviewer can be assigned to several plans, so a bare "11 left to score" doesn't say which. The queue is headed **Review · Wave 2** over the count, with "AI Engineering deep pass · closes in 19 days" beneath, and the scorecard's back link reads *‹ Wave 2 queue* rather than *‹ Queue*. The scorecard's own eyebrow names the round too (`Wave 2 · AI Engineering · round 1`), since `criteriaForRound` means the criteria a reviewer sees depend on it.

## Review — assignment tooling

The plan editor's "Who reviews what" section gains a **cap per reviewer** field and a **Distribute the unassigned** action, sitting above the reviewer list. Distribution is **preview-then-confirm**, never a silent write: the preview names each reviewer, their track, and the change ("6 → 8 talks"), states the total ("This would assign 22 reviews"), and marks itself "Nothing is saved until you confirm".

The preview must also state what it **cannot** do — "14 reviews stay unassigned — the cap is reached and nobody else covers AI Engineering". An auto-distribute that silently under-fills is worse than none, because the organiser believes the round is staffed. Reviewers already outside the track are listed as "unchanged · wrong track" rather than hidden, so the reason is visible.

## Speakers — where the portal invite lives

The roster has no drawer, so a per-speaker "Send portal invite" has no obvious home. It lives on the **participation control's own menu**, because sending an invite *is* the Not invited → Invited transition — a separate button would be a second way to do one thing. The menu reads: Not invited (current) · **Send portal invite** (emails a claim link and sets this to Invited) · Confirmed · Declined, with the footer "Only 'Invited' sends anything — the other two just record what you already know". Rows sitting at "Not invited" also carry an inline *Send portal invite* link, so the common case needs no menu.

## Public — the password CTA has three states, and that is a security rule

This CTA already exists (`submit-views.tsx:304`) and is governed by **DEC-098**: the on-screen claim link is only safe when the contact was created by *this* request. Anyone can type a known speaker's email into a public form, so rendering that contact's claim URL would hand over their portal. The design draws all three states as separate frames, because they differ in what may appear on screen — not in tone:

| State | On screen |
|---|---|
| `fresh` — contact created by this submit | **Create a password** button, linking the claim path |
| `pending-existing-contact` — email already in the CRM | **No claim URL in the HTML at all.** "We emailed … a link to set a password", plus a *Log in* fallback |
| `has-account` — a user already exists | **Log in to track it**; no claim path minted |

Copy follows the mechanism: it is *set a password* on an emailed claim link, never "create an account" — there is no public signup route. The benefit stated is the one that is true, "track this talk without waiting for the email". An earlier draft of this design also promised that an account would let you "submit again without retyping your details"; nothing pre-fills a submission for an authenticated submitter, so it was cut.

Nothing about this appears on the form itself. Submitting needs no account, that promise is already in the lede, and a signup affordance beside the submit button competes with the one action that matters.

## Public agenda — desktop

There was no desktop frame for this page, so the build scaled up the admin's room-lane × time-gutter grid. That idiom is built for organiser density and collapses at public density: the day rendered three times, the time gutter was a sparse beige column that anchored to nothing, and full-width room lanes held one or two sessions each.

**The published programme is a sequence, not a matrix.** ≤10 sessions a day over 1–4 rooms, some days one room. So the desktop agenda is **one row per start time**, not one lane per room:

- **88px time column**, then the sessions that start at that time, laid out `repeat(auto-fit, minmax(228px, 1fr))`. One session takes the full 712px measure; two split it; three sit at ~228px; four wrap 2×2. No hand-tuned cases and no empty lanes — the sparse day is the *default* case rather than a degradation.
- **Room is a label on the block**, not a column header. With four rooms and eight sessions, lanes spend most of their pixels on nothing; a label costs one line and only appears where a session exists.
- **The day appears once**, as the `<h1>` ("Tuesday 12 May · 8 sessions · 9:00 to 17:30"). The filter bar's day control is the switcher — one day at a time, since ten sessions is a page, not a scroll. That removes two of the three day repetitions on its own.
- **Time appears only where something starts**, beside the block rather than in a tick gutter. Breaks are a spanning quiet rule with their label in small caps ("Lunch · Foyer") — real programmes have them, and they explain gaps that would otherwise read as missing data.
- **A block carries** room, title (linking to session detail), speaker, then track and format as chips, plus Save/Saved. No clash indicators: clashes are an organiser concept.
- **Rail**: saved count + `.ics`, rooms in use today (each filtering the day to one room), and a printable programme.

## Public filter bar — one idiom, four surfaces

Sessions, agenda and speakers share one bar, built for the **820px content column** of the 1180 pair layout. The resting state is deliberately quiet: **one row, search at the head, everything else a compact select of the same type.**

```
Sessions   [Search sessions or speakers…] [All days ▾] [All tracks ▾] [All formats ▾] [All rooms ▾]
Agenda     [Search this day…]             [All tracks ▾] [All formats ▾] [All rooms ▾]
Speakers   [Search speakers…]             [All tracks ▾]                    [List | Grid]
```

Two earlier versions of this bar were rejected for clutter, and the reasons are worth keeping:

- **No pill rows.** Tracks were pills on their own row on the theory that the high-traffic facet deserves prominence. Pills for one facet plus selects for two others is two visual languages for one job, and the pill row is what forced a second row. Four selects read as one control group; one pill row plus two selects reads as five things.
- **Day is navigation on the agenda, not a filter.** The agenda shows one day at a time, so its day switcher belongs on the heading row opposite the `<h1>` — `Tuesday 12 May · 9 sessions · 4 rooms` on the left, `Tue 12 | Wed 13 | Thu 14` on the right. On Sessions the same facet *is* a filter (the page lists all days), so there it is an `All days ▾` select in the bar. Same data, different role, different placement.
- **Active filters appear only when set**, as a second line: a count, one removable chip per active filter, and *Clear*. Nothing is spent on that line at rest, and the count answers the question filtering raises ("12 of 41 sessions").

**A list filters; a schedule highlights.** Sessions and Agenda share the bar's *shape* but not its contents, because the surfaces answer different questions:

| | Sessions (a list) | Agenda (a day schedule) |
|---|---|---|
| Search | yes | yes, scoped to the day |
| Day | `All days ▾` filter | segmented control on the heading row — navigation, not a filter |
| Track | `All tracks ▾` filter | **`Highlight a track ▾`** — dims the rest, removes nothing |
| Format | `All formats ▾` filter | — |
| Room | `All rooms ▾` filter | — |

Filtering a list removes rows and the list closes up. Filtering a schedule punches holes in the one thing the schedule is for: showing what runs *concurrently*. An attendee following the AI track still needs to see what they're giving up at 10:00 — so on the agenda, track dims rather than removes.

**What highlighting looks like** (second agenda frame): the matching blocks keep full-weight ink and gain a 3px olive left edge, with their track chip inverted to filled olive; every other block recedes to a lighter card, lighter border and muted ink. Two rules matter here — **the grid never reflows**, so 10:00 still shows both concurrent sessions in place, and **the Save action is never dimmed**, because the reason non-matching sessions stay on screen is that you might still take one. The rail's "Rooms in use today" becomes "3 in AI Engineering", and the control shows the active value with a *Clear* beside it.

Room and format are dropped from the agenda entirely. The agenda's columns already **are** rooms, so a room filter is just reading a column; and filtering a day to one format leaves a grid of gaps. Both remain full filters on Sessions, which is where the eval probes them.

## Changed since the previous handoff

1. **A width system, and every route redrawn at 1600px.** Frames were 1240 — a drawing width, below the caps, so the rule was invisible. Four container classes now: reading 820, reading + rail (Settings 820 centred with the rail in the left margin, public sessions 1180 as a pair), table 1440, canvas uncapped. See "Widths" above and the 1800px exemplar in `01-overview.png`.
2. **Only the agenda grid is a canvas.** The speaker matrix and pipeline board look like canvases but their columns are bounded — by the task list and the five fixed stages — so both sit at the table measure and scroll below their minimums. The test is whether the column *count* can grow.
3. **Editors are reading class.** The CFP form builder and Comms templates lay fields out in rows with headers, which reads as tabular, but you compose one thing rather than scanning many. Both at 820, tracks retuned.
4. **Speakers: one page, two views.** The separate gallery frame is gone. A quiet List / Grid toggle sits beside the search; Grid is the photo-led rendering. `/e/:slug/gallery` stays as the URL the Grid segment links to, so the direct path probe, the EMB-12/13 photo-grid and card→detail flow, and the embed builder's gallery surface all keep working. The separate Gallery nav link is dropped.
5. **Merge rebuilt.** Both records are named in the column heads — "Keeping · Marcus Okafor · added 14 Mar" against "Discarding · Marcus O. · added 2 Aug" — where before one column held an instruction and the other a name. Combine rules sit in a block above the actions; the primary button names its target and *Swap which is kept* sits beside it.
6. **Merge fields are a dropdown.** Six bordered chips under the body field read as six competing buttons. One `Insert a field ▾` control, with the open state listing each token beside a sample value.
7. **Submission detail capped** at 1180 — it was the one route the width pass missed.
8. **Markup repairs:** three malformed style declarations (`flex-direction:column gap:6px` and similar) where a missing semicolon voided the rule and collapsed a column into a row; a `width:16000px` frame; and a doubled cap injection that produced `padding:th:1440px`.
9. **The before-state file was deleted** at the user's request, with its screenshot and README rows.

## What the round before that added

Eight additions, in plain terms. Each has its own section above with the code-level detail.

1. **Saved embeds** (Settings). Embeds were a builder you copied from and lost. Now each one is a saved, named thing in a list, with an On/Off switch and a "Get code" button; the builder becomes an editor for one of them. The embed's URL carries its name, so changing its filters later updates every website it is pasted on. *Needs a new table and a `?embed=<slug>` resolver.*

2. **Participation status** (Speakers). Each roster row gets a menu under the speaker's name — Not invited / Invited / Confirmed / Declined. The organiser sets this one; the task cells beside it are speaker-driven. The filter bar gained "Any participation", and the old "Any status" became "Any task status" so the two aren't confused.

3. **Send portal invite** (Speakers). It lives inside that same menu, because sending an invite *is* the Not invited → Invited move. Rows already at "Not invited" also carry an inline link, so the common case skips the menu.

4. **Filter rules** (Contacts). A row of stackable rules under the tabs — `company is Latticework` + `role is speaker` — with "Matching all of" in front and a live match count at the end. Clicking a company in the sidebar writes a rule into the same row, so the drill-through and the builder are one mechanism.

5. **Pipeline fit score** (Contacts). Each card shows "Fit 5" or a dashed "Unrated", plus a one-line reason. Stage says how far along someone is; fit says how much you want them — two people can sit in `contacted` for six weeks and be worth chasing very differently. Set when you add someone. *Needs two new columns on `pipeline_entry`.*

6. **Assignment tooling** (Review). A cap-per-reviewer field and a "Distribute the unassigned" action in the plan editor. It previews before it writes — naming each reviewer's change, the total, and, critically, what it could **not** do ("14 reviews stay unassigned — the cap is reached and nobody else covers AI Engineering"). A distribute that silently under-fills is worse than none.

7. **Scoped reviewer queue** (Review). The queue and scorecard name which wave you are in, so a reviewer working two plans can tell them apart.

8. **Password CTA, three states** (Public). The confirmation screen's "set a password" link only appears when this submission created the contact; when the email is already in the CRM, no claim URL may appear on screen at all. That is a takeover defence, not a copy variant.

## Widths — three container classes

The mock frames are 1240px, which is a drawing width, not a monitor. In production the page is the browser, so every screen needs a stated rule. There are three, and the class is a property of the **content**, not the route. Shown at 1800px in `01-overview.png`.

| Class | Max width | Screens |
|---|---|---|
| Reading measure | **820px**, centred | Overview, session detail, the CFP form and its confirmations, login |
| Reading + rail | **820px content, centred on the page** — the rail hangs in the left margin | Settings |
| Reading + rail | **1180px** (820 content + 34 gap + 300 rail) | Public sessions |
| Table measure | **1440px**, centred | Submissions list, Contacts directory and pipeline board, Content worklist and files, Review plans and results, Comms compose, Speakers matrix |
| Canvas | **none** | Agenda grid |

**Chrome is always full bleed.** The header rule, the toolbar rules and section rules run edge to edge; only the content inside them is constrained. A centred card floating on a wide background would be a different design language from the one this set uses everywhere else.

**A rail does not widen the measure, and it does not move it either.** Settings pairs the reading measure with a navigation rail, and the measure stays centred on the page while the rail hangs in the left margin — `grid-template-columns: minmax(196px, 1fr) minmax(0, 820px) minmax(0, 1fr)`, rail `justify-self:end`. Centring the rail *and* content as one block pushes the thing you are reading off-centre by half the rail's width. Below about 1200 the gutter track hits its 196px minimum and the layout slides right, which is the correct degradation. Public sessions differs: its 300px rail is content, not navigation, so there the pair is centred together at 1180.

**An editor is reading class, whatever its rows look like.** The CFP form builder and the Comms template editor both lay their fields out in rows with a header, which makes them look tabular — but you are editing one thing at a time, not scanning many, so both sit at 820. The test is what the screen is *for*: scanning many records is table class, composing one is reading class.

**Why 820 for reading:** a 60–75 character measure does not get better at 1800px, and Overview is prose plus single decisions. The gutters are the design.

**Why cap tables at 1440:** tables genuinely want width, but past about 1440 the eye loses the row between the title on the left and the action on the right. On a 2560px monitor an uncapped table is worse than a capped one, not better — the remedy for a cramped table is fewer columns or a wider gap, never more monitor.

**Only the agenda grid is a canvas.** Its column count is the event's room count, which an organiser can add to, so width genuinely buys columns and a cap would force scrolling on a monitor that had the room.

**The speaker matrix and the pipeline board look like canvases and are not.** Their columns are bounded — by the event's task list, and by the five fixed pipeline stages — so past a certain width they stop gaining and merely spread. Both sit at the table measure and scroll horizontally below their own minimum (`min-width:1060px` for the matrix, `1000px` for the board). At 1440 that is roughly 178px per task column and 262px per stage, both comfortable. The test for canvas class is not "is it a grid" but "can the number of columns grow".

Below 1240 everything degrades the same way: the reading measure keeps its padding and shrinks, table measures reach their own minimum and scroll horizontally within the content area, and at 720 and under the phone layouts in these files take over.

## Public gallery — kept, but flagged

`/e/:slug/gallery` is built: `GalleryContent` in `src/routes/public/speakers.tsx`, a case in `dispatch.tsx`, membership in `SURFACES`, its own `.chq-pub-gallery-grid` CSS, and a row in the settings surface counts. Per **DEC-593** it is "the speakers directory's photo-led twin" — the same `SpeakerCard`, rendered with `showSessions={false}`, plus its own `?q=` name search.

The design therefore does **not** draw it as a separate frame: a tile strip beside the speaker cards showed the same six people twice. The speakers frame carries one line pointing at it instead. If the team wants to retire the surface, that is a product decision touching a route, a component, a decision record and CSS — not a mock change.

## Rulings on unframed capabilities

`DESIGN-RULINGS.md` in this folder rules on every item in the 2026-08-14 audit brief — 28 extensions and 10 uncovered surfaces — as **BLESS** (deliberate as built), **RESTYLE** (keep it, redraw it, spec given) or **DROP**. Read it alongside these frames: together they make "matches a frame or a recorded ruling" a closed test.

It also carries two specs that close whole classes rather than single screens: the **interaction-states standard** (hover / selected / expanded / focus / disabled, and the rule that a state band inherits its parent's column grid) and **Settings edit views on desktop** (field widths against content, paired fields two-up, form footers as right-flushed rows rather than phone action bars). Both were drawn from defects the audit found repeatedly.

Every frame the rulings called for is now drawn — including a new `Chautauqua Emails.dc.html` for the transactional email shell. Also framed in this pass: Content bulk-approve, the sign-in card redraw, the Comms evaluation-plan select, and the bulk-email template select. Frames still owed are listed at the end of that document in leverage order.

## Copy rules

These were the most-revised part of the design. Hold them:

1. **No explanatory clauses in chrome.** Counts, status and nouns. "5 need a decision · 2 re-uploaded", not "5 sessions need a decision, and 2 were uploaded again after you asked for changes".
2. **Never promise time.** No "takes about ten minutes", no delivery windows, no notification schedule — the product doesn't know.
3. **Never assert what no endpoint stores.** Cut during review: "published 4 minutes ago" (`agenda/publish` returns a count only), a scheduled-send countdown (Comms sends immediately), an agenda lock date, an email subject line, "check spam in ten minutes", a notify-me-next-year signup.
4. **Say the constraint you need before acting**, and only that: "Skips anyone reminded in the last hour", "Kept across pages · sent in batches of 100", "Clashes are flagged, not blocked", "Mean of submitted reviews · recusals excluded".
5. **Plain section names** from the app's own vocabulary — "Submissions awaiting triage", not "Waiting on your call".
6. **Sentences are for people, not chrome** — reviewer comments, abstracts and bios keep their full length.
7. **No feature is desktop-only.** Where a laptop is genuinely easier, say it as a preference ("Better on a laptop"), never as a wall.

## Data figures used across the mocks

One meaning each, consistent across all files: 47 submissions · 23 accepted submissions · **12 accepted speakers** (one speaker can hold several accepted talks) · 6 unplaced · 17 placed (74%) · 2 clashes · 318 contacts · 8 CFP questions (3 built-in + Track + 4 custom) · 3 tracks · 4 rooms. Names and titles come from `docs/fixtures/sample-data.json`.

## Open decisions

**DEC-382 vs. the home page.** `src/routes/tools.css.ts` records that the three operator surfaces (`GET /`, `/docs/api`, `/dev/mailbox`) "are chrome, not designed screens" sharing one `TOOLS_CSS` module. This bundle designs `GET /` as a real public surface, which revises that decision for `/` only — `/docs/api` and `/dev/mailbox` stay chrome — including under the new `/docs` site, which links out to the API reference as a leaving link rather than absorbing it. The home page should draw on the public CSS family (`public.css.ts`), not `TOOLS_CSS`.

**`GET /` is an anonymous event hub, and needs more data than it reads today.** Decisions taken: one org per deployment, so the hub is simply "our events"; a signed-in organiser or reviewer **redirects to `/admin`** and a speaker to `/portal`, so this page only ever renders for anonymous visitors — all of which is new work. `GET /` does not read `c.var.auth` today; it renders the same landing page for everyone. The redirects that already exist are on `/admin` (anonymous → `/login`, speaker → `/portal`) and do not fire on `/`; and it lists **only events with an open CFP or a published programme** — never an unannounced future event, since `/` has no auth.

The route currently calls only `getFirstEventSlug()`. It now needs a list of the org's events with, per event: name, slug, dates, location, the default form's window via `formWindowState(openDate, closeDate, now, timezone)`, and a published-session count. Rows carry public-safe facts only — dates, venue, CFP deadline, session count. Deliberately excluded: submission counts, review progress and speaker-task health, which are internal and would leak an event's health to anyone.

Listed: an event whose CFP is open (`formWindowState` → `open`), or one with published sessions. Hidden: `not_yet_open` CFPs (announcing a date you have not announced), events with no published sessions (a link to an empty page), and the gap between a CFP closing and a programme going up. The test for any new field is one question — would you mind a competitor reading it?

Kept off every row deliberately: submission count, review progress, speaker-task health, acceptance rate, last activity. Each describes how well an event is *going* rather than what a visitor can *do*, and a thin CFP or a stalled review wave is the organiser's business.

"Published programme" stays true after an event ends, so a finished event would sit at the top of a flat list forever. Rows are therefore grouped **Open for submissions / Programme published / Already happened**, which fixes that and matches what a visitor arrived to find out. Within a group: soonest deadline first, then soonest event; past events newest first.

**Every state is drawn at both widths.** Desktop lays an event out as a three-column row — dates, name and state, action. Phone stacks the same fields into a card with a full-width button. Both keep all three groups on screen; a chip strip that showed one group at a time was tried and rejected, because each group holds one to three rows and filtering left the phone showing fewer events than the desktop.

**Three states, not two.** A published programme stays published, so once an org has run a single event the hub always has something to show:

1. **Full hub** — an open CFP, an upcoming published programme, and an archive.
2. **Between cycles** — no open CFP and nothing upcoming, but past programmes are still up. The archive *leads* the page rather than sitting at the bottom under two empty headings.
3. **Fresh deploy** — nothing has ever been published. This is the only genuinely empty state, and the only one that shows just a sign-in.

The masthead carries the **org's** name, not the product's — matching the public event pages, which lead with the event name. Chautauqua is named once, in the footer, as a GitHub attribution link; that is the only place the product appears on a customer-facing surface. The design file carries a "Rules you can't see on the page" panel alongside the frames with the same reasoning.

**Dates are not reconciled with the seed — do not treat them as fixture-accurate.** The mocks show the CFP closing 16 August; `scripts/seed.ts` seeds `close_date: Date.UTC(2027, 2, 1, 23, 59)` — **1 March 2027** — corroborated by the comment in `src/lib/submit-core.ts`. The seeded form has no `open_date` (so it opens immediately), and the form's `description` is `"Default CFP form for DevFlow Conf 2027"`, an internal label rather than public intro copy. Two further consequences, unresolved at time of writing:

- The deadline strip's "Doors open" and "Review wave 2" values derive from an implied "today" that the seed does not support. Recompute both from whichever "today" you adopt: doors are `event.startDate` = 12 May 2027, and the seeded evaluation plan closes `Date.UTC(2027, 4, 20)` = 20 May 2027.
- **Under the seed, "CFP closes in 6 days" and "3 speaker tasks overdue" cannot both be true.** Every seeded task is due between 1 April and 1 May 2027, all after the 1 March close. Overview currently shows both. Pick a single "today" and let every countdown and status follow it — mid-April 2027 keeps the overdue worklist and closes the CFP; late February keeps the CFP open and empties the overdue section.

The screens are correct as *design*; the numbers on them are illustrative until that one decision is made.

## Screenshots

`screens/` holds one full-canvas capture per file, showing every frame in that file side by side:

| File | Shows |
|---|---|
| `01-overview.png` | Overview desktop + phone, New event modal |
| `14-docs.png` | Docs — index, article, phone article, element library, screenshot rules |
| `12-home.png` | Home — three states at both widths, plus the design-notes panel |
| `02-submissions.png` | Table, submission detail (desktop + phone), form builder (desktop + phone), 2 modals |
| `03-review.png` | Organiser view, reviewer scorecard, reviewer queue, plan editor (desktop + phone), criteria frozen, new plan |
| `04-speakers.png` | Onboarding grid + phone, roster phone, New task and Task response modals |
| `05-content.png` | Worklist + deliverable detail, phone list, files library (desktop + phone) |
| `06-agenda.png` | Day grid, phone tap-to-place |
| `07-comms.png` | Also carries the four rendered emails and the six email rules. |
| `07-comms.png` | Compose step 3, templates (desktop + phone), send history phone |
| `08-contacts.png` | Directory, drawer, import, pipeline, merge — each desktop + phone — and 2 modals |
| `09-settings.png` | All 7 desktop sections, 7 phone subscreens |
| `10-public-and-portal.png` | 5 public surfaces, CFP form + confirmation + closed, portal home and 5 sub-routes |
| `11-account.png` | Login, change password, not-found (desktop + phone) |

**Phone frames are captured at full content height, not at 844px.** The design files render each phone frame as a fixed 390 × 844 device with an internally scrolling body; for these exports that body is expanded so nothing is cut off. A capture taller than 844px is therefore showing scrolled content, not a screen that fits — treat 844 as the fold line.

Captures are of the design canvas, so each frame carries its title label and, where relevant, a note about intent. Measurements in this README are authoritative over the images.

## Assets

One: the **GitHub mark** in the home page footer attribution (14px, `fill="currentColor"`, official 16×16 mark path) — the single icon in the whole set, and the only SVG. Everything else: no icons, no images, no SVG. Status dots are `border-radius:50%` divs; drag affordances are the `⋮⋮` character. Image placeholders are `repeating-linear-gradient(135deg, #E1DDCE 0 6px, #D8D3C2 6px 12px)` with a 10px monospace label naming the drop ("headshot", "speaker headshot") — replace with real headshots from R2.

Fonts: `https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&family=Figtree:wght@400;500;600;700;800&display=swap`. Self-host to avoid a third-party request from the Worker.

## Accessibility

Every text/background pair in the bundle passes WCAG AA. The muted floor is `#565A4B` on paper and `#B5AFA2` on ink — anything lighter failed and was raised during review. Type floor 10px, tap targets 44px. Meaning is never carried by colour alone: lateness is weight and wording, the discarded merge value is struck through, agenda states use fill/outline plus a caption.

## Suggested order

1. Tokens and the shell (header, nav, section pattern) in `styles.css`.
2. Overview — it is the biggest behavioural change and proves the row pattern.
3. Submissions (table + detail + form builder) — highest-traffic admin screen.
4. Speakers, Content, Comms, Contacts, Review, Settings.
5. Agenda desktop, then the phone tap-to-place flow.
6. Public surfaces and the portal (server-rendered, so a separate styling pass).
7. Login, password, not-found.
