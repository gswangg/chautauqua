# Design rulings — closing the standard

Ruling on every item in the 2026-08-14 brief. After this, **"matches a frame or a recorded ruling"** is a closed test: anything not listed here and not in a frame is improvisation and should be flagged.

Three verdicts:

- **BLESS** — keep as built, recorded as deliberate. No frame needed; the ruling *is* the artifact.
- **RESTYLE** — keep the capability, redraw it. Either a frame exists now, or the one-line spec below is the spec.
- **DROP** — delete the capability.

⚡ marks eval-relevant items. Nothing eval-relevant is dropped.

---

## Governing principle, applied

**Mobile reflows the desktop design; it never competes with it.** Phone frames may use phone grammar freely — action bars, sheets, stacked fields, 44px targets — because those are *translations* of desktop affordances. What is one-way is authority:

1. A 390 frame keeps the desktop design's hierarchy, capabilities and tokens. It is never an independent drawing.
2. Where a surface has **only** a 390 frame, the desktop state is a *missing artifact*, not an implied one. Do not scale phone anatomy up. Two surfaces were in that position — Settings edit views and the speaker portal — and both are ruled below.

A corollary worth stating, because it caused the sign-in problem: **a centred card is not a desktop design just because it is centred.** Full-column buttons, one-field-per-row stacking and top alignment are phone anatomy; at 1600+ they read as a blown-up phone. Desktop form anatomy means a card at its own natural width (420–480 for auth), vertically composed, with actions in a footer row rather than spanning the column.

---

## A. Extensions — capabilities with no frame

### Content

| # | Item | Ruling |
|---|---|---|
| 1 ⚡ | Worklist bulk-approve | **RESTYLE — framed now, desktop and phone.** Checkbox column at 26px; the bulk bar sits **below the filters and directly above the header row**, because a selection bar must be adjacent to the selection and because the filter governs the bar, not the reverse — changing the filter changes which rows exist and can invalidate a selection. **One verb, one scope:** the bar owns Approve (`3 selected · Approve 3`) and the title row keeps only quiet actions. A second filled "Approve N ready" in the title row was drawn and removed — two olive primaries whose scopes differ (eligible vs ticked) leave a user unable to tell which one they are pressing. Approve-all is two clicks via select-all, which is enough. Select-all shows a **partial mark (⊟)** when some rows are ticked; a checked select-all over a partial selection asserts something false. **Only re-uploads are pre-ticked**, never unread rows. A re-upload answers changes you yourself specified, so you already hold the context and a pending obligation — batching those is the safe act. A file nobody has opened is the batch that needs friction, so those load unticked and select-all is the deliberate way to include them. An earlier draft had this exactly inverted, pre-selecting the three never-reviewed rows under a primary reading "Approve 3". Bar states "Approving sends nothing · the speaker sees it in their portal". **Phone:** a *Select* link in the header enters select mode — rows gain a tick, per-row verbs give way to a docked `Approve 3` bar, header becomes `3 selected · All 5 · Done`. The ~22-deliverable round-trip argument applies at least as hard on a phone, so this is a translation, not an omission. |
| 2 | Detail header links (Edit title and abstract, Revision history) | **RESTYLE — one line.** Both belong in the detail header as tertiary links right-flushed against the session title, in the pattern the submission detail already uses for `‹ All submissions` / prev-next. Not buttons; they navigate. |
| 3 | Per-version Delete | **RESTYLE — one line.** A tertiary text link after Download on the version row, in muted ink (`#565A4B`), never a bordered button — matching the Remove treatment on criteria and pipeline rows. Deleting the **newest** version must ask; deleting a superseded one need not. |
| 4 | Note version tags ("You · v2 · 16 Apr") | **BLESS.** A comment thread anchored to the version chain (DEC-573) genuinely needs to say which version it was about, and the existing note header already carries author + date — this only adds the version. Keep the tag inside the existing `who · when` line rather than as a chip. |

### Submissions

