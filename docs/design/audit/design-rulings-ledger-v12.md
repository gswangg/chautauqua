# DESIGN-RULINGS.md ruling-unit gap audit (DEC-582 wave-31)

`test/design-rulings-ledger.scan.test.ts` was graded at HEADING granularity
only (45 `## `/`### ` headings, one citation each). `### B8 — Interaction-states
standard` alone spans ~85 lines under a single honored citation — DEC-100's
"a coverage cap is not an identity" at file scope.

This wave widens the derived population from headings to **ruling units**:
every top-level `- ` bullet, every top-level `\d+. ` numbered item, and
every top-level `**`-led bold paragraph, keyed `<heading-slug>::<n>`
(document order, 1-based per heading), re-derived at test time from the
live file. Measured: **137 ruling units** (67 bullets + 44 numbered items +
26 bold-led paragraphs — matches the file's own literal counts).

Every one of the 137 was, at wave 31, graded **gap**: DESIGN-RULINGS.md's
bullets/numbered items/bold paragraphs are design *rationale* — an
argument for a decision, a cross-reference to another section, a legend
entry, a sub-rule inside a larger spec — not, on their own, a standalone
claim with a single code artifact to cite. Reusing a parent heading's own
honored citation for one of its child units would be exactly the borrowed
citation DEC-582's own ledger prose forbids ("recorded, never omitted,
never faked with a borrowed citation").

**7 of the 137 are now honored, each by an artifact its own words name**
(DEC-582 wave-34 amendment: a unit is honored only by an artifact its OWN
words name, never by borrowing its parent heading's citation) -- each is
graded "honored" in `test/design-rulings-ledger.scan.test.ts`'s
`UNIT_LEDGER`. See "Drained units (wave 34)" below for the full artifact
list; branch provenance for this drain is recorded on DEC-582 itself
(wave-40 amendment), not here. `RULING_UNIT_GAP_CEILING` moved `137` -> `130`
(two-sided ratchet, `test/design-rulings-ledger.scan.test.ts`), measured
by forcing the constant to `-1` and reading the failing assertion's count
back, per the ratchet's own instructions -- never computed by arithmetic
on the source counts. Still registered in `scripts/exit-predicate.ts`'s
`OUT_OF_CAMPAIGN_SCOPE` — the same disposition already given to
`FRAME_EYEBROW_DIVERGENCE_CEILING` and `PACK_UNIT_GRAMMAR_OFFENDERS_CEILING`:
a newly-derived population no instrument previously graded must not move
the campaign's goalposts mid-convergence. Draining the remaining 130 —
finding a genuine 1:1 artifact for a specific unit and re-grading it
"honored" — is real, narrow work for a later wave. This document exists
so that wave can **drain** the list below rather than re-derive it.

### Drained units (wave 34)

| key | artifact | test |
| --- | --- | --- |
| `review-criteria-scale-or-choice::5` | `app/src/pages/review/Scorecard.tsx` (`recorded, not averaged`) | `app/src/pages/Review.frame-verdicts.render.test.tsx` |
| `review-criteria-scale-or-choice::6` | `app/src/pages/review/Scorecard.tsx` (`chq-review-choice-group` radiogroup) | `app/src/pages/review/Scorecard.render.test.tsx` |
| `review-criteria-scale-or-choice::8` | `src/server/repo/review/plans.ts` (`planHasEvaluations` predicate) | `test/plan-criteria-guard.test.ts` |
| `password-reset::2` | `src/routes/auth-views.tsx` ("We will email you a link to set a new one.") | `test/password-reset-flow.test.ts` |
| `password-reset::3` | `src/routes/auth-views.tsx` ("If that address has an account, a reset link is on its way.") | `test/password-reset-flow.test.ts` |
| `password-reset::4` | `src/routes/auth-views.tsx` ("Signing in as {props.email}.") | `test/desktop-frames-account.test.ts` |
| `password-reset::5` | `src/routes/auth-views.tsx` ("Send a fresh link") | `test/password-reset-flow.test.ts` |

`review-criteria-scale-or-choice::8`'s reason string cites the
`planHasEvaluations` predicate only, never the refusal-message string:
a unit's honoring artifact is the artifact its OWN words name (DEC-582
wave-34 amendment), and pinning prose a concurrently-owned lane was still
rewriting is never that artifact (DEC-582 wave-40 amendment records which
branch owned the copy). `password-reset::1` stays a gap: it is the
document's own meta-narration about its drafting history ("An earlier
draft of this document called it proposed new work"), not a claim with a
code artifact of its own.

### Drained units (wave 55)

| key | artifact | test |
| --- | --- | --- |
| `b7-empty-states::1` | `app/src/styles.css` (`.chq-empty-block-fresh { padding-top: 44px; }`) | `app/src/components/EmptyState.render.test.tsx` |
| `b7-empty-states::2` | `app/src/styles.css` (`.chq-empty-block-filtered { padding-top: 30px; }`) | `app/src/components/EmptyState.render.test.tsx` |
| `b7-empty-states::4` | `app/src/components/EmptyState.tsx` (`{reason && (` — optional, rendered only when supplied) | `app/src/components/EmptyState.render.test.tsx` |
| `b7-empty-states::5` | `app/src/components/EmptyState.tsx` ("Neither variant ever renders a disabled control") | `app/src/components/EmptyState.render.test.tsx` |
| `b7-empty-states::8` | `app/src/b7-empty-table.scan.test.ts` ("a loaded, empty row set never renders as…") | `app/src/b7-empty-table.scan.test.ts` |
| `b7-empty-states::9` | `app/src/components/EmptyState.tsx` ("disabled control, an illustration, or a" [centred hero]) | `app/src/components/EmptyState.render.test.tsx` |
| `loading-the-first-paint::1` | `app/src/components/PageSkeleton.tsx` ("render nav + a bare `<h1>` over an empty `<main>`, which two…") | `app/src/components/PageSkeleton.render.test.tsx` |
| `loading-the-first-paint::3` | `app/src/components/page-skeleton.css` (`.chq-skeleton-row-table .chq-skeleton-bar-wide` varied-width rules, "a column of identical bars reads as a loading graphic, not as rows") | `app/src/components/PageSkeleton.render.test.tsx` |
| `loading-the-first-paint::5` | `app/src/components/page-skeleton.css` ("flat placeholder bars in the token palette, never a spinner/shimmer", `background: var(--chq-surface-sunk)` i.e. `#EFEBDF`) | `app/src/components/loading-first-paint.scan.test.ts` |

Two of the nine b7-empty-states units were reclassified **prose**, not
honored: `b7-empty-states::3` ("Name what is empty, not what is missing")
is a copy-writing convention spanning every call site's `what` string, no
single artifact; `b7-empty-states::6` ("Distinguish fresh from filtered
(above)") is a bare cross-reference to the two bold units, not a separate
claim. `b7-empty-states::7` ("Filtered states name the filter that did it")
stays a genuine **gap**: no artifact enforces that an escape link's label
names the exact excluding facet or that its `onClick` clears only that one
facet — that is a per-caller editorial judgment EmptyState's types cannot
see (DEC-582 wave-55, w55-f).

Every gap row, named by key, parent heading, and its own words (truncated
to ~160 chars where long):


### (preamble, before first heading)

- `preamble::1` (bullet): - **BLESS** — keep as built, recorded as deliberate. No frame needed; the ruling *is* the artifact.
- `preamble::2` (bullet): - **RESTYLE** — keep the capability, redraw it. Either a frame exists now, or the one-line spec below is the spec.
- `preamble::3` (bullet): - **DROP** — delete the capability.

### Governing principle, applied

- `governing-principle-applied::1` (bold): **Mobile reflows the desktop design; it never competes with it.** Phone frames may use phone grammar freely — action bars, sheets, stacked fields, 44px targets…
- `governing-principle-applied::2` (numbered): 1. A 390 frame keeps the desktop design's hierarchy, capabilities and tokens. It is never an independent drawing.
- `governing-principle-applied::3` (numbered): 2. Where a surface has **only** a 390 frame, the desktop state is a *missing artifact*, not an implied one. Do not scale phone anatomy up. Two surfaces were in…

### B8 — Interaction-states standard

- `b8-interaction-states-standard::1` (bullet): - **Reading an artifact is not a grid job, and neither is knowing one exists.** The per-cell *File* and *Response* links were a third path to two things already…
- `b8-interaction-states-standard::2` (bullet): - **Status tokens pair by density, not by device.** The dense variant (no padding, ~20px) is for a matrix cell that must fit a 178px column twelve times over; t…
- `b8-interaction-states-standard::3` (bullet): - **A per-selection due date is not worth its cost.** A due date lives on the `task`, not the assignment (`task_assignment` carries only `pending | complete`),…
- `b8-interaction-states-standard::4` (bullet): - **Weight goes to the exception, never to the resting state.** Complete is the majority of cells in the speakers grid — 30-odd of 42 in the seeded event — so r…
- `b8-interaction-states-standard::5` (bullet): - **Hover** on any row or nav item: `#EFEBDF` fill. No border change, no shift.
- `b8-interaction-states-standard::6` (bullet): - **Status cells that are controls** (the speakers grid) take a `0 0 0 2px #CFC7B7` ring on hover rather than a fill — they already carry their own fill or outl…
- `b8-interaction-states-standard::7` (bullet): - **Selected / active row**: `#EFEBDF` fill plus a **3px olive left edge**. The edge is what distinguishes selected from merely hovered, and it replaces 3px of…
- `b8-interaction-states-standard::8` (bullet): - **Expanded disclosure**: the band is `#FAF8F2` with a `1px #E1DDCE` top and bottom rule — a lighter surface than the row, so it reads as inside it.
- `b8-interaction-states-standard::9` (bullet): - **The rule that fixes items 27–28:** an expanded or selected band **inherits its parent's column grid**. It repeats the same `grid-template-columns`, so its c…
- `b8-interaction-states-standard::10` (bullet): - **Select carets**: `▾` always sits at the **right edge of the control** in muted ink (`#565A4B`), never as the last glyph of the label. Two control widths, on…
- `b8-interaction-states-standard::11` (bullet): - **Button hover — each tier darkens, nothing moves.** A button already carries its own surface, so it must not take the row's `#EFEBDF` fill on hover; instead…
- `b8-interaction-states-standard::12` (bullet): - **Motion — three durations, and a list of what must not animate.** This is an admin tool people use for hours, so motion exists to make a change *legible*, ne…
- `b8-interaction-states-standard::13` (bold): **Always animate the property, never `all`.** `transition: all` catches the focus ring and makes keyboard entry look laggy, and it catches layout properties you…
- `b8-interaction-states-standard::14` (bold): **Entering vs leaving.** Things enter at the durations above and leave at **half** — a closing modal at 110ms, a dismissed banner at 90ms. Waiting for an exit i…
- `b8-interaction-states-standard::15` (bold): **What must not animate, and why:**
- `b8-interaction-states-standard::16` (bullet): - **Optimistic writes.** A task cell flipping to Complete, a bulk status change, an agenda placement — these must be *instant*. The whole point of the loud-roll…
- `b8-interaction-states-standard::17` (bullet): - **Content arriving.** No stagger, no fade-in-up on table rows or cards. A submissions table that animates 25 rows on every filter change costs a triage sessio…
- `b8-interaction-states-standard::18` (bullet): - **Numbers.** Counts change by replacement, never by counting up. "19 waiting" is a fact, not an odometer.
- `b8-interaction-states-standard::19` (bullet): - **The focus ring.** Instant, always — it is the one affordance a keyboard user is tracking.
- `b8-interaction-states-standard::20` (bullet): - **Anything on a print or PDF path**, and anything behind an open modal.
- `b8-interaction-states-standard::21` (bold): **Respect the system setting.** Under `prefers-reduced-motion: reduce`, geometry animations drop to a **90ms opacity fade** and colour transitions go to `0ms` —…
- `b8-interaction-states-standard::22` (bold): **One easing family.** `ease-out` for state, `cubic-bezier(0.2, 0, 0, 1)` for geometry — both decelerate, so everything settles rather than bouncing. No spring,…
- `b8-interaction-states-standard::23` (bullet): - **Pending — the gap the hover spec does not cover.** Optimistic writes are instant, so most of this product needs no loading state at all. But four operations…
- `b8-interaction-states-standard::24` (bullet): - **Drag — the agenda grid, and reorder rows.** Two surfaces drag: agenda sessions between room/time cells, and `⋮⋮` handles on criteria, tracks, rooms and CFP…
- `b8-interaction-states-standard::25` (bullet): - **Touch has no hover.** On a touch surface the hover tint must not stick after a tap; the pressed state is the `:active` colour in the button table, and it sh…
- `b8-interaction-states-standard::26` (bullet): - **Inputs and selects.** Rest `1px #BAB6A6` on `#FAF8F2`; **hover** darkens the border to `#8E8A7A` only; **focus** takes the 2px olive outline and the border…
- `b8-interaction-states-standard::27` (bullet): - **The wordmark needs an optical nudge, and it depends on the alignment mode.** Familjen Grotesk's font box is asymmetric — at 22px it reports ascent 23 / desc…
- `b8-interaction-states-standard::28` (bullet): - **Focus**: 2px olive outline, 2px offset, on every interactive element. Never removed, never replaced by the hover treatment.
- `b8-interaction-states-standard::29` (bullet): - **Disabled**: `#8E8A7A` on a `#DDD8C8` border. It has exactly **two** legal uses: an **inert control** (a pager arrow with no page to go to, a Remove at its l…
- `b8-interaction-states-standard::30` (bullet): - **The 44px floor, and how it gets evaded.** Every interactive element on a phone is `min-height:44px` plus centred flex **plus horizontal padding** — padding…

### B7 — Empty states

- `b7-empty-states::1` (bullet): - **Fresh and empty** hides the filter chrome entirely. Offering a status filter over zero rows is noise. The block gets room (44px above) and a real primary ac…
- `b7-empty-states::2` (bullet): - **Filtered to nothing** keeps its chrome visible *above* the message, because the fix is in the chrome, and the block is tighter (30px). It has no primary but…
- `b7-empty-states::3` (numbered): 1. **Name what is empty, not what is missing.** "No submissions yet", never "No data" or "Nothing to show here". The noun tells the user which of twenty lists t…
- `b7-empty-states::4` (numbered): 2. **Give the reason only when it is actionable.** "The call for papers opens on 1 February" earns its place because it says when to come back. "The query retur…
- `b7-empty-states::5` (numbered): 3. **One action, and only a real one.** A primary button when there is a genuine next step; **no button at all** when the user cannot act — an attendee waiting…
- `b7-empty-states::6` (numbered): 4. **Distinguish fresh from filtered** (above).
- `b7-empty-states::7` (numbered): 5. **Filtered states name the filter that did it.** "Marcus Okafor is on the roster, but nothing of his is overdue" beats "no results", and the escape link clea…
- `b7-empty-states::8` (numbered): 6. **Never an empty table with headers.** Column headings over nothing read as a load failure. The message replaces the table; it does not sit under it.
- `b7-empty-states::9` (numbered): 7. **No illustration, no centred hero.** Left-aligned in the content measure, the page's own type scale. A spot illustration turns a routine Tuesday into an occ…

### B10 — Settings edit views on desktop

- `b10-settings-edit-views-on-desktop::1` (bullet): - **Field width follows content, not the column.** A date is ~180px, a name ~320, a slug ~420, a URL or intro textarea takes the full 820 measure. A 340px-tall…
- `b10-settings-edit-views-on-desktop::2` (bullet): - **Two-up where fields pair** — opens/closes, start/end, width/height — in a `1fr 1fr` grid at 16–18px gap. Never one field per row when the pair is read toget…
- `b10-settings-edit-views-on-desktop::3` (bullet): - **Section rhythm matches the read view**: `11px/700/0.12em` uppercase label over a 2px ink rule, 26px between sections, 13–15px between fields. The read and e…
- `b10-settings-edit-views-on-desktop::4` (bullet): - **Form footer is a row, right-flushed**: primary filled olive, secondary bordered to its left, tertiary destructive far left. Never a full-width olive bar wit…
- `b10-settings-edit-views-on-desktop::5` (bold): **Your data splits by mutability, not by section.** Exports are *actions* — they download at once and there is nothing to save — so they need no edit view, and…
- `b10-settings-edit-views-on-desktop::6` (bullet): - **Saved-embeds editor** keeps its code box, but the URL and Snippet readouts are `ui-monospace` at 12–13px on `#FAF8F2` inside a `#D3CFC0` rule, with Copy as…

### Error and validation states

- `error-and-validation-states::1` (bold): **Errors are set in weight and rule, never colour alone.** There is no red in this system, so an invalid field takes a **1px ink border with a 3px ink left edge…
- `error-and-validation-states::2` (bold): **Nine rules:**
- `error-and-validation-states::3` (numbered): 1. **Summarise at the top, fix in place.** A submit rejection opens with "Three things need fixing before this can be sent" and one anchor link per problem, eac…
- `error-and-validation-states::4` (numbered): 2. **Say what was kept.** "Nothing was lost. Everything you typed is still below." A submitter who has written 1,200 characters fears the reload more than the e…
- `error-and-validation-states::5` (numbered): 3. **Count against the limit, don't just flag it.** "1,412 of 1,200" in the counter and "212 characters over" in the message. A bare "too long" makes the user g…
- `error-and-validation-states::6` (numbered): 4. **Offer the way out, not just the rule.** Over-length abstract: "Cut it, or paste the long version into notes for reviewers instead" — the field that exists…
- `error-and-validation-states::7` (numbered): 5. **Say why the field matters when the cost is invisible.** Bad email on the public form: "we send your portal link here, so a typo means you never get it." Th…
- `error-and-validation-states::8` (numbered): 6. **Required means "pick one", not "required".** "Pick one — a talk needs a track so the right people review it" says what to do and why the form asks.
- `error-and-validation-states::9` (numbered): 7. **Credentials fail with one message for both causes.** "That email and password do not match" — never "no such account" or "wrong password", which between th…
- `error-and-validation-states::10` (numbered): 8. **A rolled-back optimistic write must announce itself.** `toggleCell` and `applyBulkStatus` revert on `ApiError`; a silent revert reads as the click not regi…
- `error-and-validation-states::11` (numbered): 9. **A draft never validates.** "Saving a draft skips these checks" sits beside Save draft, because a half-written abstract must always be storable — and the re…
- `error-and-validation-states::12` (numbered): 10. **Offer the partial action when one exists.** Nine bad CSV rows offer "Import the 205 good rows"; three unresolvable merge fields offer "Send to the 20 who…
- `error-and-validation-states::13` (numbered): 11. **Name what survived.** "Slides v3 is still the current file. Nothing was replaced." · "Everything else on this page is fine and is still here." A failed wr…
- `error-and-validation-states::14` (numbered): 12. **Server-only errors are not the form's fault.** A slug clash or a concurrent edit could not have been caught client-side, so the message says what happened…
- `error-and-validation-states::15` (numbered): 13. **Pre-flight the irreversible.** Sending cannot be undone, so unresolvable merge fields are caught at step 3 with a per-recipient list and a *Place on the a…

### Speaker portal — adding a co-presenter

- `speaker-portal-adding-a-co-presenter::1` (bold): **Three facts the form must state, because none is visible from the fields:**
- `speaker-portal-adding-a-co-presenter::2` (numbered): 1. **Nobody is emailed.** `addCoPresenter` writes a participant row and returns — the route comment is explicit that nothing here sends mail. So: "No email goes…
- `speaker-portal-adding-a-co-presenter::3` (numbered): 2. **They are not published.** A co-presenter is recorded on the session but stays off the public site until the organiser publishes them, and each existing row…
- `speaker-portal-adding-a-co-presenter::4` (numbered): 3. **The window is the form's close date**, not acceptance — `canEditSubmission` gates on it, so the header says "You can change this until the form closes on 1…
- `speaker-portal-adding-a-co-presenter::5` (bold): **Desktop is drawn, not just ruled.** B6 rules the portal as the same column centred at 560 — true of the read-only screens, but the edit view is the one portal…
- `speaker-portal-adding-a-co-presenter::6` (bold): **It is one view, not a second route.** `EditSubmissionView` renders the field set and then `<ParticipantsSection/>` (edit.tsx:217), so Participants sits **belo…
- `speaker-portal-adding-a-co-presenter::7` (bold): **Structure:** existing participants first as a short list with role and status, *then* the add form — the list is what a speaker checks before typing, and putt…
- `speaker-portal-adding-a-co-presenter::8` (bold): **Duplicate is a server-only error.** The unique index on the join table (`migrations/0019`) is the arbiter, so the client cannot pre-empt it — the second frame…

### Docs — a new site, and where it stops

- `docs-a-new-site-and-where-it-stops::1` (bold): **Grouped by who you are, not by screen** — Getting started / Running an event / Your contacts / For reviewers / For speakers / Running the software. A reviewer…
- `docs-a-new-site-and-where-it-stops::2` (bold): **Prose at 680, screenshots at 900.** Text stays at a readable measure while a 1600px screen is legible; on phone, figures go edge to edge with the caption inse…
- `docs-a-new-site-and-where-it-stops::3` (bold): **Where the docs stop:** `/docs/api` and `/dev/mailbox` remain `TOOLS_CSS` chrome per DEC-382 — this design does **not** revise that the way `GET /` did. So the…
- `docs-a-new-site-and-where-it-stops::4` (bold): **Screenshot rules** (the panel beside the frames, and the part most likely to rot):
- `docs-a-new-site-and-where-it-stops::5` (numbered): 1. **From the real app, at 1600 × 900** — never a mock, never a hand-drawn diagram. A doc showing a screen that does not exist is worse than no screenshot.
- `docs-a-new-site-and-where-it-stops::6` (numbered): 2. **Seeded data only.** DevFlow Conf 2027 is fictional and stable, so shots stay comparable and nothing real leaks. Re-shoot from a fresh seed rather than edit…
- `docs-a-new-site-and-where-it-stops::7` (numbered): 3. **Full frames, not crops** — the chrome is how a reader locates themselves. Crop only to call out one control, and say so in the caption.
- `docs-a-new-site-and-where-it-stops::8` (numbered): 4. **The caption carries the point.** A reader who skims only captions should still learn the thing.
- `docs-a-new-site-and-where-it-stops::9` (numbered): 5. **No annotation drawn on top.** Arrows and circles rot the moment the UI moves, and cannot be translated or read aloud. Point with words.
- `docs-a-new-site-and-where-it-stops::10` (numbered): 6. **Re-shoot every release.** A stale screenshot is a bug report from your own documentation; the set is seeded, so this is a script.

### CFP form — editing a question

- `cfp-form-editing-a-question::1` (bullet): - The rule reads as a sentence, not a builder: **"Only show this question when… Format is Workshop"**, with the off state stated ("leave it off and the question…
- `cfp-form-editing-a-question::2` (bullet): - The value control follows the trigger's kind — a dropdown of its options, a number field, a text field — so an organiser cannot write a rule that can never ma…
- `cfp-form-editing-a-question::3` (bullet): - **A hidden question is never required.** If the submitter cannot see it, it cannot block their submission; the modal says so where the two settings meet.
- `cfp-form-editing-a-question::4` (bullet): - The header carries the blast radius — "47 people have already answered this form" — because editing a live question changes what those answers mean.
- `cfp-form-editing-a-question::5` (bullet): - Delete sits far left in the footer, and goes through the irreversible confirm.

### Review progress — two reminder scopes

- `review-progress-two-reminder-scopes::1` (bullet): - **Remind laggards (N)** — everyone with anything outstanding. Disabled when the list is empty.
- `review-progress-two-reminder-scopes::2` (bullet): - **Remind the N not started** — the subset who have scored nothing, a harder nudge. Per **DEC-760**, when nobody is unstarted this link is **hidden, not disabl…

### Loading — the first paint

- `loading-the-first-paint::1` (bullet): - **Draw everything that needs no data immediately** — header, page title, toolbar shell. Only the rows wait.
- `loading-the-first-paint::2` (bullet): - **Under 250ms, show nothing.** A skeleton that flashes is worse than a beat of stillness, and it makes a fast load look broken.
- `loading-the-first-paint::3` (bullet): - **Blocks at the height the rows will become**, so nothing jumps when data lands. Varied widths on the title column only — a column of identical bars reads as…
- `loading-the-first-paint::4` (bullet): - **Always six rows**, never a guess at the real count: a skeleton that guesses lies twice, once while loading and again when the number differs.
- `loading-the-first-paint::5` (bullet): - **No shimmer, no pulse.** An animation across a whole table is motion the user cannot act on and it competes with the content arriving. `#EFEBDF` — the hovere…

### Two more surfaces that shipped without frames

- `two-more-surfaces-that-shipped-without-frames::1` (bullet): - **New contact** (`NewContactModal`) — the only hand-entry path into the org directory, and the one place a contact is created without an import or a submissio…
- `two-more-surfaces-that-shipped-without-frames::2` (bullet): - **Breaks editor** (`BreaksPanel`) — the admin half of the public breaks display designed earlier. Existing breaks as rows with Remove, then label/start/minute…

### Confirm dialogs — one component, two weights

- `confirm-dialogs-one-component-two-weights::1` (bullet): - **Reversible** — one sentence naming the consequence and what survives ("Nothing is deleted"), a primary carrying the verb, Cancel. No typing.
- `confirm-dialogs-one-component-two-weights::2` (bullet): - **Irreversible** — the same, plus **type the name to confirm**. Reserved for deletes that cannot be undone: a portal resource, an event, a contact merge.

### Settings — the four surfaces that shipped without frames

- `settings-the-four-surfaces-that-shipped-without-frames::1` (bullet): - **Reset a password** (`PeopleRolesPanel`) — same reveal-once shape as the invite password, plus the two facts unique to a reset: existing sessions are ended,…
- `settings-the-four-surfaces-that-shipped-without-frames::2` (bullet): - **Portal resources** (`ResourcesPanel`) — add is a modal: name, kind as File/Link chips (one or the other, never both), then the drop zone or URL field. Delet…
- `settings-the-four-surfaces-that-shipped-without-frames::3` (bullet): - **Track colour** (`TRACK_SWATCHES`) — a swatch sits left of the track name in the edit rows, captioned with what it is for: "how a track reads on the agenda a…
- `settings-the-four-surfaces-that-shipped-without-frames::4` (bullet): - **Sessionboard import** (`SessionboardImportPanel`) — three steps in one modal, with step 2 showing counts per entity and what will happen to each ("9 match a…

### Settings — inviting someone

- `settings-inviting-someone::1` (numbered): 1. **Invite** — first/last name (optional on the wire, required at the door), email, and role as two chips with their consequence spelled out: "a reviewer sees…
- `settings-inviting-someone::2` (numbered): 2. **Created** — the one-time password in monospace at 20px with a Copy button, and the sentence that makes it safe: "Closing this dialog is the last time you s…
- `settings-inviting-someone::3` (numbered): 3. **Rejected** — email is the username, so a duplicate is refused. Standard error shape, plus a route out that is better than retyping: *Open Sam's row*, since…
- `settings-inviting-someone::4` (bold): **Do not design a pending-invitation state.** There is no such row: the account is live from creation. A greyed "Invited" row would describe a status the schema…

### Review criteria — Scale or Choice

- `review-criteria-scale-or-choice::1` (bold): **Editing** borrows `FieldModal`'s **type select**, but **not its options textarea** — options are editable rows, one per line item, with a drag handle and Remo…
- `review-criteria-scale-or-choice::2` (bold): **Aggregation is the decision that matters: a Choice criterion is unweighted and excluded from the numeric score.** Results show a distribution in the per-crite…
- `review-criteria-scale-or-choice::3` (bullet): - **The weight input disappears for Choice** — not zeroed, not disabled-with-a-zero. A criterion outside the mean has no weight to give, and a visible `0` invit…
- `review-criteria-scale-or-choice::4` (bullet): - **Shares recompute over the Scale criteria alone.** With Relevance ×3 and Depth ×2, the shares read 60% / 40%, not 50% / 33% — the third criterion is not taki…
- `review-criteria-scale-or-choice::7` (bullet): - **The expanded results band shows each reviewer's pick as text**, in its own column under the criterion name, with the distribution in the footer where the me…
- `review-criteria-scale-or-choice::9` (bullet): - **Existing plans are untouched** — a criterion with no type is Scale, so nothing needs migrating.

(`review-criteria-scale-or-choice::5`, `::6`, `::8` drained wave 34 -- see
"Drained units (wave 34)" above.)

### Password reset

- `password-reset::1` (bold): **This is implemented** — `src/routes/auth-reset.tsx` with `src/auth/password-reset.ts`, covered by `test/password-reset-flow.test.ts`. An earlier draft of this…

(`password-reset::2`, `::3`, `::4`, `::5` drained wave 34 -- see "Drained
units (wave 34)" above.)

### Speaker detail — due-date and schedule columns right-align before status ink

- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::1` (bold): **USER RULING, supersedes the frame here:** the due-date column right-aligns. Every date's glyph **right** edge ends at a constant gap — the row's own `18px` gr…
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::2` (bold): **`text-align: right` alone measured wrong live, and needed two more declarations.** First-cut shipped with only `text-align: right`, then `min-width: 0` once t…
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::3` (bold): **Same defect, two more places it was found** (same component/CSS family, scanned per this ruling rather than assumed):
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::4` (bullet): - **Sessions section**, same page (`Chautauqua Speakers.dc.html:366`, `app/src/pages/speakers/speakers.css` `.chq-speaker-detail-sessions-row`): the schedule co…
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::5` (bullet): - **Task drill, "Still waiting" tab** (`Chautauqua Speakers.dc.html:717`, `app/src/pages/speakers/task-view.css` `.chq-taskview-waiting .chq-taskview-row`): the…
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::6` (bold): **Where the pattern does *not* apply, and why it was left alone:**
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::7` (bullet): - **Task drill, "Answered" tab** — its date column precedes an action link, not status ink. No vertical "status column" register is at risk there.
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::8` (bullet): - **Speaker portal task list** (`src/routes/portal/tasks/views.tsx`) — the due date (`.chq-portal-due`) renders on its **own line** below the task's title/flag…
- `speaker-detail-due-date-and-schedule-columns-right-align-before-status-ink::9` (bullet): - **Onboarding grid (dense matrix)** — the due date lives in the **column header** (B8: "name · due · '7 of 12 done'"), not in a per-row cell beside the status…

### Superseded — frames formerly owed

- `superseded-frames-formerly-owed::1` (numbered): 1. **Bulk-communications flow** (B1 ⚡) — the seam between the four steps.
- `superseded-frames-formerly-owed::2` (numbered): 2. **Submission detail · session details** (A5 ⚡) — tracks, format, participants, co-presenter.
- `superseded-frames-formerly-owed::3` (numbered): 3. **Results-table expanded reviews** (A27 ⚡) — the B8 grid rule made concrete.
- `superseded-frames-formerly-owed::4` (numbered): 4. **Settings edit view** (B10) — CFP edit as the exemplar for all five.
- `superseded-frames-formerly-owed::5` (numbered): 5. **Admin per-speaker detail** (B3) and **review wave lifecycle** (B4).
- `superseded-frames-formerly-owed::6` (numbered): 6. **Import step 3** (B5), **HTML email shell** (B9).

## Wave 39 (v12m-w39-c): 12 more drained

Task w39-c paid the fourteen units named in its brief; two (`speaker-detail-…::3`
and `::6`, both bold transition sentences that only introduce the bullets
below them) resolved to no artifact of their own and stay "gap" per the
brief's own escape clause ("a force-fit citation is worse than a gap") --
honoring them would have meant re-citing a child unit's own citation, the
exact borrowed-citation shape this ledger's preamble forbids. The other
twelve are now "honored" in `UNIT_LEDGER`:

| key | artifact | test |
| --- | --- | --- |
| `review-progress-two-reminder-scopes::1` | `app/src/pages/review/ProgressPanel.tsx` (`disabled={reminding \|\| laggards.length === 0}`) | `app/src/pages/review/ProgressPanel.render.test.tsx` |
| `review-progress-two-reminder-scopes::2` | `app/src/pages/review/ProgressPanel.tsx` (`notStarted.length > 0 && (`) | `app/src/pages/review/ProgressPanel.render.test.tsx` |
| `confirm-dialogs-one-component-two-weights::1` | `app/src/components/ConfirmDialog.tsx` (`weight === 'irreversible' && (`, gating the typing UI to the irreversible branch only) | `app/src/components/ConfirmDialog.render.test.tsx` |
| `confirm-dialogs-one-component-two-weights::2` | `app/src/components/ConfirmDialog.tsx` (throws when `weight='irreversible'` lacks `confirmPhrase`) | `app/src/components/ConfirmDialog.render.test.tsx` |
| `password-reset::1` | `src/auth/password-reset.ts` (`export async function createResetToken(`) | `test/password-reset-flow.test.ts` |
| `speaker-detail-…::1` | `app/src/pages/speakers/speakers.css` `.chq-speaker-detail-tasks-row > :nth-child(2)` (full right-align/nowrap/min-width/overflow/ellipsis block) | `app/src/pages/speakers/speakers-css.test.ts` |
| `speaker-detail-…::2` | `app/src/pages/speakers/speakers.css` (DEC-989 comment on the sessions-row rule, documenting the two-more-declarations mechanism) | `app/src/pages/speakers/speakers-css.test.ts` |
| `speaker-detail-…::4` | `app/src/pages/speakers/speakers.css` `.chq-speaker-detail-sessions-row > :nth-child(2)` | `app/src/pages/speakers/speakers-css.test.ts` |
| `speaker-detail-…::5` | `app/src/pages/speakers/task-view.css` `.chq-taskview-waiting .chq-taskview-row > :nth-child(4)` | `app/src/pages/speakers/speakers-css.test.ts` |
| `speaker-detail-…::7` | `app/src/pages/speakers/task-view.css` (comment naming the Answered tab's date column as preceding an action link, not status ink) | `app/src/pages/speakers/speakers-css.test.ts` |
| `speaker-detail-…::8` | `src/routes/portal/tasks/views.tsx` (`class="chq-portal-due"`, own-line render) | `test/portal-tasks-resources-390-frames.test.ts` |
| `speaker-detail-…::9` | `app/src/pages/speakers/OnboardingGrid.tsx` (`${complete} of ${assigned} done`, the column-header aggregate) | `app/src/pages/speakers/OnboardingGrid.render.test.tsx` |

Note on `password-reset::1`: the wave-34 note above called this unit "the
document's own meta-narration about its drafting history" and left it a
gap. Re-reading its full text against the brief's instruction shows it
also names its own artifact directly -- `src/routes/auth-reset.tsx` with
`src/auth/password-reset.ts`, covered by `test/password-reset-flow.test.ts`
-- so this wave cites the latter file's `createResetToken` export rather
than treating the whole unit as pure narration. This supersedes the wave-34
disposition for this one key.

`RULING_UNIT_GAP_CEILING` moved `130` -> `118` (measured by forcing the
constant to `-1` in `test/design-rulings-ledger.scan.test.ts` and reading
the failing assertion's printed count back, per the ratchet's own
instructions -- never computed by arithmetic on the twelve drained keys).
`npx vitest run test/design-rulings-ledger` is green (27/27) at this
constant. 118 remain, all genuine design-rationale prose with no single
code artifact -- real, narrow work for a later wave, same disposition as
before.

**Wave-51 measurement**: `RULING_UNIT_GAP_CEILING = 104` live
(`test/design-rulings-ledger.scan.test.ts`) at this sha — further keys
drained by intervening lanes since the paragraph above was written. This is
a measurement at the current sha, not a new arithmetic claim.

**Wave-55 measurement (w55-f)**: `RULING_UNIT_GAP_CEILING = 93` live
(`test/design-rulings-ledger.scan.test.ts`), measured by forcing the
constant to `-1` and reading the failing assertion's printed count back.
`104 -> 93`: the b7-empty-states and loading-the-first-paint headings'
gaps were drained this wave -- see "### Drained units (wave 55)" above.