| # | Item | Ruling |
|---|---|---|
| 5 ⚡ | SESSION DETAILS section (tracks + Edit tracks, format, participants, add co-presenter) | **RESTYLE — needs a frame** (listed below as owed). Spec: a fourth numbered section in the main column, after Reviews, using the same `label + 2px rule + rows` pattern. Tracks as chips with a tertiary *Edit tracks*; format as a select; participants as a 3-column row set (name, role, email) with a search field beneath. It must sit **above** the fold-line question — a co-presenter edit ~700px down a page is discoverable only by scrolling, so it earns its own section header rather than living in the rail. |
| 6 | Detail rail extras (Clone, Review the content ›, Edit under abstract) | **RESTYLE — one line.** Clone and *Review the content ›* are rail links under the existing History section, not buttons. The Edit under the abstract is **DROP** — item 2's "Edit title and abstract ›" in the header covers it, and two edit affordances for one field is the redundancy this pass exists to remove. |
| 7 | New-submission modal extras (tracks fieldset, format select, · OPTIONAL suffixes) | **BLESS.** An organiser entering an invited talk by hand needs the same fields the public form collects. Use `· optional` as a lowercase suffix on the label, matching the CFP form and the enroll dialog — not uppercase. |
| 8 | Bulk-bar "Delete…" | **DROP.** Bulk-deleting submissions is unrecoverable and has no eval need; single-row delete on the detail page is enough. If it returns, it needs a typed confirmation, which is a bigger design than the bar can carry. |

### Review

| # | Item | Ruling |
|---|---|---|
| 9 | Plan editor extras (per-reviewer Reset password, Delete plan) | **Reset password: DROP** from the plan editor — a reviewer's credentials are not a property of a review plan, and Settings → People and roles is where that belongs. **Delete plan: RESTYLE**, one line: a tertiary link in the plan editor footer, disabled once any review has landed (same freeze rule as criteria), with the same "Start a new wave" alternative. |
| 10 ⚡ | Anonymize toggle placement | **RESTYLE — one line.** It belongs in the plan fields block beside Rating scale, not among the criteria: it is a plan-wide property, same as scale. Label "Hide speaker names from reviewers", with the consequence beneath — "Reviewers see the abstract and track only". It freezes with the criteria at the first submitted review, for the same reason. |
| 11 | Keyboard number-key scoring | **BLESS, unlabelled.** A power path for reviewers scoring dozens in a sitting. It needs no visible tip — the pills are the discoverable route — but it must not be the *only* route, and the focus ring on the pill row is what makes it legible. |
| 27 ⚡ | Results-table reviews expansion | **RESTYLE — needs a frame** (owed). This is an instance of the interaction-states gap, B8: the expanded band must inherit the results table's column grid, not free-float across the measure. Spec in B8. |
| 28 | Review-landing `is-active` plan row tint | **RESTYLE — covered by B8.** Selected-row band: `#EFEBDF` fill, 3px olive left edge, content inset to the row's existing grid. |

### Speakers

| # | Item | Ruling |
|---|---|---|
| 12 | Task-column-header Edit/Remove links | **RESTYLE — one line.** The matrix header already stacks title + due date; add a tertiary *Edit* on the same line as the title, and put Remove inside that editor rather than in the header. Two links per column × 6 columns is 12 controls in a header row whose job is labelling. |
| 13 | "Import speakers from a CSV" link | **RESTYLE — one line.** It goes on the **roster**, not the filter row — the roster is where adding people lives (it already has *Add a speaker* / *Import CSV* on its phone frame). The matrix filter row filters; it does not create. |
| 14 | EMAILED marker after "Remind X" | **BLESS.** The one-hour dedupe window means a second click does nothing, so the row must say the first one landed. Use the muted micro-label register, not a chip. |
| 15 | DELIVERABLE KIND select in New-task modal | **RESTYLE — restore it.** v6 dropped it from the frame, but kind drives real behaviour: form-kind tasks are the only ones that get a Response link, upload-kind the only ones with a File link. The modal already shows Upload / Form / Acknowledge; the deliverable kind for upload tasks belongs beneath it. |
| 16 | Admin per-speaker detail page | **RESTYLE — needs a frame** (owed, B3). |

### Comms / Contacts

| # | Item | Ruling |
|---|---|---|
| 17 | "Compose" pill in the Comms header | **BLESS.** Compose is the page's primary job and the step rail only appears once you are in it; the header needs a way back to step 1. |
| 18 ⚡ | EVALUATION PLAN select in Attachments | **RESTYLE — framed now.** It sits indented under *Include reviewer feedback*, revealed by that checkbox, because it is that option's parameter and not a peer of it. Caption states the resolver's actual rule: "Only submitted, non-recused reviews are merged." |
| 19 ⚡ | Bulk-email TEMPLATE select + merge footnote | **RESTYLE — framed now.** Select defaults to "No template — write it here". The three submission-scoped templates are named as unavailable *with the reason* — "Acceptance, Decline and Schedule live need a submission, so they are not available here" — rather than silently absent, and the footnote names which merge fields do resolve. |
| 20 | Contact drawer's 17 fields + sticky Save/Delete footer | **RESTYLE — framed now**, desktop and phone: four titled groups — **Contact** (email, phone, company, title), **Profile** (bio, and all four social links collapsed into one Links row), **This event** (labels, dietary, travel, accessibility) and **Notes** — each under the same 2px rule the rest of the app uses for sections. An unrecorded value reads "Nothing recorded" in disabled ink rather than being absent, so a blank field is distinguishable from a missing one. The footer is sticky with Delete far left, Cancel and Save right-flushed. Original spec: The frame's 5 rows were an excerpt, not a ruling; the real field set is right. Group it: **Contact** (email, phone, company, title), **Profile** (bio, links — Twitter/LinkedIn/GitHub/Website as one Links row, not four), **Event** (labels, dietary, travel & logistics), **Notes** last. A flat 17-row list is a form, not a drawer. Footer: keep sticky, primary Save right-flushed, Delete as a tertiary link at the far left — never adjacent to Save. |
| 21 | Add-to-pipeline `· OPTIONAL` suffixes | **RESTYLE — one line.** Use lowercase `· optional` on the label (matching item 7 and the CFP form). The frame's right-aligned helper lines stay — they say what the field is *for*, which the suffix does not. |

### Settings / Auth / Chrome

| # | Item | Ruling |
|---|---|---|
| 22 | Unframed Settings rows (record prefix, branding, open the portal, import from Sessionboard, change-password link) | **BLESS the rows**, in the existing definition-row pattern (label + value + tertiary action). One exception: *Open as a speaker* must say it is a read-only impersonation of the portal, or it reads as a login-as. The change-password link under the H1 is **RESTYLE**: it belongs in the People and roles section next to your own row, not floating under the page title. |
| 23 | Login demo-account block | **BLESS with a spec.** Real demo utility and judges will use it. Spec: below the sign-in card, outside it, under a `DEMO ACCOUNTS` micro-label — three tertiary rows (role · email), each filling the form rather than submitting it, and a muted line saying passwords come from the seed. It must never look like the primary path, and it should be trivially removable in one block for a real deployment. |
| 24 | `/logout` 404 | **RESTYLE — must fix.** A route that destroys the session and then 404s is a bug wearing a design question. Make it a real POST that redirects to `/login?signed-out=1`, and have the login card carry a single muted line, "You have been signed out." No dedicated screen. |
| 25 | Agenda "No room yet"/TBD column | **BLESS.** It is data-driven and honest — sessions genuinely lack rooms mid-planning, and the admin agenda's whole job is placing them. Style it as the other room columns with a dashed header rule, and never render it on the public agenda. |

### Public

| # | Item | Ruling |
|---|---|---|
| 26 ⚡ | Session-detail Save / itinerary control | **RESTYLE — one line.** The detail page gets the same Save control the list rows have, in the header beside the session title, using the identical two-state treatment (`Save` / `Saved`) so the itinerary reads as one mechanism across list, detail and schedule. It writes the same `chq_itinerary_<slug>` key. |

---

## B. Uncovered surfaces

| # | Surface | Ruling |
|---|---|---|
| 1 ⚡ | Bulk-communications flow | **RESTYLE — needs frames** (owed; highest leverage). The four steps exist individually; what is missing is the *seam* — how a selection survives step changes, what the back path does to it, and what the send result reports. Spec: keep the four-step rail as the only navigation, make every step's primary the next step (never "Send" until step 4), and end on a result panel that reports `{sent, skipped, remaining}` as three plain lines rather than a toast. |
| 2 | Breaks editor dialog | **RESTYLE — one line.** A modal in the New-task register: label, location, start, duration as a 2×2 field grid, then the existing breaks as rows with a tertiary Remove. No new vocabulary needed. |
| 3 | Admin per-speaker detail page | **RESTYLE — needs a frame** (owed). Spec: participation status control in the header (the roster's control, promoted), then four sections — Sessions, Tasks, Files, Notes — at the table measure. |
| 4 | Review wave lifecycle + reviewer multi-plan landing | **RESTYLE — framed, both widths.** The hub is the same list at the reading measure (820) on desktop and stacked cards at 390 — a plan list is not a different design at width, so the desktop frame is the authority and the phone one derives from it. Two things: "Start a new wave" is a prefilled New-plan form (criteria and reviewers copied from the frozen plan, dates blank), and the reviewer's landing is a plan list, not a queue, when they have more than one — with a single plan it must skip straight to that queue. The review pack's "queue and scorecard, nothing else" stands for the single-plan case; this is the exception it did not cover. |
| 5 | Import wizard step 3 | **RESTYLE — needs a frame** (owed). Spec: two counts as a heading ("205 new · 9 updated"), then the 9 updates as rows showing which fields change, then the commit. The dedupe outcome is the whole point of the step; do not summarise it as one number. |
| 6 | Speaker portal on desktop | **RESTYLE — ruled, no frames needed.** The portal is a task list for one person; it does not become a different design at 1600. Centre the existing column at **560px** in the page (not 390 — that is a device width, not a measure), keep the section order, and let the task rows' action buttons shrink from full-width to right-flushed. That is the reflow, in reverse. Everything else — resources, session panel, done list — is unchanged. |
| 7 | Empty states | **RESTYLE — framed now, at full size in the pages they belong to** — Overview (fresh event), Submissions (before the CFP opens, and triage cleared), Speakers (search found nothing), Contacts (an empty pipeline stage), Comms (nothing sent), and public Sessions (programme not out). Each is a complete 1600 frame with its page's real header, nav and measure, because an empty state is a state *of a page* — drawn in isolation you cannot see whether the filter chrome survived, which is the one decision that matters. Seven rules below. The distinction the spec was missing: **empty because nothing has happened yet** versus **empty because a filter excluded everything**. The first hides the filter chrome entirely (offering a status filter over zero rows is noise) and gets a roomy block with a real primary action; the second keeps its chrome visible above the message, because the fix is in the chrome, and names the excluding facet — "Marcus Okafor is on the roster, but nothing of his is overdue" — with an escape link that clears exactly that one filter. Where the user genuinely cannot act, such as an attendee waiting on a programme, there is **no button at all** rather than a disabled one. Original spec: Three parts and no illustration: what is empty in plain words ("No submissions yet"), why in one clause if the reason is actionable ("The call for papers opens 1 March"), and the one action that changes it — or nothing, when the user cannot act. Never an empty table with headers. The sessions zero-state is the exemplar. |
| 8 | Interaction-states standard | **RESTYLE — spec below.** Closes items 27, 28 and the whole class. |
| 9 | HTML email templates | **RESTYLE — needs frames** (owed). Receipts of record for every scenario. Spec: one shell — the org name as a text wordmark, a single measure at 560px, body at 16/1.6, one olive button, and a footer naming the event and why they received it. No images, no columns; the acceptance, decline, reminder and confirmation emails differ only in body. |
| 10 | Settings edit views on desktop | **RESTYLE — spec below**, plus one owed frame as exemplar. And: **DROP the public-pages edit mode.** Its read view already carries every value and action; a Change view for it is a gate over nothing. |

### B8 — Interaction-states standard

One spec for hover / active / selected / expanded, so state bands stop being drawn per surface:

- **Hover** on any row or nav item: `#EFEBDF` fill. No border change, no shift.
- **Selected / active row**: `#EFEBDF` fill plus a **3px olive left edge**. The edge is what distinguishes selected from merely hovered, and it replaces 3px of the row's left padding rather than adding to it, so nothing shifts on selection.
- **Expanded disclosure**: the band is `#FAF8F2` with a `1px #E1DDCE` top and bottom rule — a lighter surface than the row, so it reads as inside it.
- **The rule that fixes items 27–28:** an expanded or selected band **inherits its parent's column grid**. It repeats the same `grid-template-columns`, so its content lines up under the columns it belongs to; it never spans the measure with its own free-floating layout. Content insets 16px from the band edge, top and bottom.
- **Select carets**: `▾` always sits at the **right edge of the control** in muted ink (`#565A4B`), never as the last glyph of the label. Two control widths, one rule — a fixed-width control pushes it there with `justify-content:space-between`; a content-width control (toolbar filter, chip) has no edge beyond its text, so it gets a **6px gap** instead. A caret one space after the word makes a select read as a run of text, which is why the role select in People and roles looked wrong; the same defect was in every toolbar filter in the set and is now fixed across all eleven files.
- **Focus**: 2px olive outline, 2px offset, on every interactive element. Never removed, never replaced by the hover treatment.
- **Disabled**: `#8E8A7A` text on `#DDD8C8` border. Reserved for genuinely inert controls — never for placeholder text or de-emphasis.

Applied to item 27: the expanded reviews band repeats the results table's `44px 1fr 150px 130px 92px 92px auto` grid, so each reviewer's score sits under the Score column and their name under Submission — with the rubric chips on a second line inside the same track.

### B7 — Empty states

Three parts, no illustration: what is empty in plain words, why in one clause when the reason is actionable, and the one action that changes it — or nothing, when the user cannot act.

The distinction that drives the layout is **empty because nothing has happened yet** versus **empty because a filter excluded everything**:

- **Fresh and empty** hides the filter chrome entirely. Offering a status filter over zero rows is noise. The block gets room (44px above) and a real primary action.
- **Filtered to nothing** keeps its chrome visible *above* the message, because the fix is in the chrome, and the block is tighter (30px). It has no primary button — the escape link is the action.

The seven rules:

1. **Name what is empty, not what is missing.** "No submissions yet", never "No data" or "Nothing to show here". The noun tells the user which of twenty lists they are looking at.
2. **Give the reason only when it is actionable.** "The call for papers opens on 1 February" earns its place because it says when to come back. "The query returned zero rows" does not.
3. **One action, and only a real one.** A primary button when there is a genuine next step; **no button at all** when the user cannot act — an attendee waiting on a programme — and never a disabled one.
4. **Distinguish fresh from filtered** (above).
5. **Filtered states name the filter that did it.** "Marcus Okafor is on the roster, but nothing of his is overdue" beats "no results", and the escape link clears exactly that one facet.
6. **Never an empty table with headers.** Column headings over nothing read as a load failure. The message replaces the table; it does not sit under it.
7. **No illustration, no centred hero.** Left-aligned in the content measure, the page's own type scale. A spot illustration turns a routine Tuesday into an occasion.

### B10 — Settings edit views on desktop

The disease is uniform, so the cure is: **an edit view is a form in the definition grid, not a phone screen in the content column.**

- **Field width follows content, not the column.** A date is ~180px, a name ~320, a slug ~420, a URL or intro textarea takes the full 820 measure. A 340px-tall textarea in an 820 column, next to 180px date inputs stretched to full width, is the tell.
- **Two-up where fields pair** — opens/closes, start/end, width/height — in a `1fr 1fr` grid at 16–18px gap. Never one field per row when the pair is read together.
- **Section rhythm matches the read view**: `11px/700/0.12em` uppercase label over a 2px ink rule, 26px between sections, 13–15px between fields. The read and edit views should feel like the same page with different controls.
- **Form footer is a row, right-flushed**: primary filled olive, secondary bordered to its left, tertiary destructive far left. Never a full-width olive bar with a centred Cancel beneath — that is the phone action bar, and it is the single most visible phone tell on these screens.
Each edit view also carries the consequence its section can cause, which is the thing a read view cannot say:

| View | The line it must carry |
|---|---|
| Event | "Changing the slug breaks every link already shared, including saved embeds" |
| Tracks and rooms | A track in use cannot be removed — retire it; seats are advisory, the agenda flags over-capacity but never blocks |
| Call for papers | "47 submissions received · changes do not affect them" |
| Speaker portal | Title and abstract stay organiser-only — a speaker editing them post-acceptance would change what was accepted |
| People and roles | You cannot remove or demote yourself; a reviewer's scope limits which tracks they are assigned |

**Your data splits by mutability, not by section.** Exports are *actions* — they download at once and there is nothing to save — so they need no edit view, and the edit screen says so rather than wrapping a download button in a form. API tokens do mutate, so they own the edit view: named rows with their prefix, created and last-used dates, per-row Revoke, and the two facts a token screen must state before you act — the secret is shown once at creation, and revoking is immediate and irreversible. A never-used token is marked in bold caps, since an unused live credential is usually one somebody forgot to delete.

Remove is **disabled where the row is in use** rather than hidden (`#8E8A7A`), so an organiser can see the option exists and why it is unavailable — tracks with submissions, rooms with sessions, and your own account.

- **Saved-embeds editor** keeps its code box, but the URL and Snippet readouts are `ui-monospace` at 12–13px on `#FAF8F2` inside a `#D3CFC0` rule, with Copy as a bordered secondary in the footer row — not stacked mechanical blocks.

---

## Frames delivered against this brief

All eight owed frames are drawn:

| Owed | Where it landed |
|---|---|
| Bulk-communications seam (B1 ⚡) | `Chautauqua Comms` — step 1 and step 4. Step 1 shows the selection surviving filter changes ("Kept as you change filters · 23 is under the 100-recipient cap") and names the 3 unscheduled recipients that cannot take a calendar invite. Step 4 is a **report to the organiser**, not a copy of the email. An earlier draft drew it in the email's own language — dark panel, subject line as the hero, three bare counts — which made it read as "here is the message" rather than "here is what happened to your 23 recipients", and never said who the numbers referred to. It now leads with the audience ("21 of 23 speakers were emailed"), states what was sent as metadata (template, the subject they saw, when and from which address), and then **names the two skipped speakers individually** with the reason and when each can be retried. A count of skips is not actionable; two names are. The dedupe window is explained where it bites, because being told "skipped" without knowing why reads as a failure. Every step's primary is the next step; "Send" exists only at step 4. |
| Submission session details (A5 ⚡) | `Chautauqua Submissions` — a fourth numbered section after Reviews: tracks as chips with *Edit tracks*, format and level as narrow selects, a participants table with Lead / Co-presenter roles, and a co-presenter search stating that adding one emails a portal link and does not change the lead. |
| Results-table expanded reviews (A27 ⚡) | `Chautauqua Review` — the review count is now a disclosure link, and the expanded band repeats the results table's exact seven-track grid, so each reviewer's per-criterion scores sit under the columns they belong to. Recused rows show em-dashes and a footer line saying they are excluded from the mean. This is the B8 grid rule made concrete. |
| Settings edit views (B10) | `Chautauqua Settings` — **all five drawn, not just an exemplar**: Event, Tracks and rooms, Call for papers, Speaker portal, People and roles. Each is the same shell — sidebar with the current section selected, `‹ back` above the H1, a right-aligned consequence line, sections on the read view's rhythm, and a footer row with the destructive action far left and Cancel / Save changes right-flushed. Field widths follow content throughout: dates two-up at 420, seats at 110, names at 280–420, slug and textareas at the full measure. Public pages has **no** edit view, per the DROP below. |
| Admin per-speaker detail (B3) | `Chautauqua Speakers` — participation control promoted into the header beside Email / Remind, then Sessions, Tasks (clickable statuses, per-task remind) and Files in the main column, with contact, cross-event history and notes in the rail. |
| Review wave lifecycle (B4) | `Chautauqua Review` — the reviewer's "Your plans" hub, shown only when they hold more than one; with a single open plan the page is skipped and they land in its queue. Closed plans stay listed with a quiet *Read your scores*. |
| Import step 3 (B5) | `Chautauqua Contacts` — "205 new · 9 updated" as the heading, then each update named with its field-level diff (struck old value → new), a per-row *Skip this row*, and the warning that a bulk import cannot be undone. |
| HTML email shell (B9) | `Chautauqua Comms` — beside the templates that produce them, not on a page of their own. Comms owns the template list and the send log, so a rendered email is the third view of the same object; a separate file made the emails look like a medium the product does not otherwise touch. |

## Error and validation states

Framed in **eight** places, one per failure shape rather than one per form — the same shape repeated would not teach a developer anything new:

| Frame | Shape | The thing it settles |
|---|---|---|
| Public submit, rejected | Multi-field validation | Summary + anchors + per-field messages; "nothing was lost" |
| Sign in, rejected | Rejected credentials | One message for both causes, so the form cannot enumerate accounts |
| Speakers, write failed | Optimistic rollback | A silent revert reads as a dead click; the cell says "not saved" |
| Plan editor, save rejected | Cross-field + empty-collection | A date before its own start; a plan with zero criteria |
| Import CSV, file rejected | File-level, pre-mapping | 9 rows without email — offer to import the other 205 |
| Content upload, rejected | Wrong file type | Says which formats and **why**; names what was kept |
| Compose, send blocked | Pre-flight on an irreversible act | A merge field that will not resolve for 3 of 23 |
| Scorecard, incomplete | Blocked submit, savable draft | Draft always saves; submit needs every criterion |
| Settings event, clash | Server-only conflict | A slug already taken — the form could not have known |

**Errors are set in weight and rule, never colour alone.** There is no red in this system, so an invalid field takes a **1px ink border with a 3px ink left edge** and its message in ink at 13px/600 — the same vocabulary overdue uses. That also means the states survive a greyscale print and colour-blind readers, which a red ring would not.

**Nine rules:**

1. **Summarise at the top, fix in place.** A submit rejection opens with "Three things need fixing before this can be sent" and one anchor link per problem, each jumping to its field. Every field also carries its own message — the summary is for orientation, the field message for repair.
2. **Say what was kept.** "Nothing was lost. Everything you typed is still below." A submitter who has written 1,200 characters fears the reload more than the error.
3. **Count against the limit, don't just flag it.** "1,412 of 1,200" in the counter and "212 characters over" in the message. A bare "too long" makes the user guess.
4. **Offer the way out, not just the rule.** Over-length abstract: "Cut it, or paste the long version into notes for reviewers instead" — the field that exists for exactly that.
5. **Say why the field matters when the cost is invisible.** Bad email on the public form: "we send your portal link here, so a typo means you never get it." That is the consequence a submitter cannot see.
6. **Required means "pick one", not "required".** "Pick one — a talk needs a track so the right people review it" says what to do and why the form asks.
7. **Credentials fail with one message for both causes.** "That email and password do not match" — never "no such account" or "wrong password", which between them enumerate accounts. Both fields take the error treatment, since the design does not know which was wrong.
8. **A rolled-back optimistic write must announce itself.** `toggleCell` and `applyBulkStatus` revert on `ApiError`; a silent revert reads as the click not registering, so the organiser clicks again. The banner names the row, gives the likely cause ("someone else may have edited this speaker"), says where it landed, and offers *Try again* plus *Reload the grid*. The reverted cell itself is marked "Overdue · not saved" until dismissed.
9. **A draft never validates.** "Saving a draft skips these checks" sits beside Save draft, because a half-written abstract must always be storable — and the reviewer scorecard follows the same split: *Save draft* accepts a partly-scored card, *Submit* does not.
10. **Offer the partial action when one exists.** Nine bad CSV rows offer "Import the 205 good rows"; three unresolvable merge fields offer "Send to the 20 who have a slot". An all-or-nothing block on a 200-row import is a design decision, not a constraint.
11. **Name what survived.** "Slides v3 is still the current file. Nothing was replaced." · "Everything else on this page is fine and is still here." A failed write leaves people unsure what state they are in, and that uncertainty costs more than the error.
12. **Server-only errors are not the form's fault.** A slug clash or a concurrent edit could not have been caught client-side, so the message says what happened out there — "already taken by another event in this org", "someone else may have edited this speaker" — rather than blaming the input.
13. **Pre-flight the irreversible.** Sending cannot be undone, so unresolvable merge fields are caught at step 3 with a per-recipient list and a *Place on the agenda ›* link out. The caption says why the interruption is worth it: "this is the last point at which it is cheap to fix".

## Speaker portal — adding a co-presenter

DEC-604 lets a speaker self-add a co-presenter to their own submission (`portal/edit.tsx` → `addCoPresenter`). It shipped without a frame, so the build rendered a bare stack of labels and inputs. Two frames now cover it, inside the portal's own edit screen rather than as a separate page.

**Three facts the form must state, because none is visible from the fields:**

1. **Nobody is emailed.** `addCoPresenter` writes a participant row and returns — the route comment is explicit that nothing here sends mail. So: "No email goes to them — tell them yourself." A speaker who assumes an invitation went out will not follow up.
2. **They are not published.** A co-presenter is recorded on the session but stays off the public site until the organiser publishes them, and each existing row repeats it in muted text.
3. **The window is the form's close date**, not acceptance — `canEditSubmission` gates on it, so the header says "You can change this until the form closes on 16 Aug". This replaces an earlier sub-line, "Edits are live on the public pages straight away", which contradicted rule 2 on the same screen.

**Desktop is drawn, not just ruled.** B6 rules the portal as the same column centred at 560 — true of the read-only screens, but the edit view is the one portal page with a form, so it has its own 1600 frame. Three things change with the width, all from the B10 form spec: first and last name go **two-up** (they are read as one thing), email pairs with the role select at 190, and the footer becomes a **right-flushed row** — Cancel then Save changes — instead of the phone's stacked action bar. *Add co-presenter* is left-aligned at its natural width inside its section, so it never competes with the page's Save.

**It is one view, not a second route.** `EditSubmissionView` renders the field set and then `<ParticipantsSection/>` (edit.tsx:217), so Participants sits **below** title, abstract and session length on the same `/portal/submissions/:id/edit` page — the frame shows the composed page rather than the section alone. The failure state re-renders that same section: list, "Add a co-presenter" heading and the no-email note are always emitted (edit.tsx:463-476); only field errors are added.

**Structure:** existing participants first as a short list with role and status, *then* the add form — the list is what a speaker checks before typing, and putting it second invites duplicate entries. First and last name sit two-up (they are read as one thing), email and role take the full measure. The submit is **secondary**, not primary: adding a co-presenter is an aside within the edit screen, whose primary action is Save changes.

**Duplicate is a server-only error.** The unique index on the join table (`migrations/0019`) is the arbiter, so the client cannot pre-empt it — the second frame shows the rejection in the standard shape: banner naming what did *not* happen, the email field marked, the API's own message, and "Everything you typed is still below."

## Password reset

**This is proposed new work — no reset flow exists.** `src/auth/` holds `cookies.ts`, `tokens.ts` (session and API tokens) and `claim.ts`. There is no forgot-password route and no reset token; the comment at `src/server/auth-session.ts:14` treats *claim* and *account password change* as the only password-reset paths, and a claim token is minted for a contact by an organiser's send, not requested by the person who forgot.

The closest precedent, if the token is modelled on it, is `claim.ts`: `CLAIM_TTL_SECONDS` is **30 days**, and `createClaimToken` does not hard-invalidate a prior token — it re-puts it under `SUPERSEDED_GRACE_SECONDS` so a batch send that fails after minting cannot lock someone out. **The frames therefore assert no lifetime and no single-use guarantee.** An earlier draft said "works once and expires in an hour" and "asking twice invalidates the first link" — all three invented, and all three contradicting the one token mechanism that does exist. Whoever builds this decides the TTL and supersede behaviour, and the copy follows the decision.

Four states in `Chautauqua Account`, entered from *Forgot your password?* on the sign-in card, all on that card's 460px measure and vertical centring.

1. **Ask** — one email field. "We will email you a link to set a new one."
2. **Sent** — the security decision, and the reason this needs a designed screen rather than a toast: the confirmation must read **"If that address has an account, a reset link is on its way."** A screen that says "we've emailed you" confirms the address exists; one that says "no such account" confirms it does not. Either turns the form into an account-enumeration oracle, so the wording is identical both ways and the page never branches.
3. **Set** — new password twice, reached from the emailed link, **naming the account being changed** so a forwarded link cannot silently reset someone else's. The helper argues for a passphrase rather than reciting character-class rules.
4. **No longer valid** — any expiring or supersedable token guarantees users meet this state, so it is a designed screen with a *Send a fresh link* primary, never a generic error. Its wording covers both causes without naming a duration: "This link has already been used, or it has been replaced by a newer one."

Related: item 24's `/logout` fix and this flow share the login card's single muted status line — "You have been signed out", "That link has expired" — rather than each inventing its own banner.

## Reviewer plan hub — both widths

Ruled and framed: the hub is **the same list at the reading measure (820)** on desktop and stacked cards at 390. A plan list is not a different design at width, so the desktop frame is the authority and the phone one derives from it. With one open plan the page is skipped entirely and the reviewer lands in that queue.

## Superseded — frames formerly owed

Ruled RESTYLE, spec'd above, but not yet drawn. In leverage order:

1. **Bulk-communications flow** (B1 ⚡) — the seam between the four steps.
2. **Submission detail · session details** (A5 ⚡) — tracks, format, participants, co-presenter.
3. **Results-table expanded reviews** (A27 ⚡) — the B8 grid rule made concrete.
4. **Settings edit view** (B10) — CFP edit as the exemplar for all five.
5. **Admin per-speaker detail** (B3) and **review wave lifecycle** (B4).
6. **Import step 3** (B5), **HTML email shell** (B9).

Everything else on this list is either framed as of this pass, or the ruling above **is** the artifact.
