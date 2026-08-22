# Portal v12 phone fidelity audit

Two lanes audited this cluster in the same wave; both findings sets are
kept verbatim below.

---

# Portal v12 fidelity audit — phone (w3-a)

Findings the task window could not resolve. Frame citations are verbatim
literals from `docs/design/Chautauqua Public and Portal.dc.html` per
DEC-976.

## 1. The delegating task described the landing frame's H1 as the 27px cluster-landing register; the frame's own bytes say 25px, same as both drill frames

w3-a's brief states: "The drill frames (:476, :531) open with a 44px back
link and a 25px H1; the landing (:414) uses the 27px register." The frame
bytes disagree with the second half of that sentence:

`<span style="font-family:'Familjen Grotesk', sans-serif; font-size:25px; font-weight:700; letter-spacing:-0.04em; line-height:1.05">Two things to do</span>` (:420)

— the landing frame's own H1-equivalent is 25px, byte-identical to the
drill frames' `font-size:25px` at :479 ("Your tasks") and :534 ("Your
profile"). All three of this task's frames draw the SAME register.

Per "the frame in the repo outranks a measurement of the frame," this task
implemented `.chq-portal-hero`'s phone rule as
`var(--chq-type-page-title-phone-drill)` (25px) uniformly across the whole
`/portal/*` family, rather than conditioning it on back-link presence — the
portal has no cluster nav to land on in the first place, so a uniform
one-level-below-entry register is the coherent reading. Flagging here in
case a future wave's design pass intended the 27px register for the portal
home specifically and the frame itself needs a ruling/correction, not the
code.

## 2. Frames "Portal · Your tasks" (:476-501) and "Portal · Your profile" (:531-559) draw a fixed bottom DOCK with primary/secondary action buttons; the current markup renders those actions inline in the scrolling body instead

Both drill frames draw a `flex-shrink:0` dock, separate from the scrolling
body, holding a primary + secondary action pair at `min-height:48px`:

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` (:492, "Mark the release signed" / "Later")

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` (:550, "Save" / "Cancel")

Today `src/routes/portal/profile.tsx`'s Save action (`.chq-portal-actions`
inside the "Profile details" `<section>`) scrolls away with the rest of the
body — it is not pinned to a bottom dock, and there is no Cancel control at
all. `src/routes/portal/tasks.tsx` (w3-b's file, not touched here) likely
has the same gap for its own action row.

This task's CSS already gives `.chq-portal-shell > .chq-portal-footer` the
correct dock ANATOMY (ink border-top, sunk background, `12px 16px 16px`
padding — verified against both frames by
`test/portal-phone-frames.test.ts`), because every `/portal/*` page already
renders that footer via `PortalLayout`. What's missing is CONTENT: routing
a page's primary action pair into `PortalLayout`'s existing `footerExtra`
slot (already used by the portal home's "name · company / Profile" band)
so it renders inside the dock instead of the scrolling body, plus adding
the profile page's missing Cancel control. That is a markup change to
`profile.tsx` (and `tasks.tsx`, outside this task's file ownership) beyond
this task's CSS-only "move the phone block, extend it" scope — recorded
here rather than attempted piecemeal within the time budget.

**Amendment (DEC-967 wave-106):** the tasks half's second control (`:492`, "Later")
does not carry the same fix: the portal task model exposes only
complete-or-not, with no snooze/defer/dismiss/later capability anywhere in
the tree, so "Later" is not a markup gap the same way Cancel was — it is
recorded as an unbuilt feature in `docs/design/DEVIATIONS.md` §6 ("Portal
task-list dock \"Later\""). The primary control ("Mark the release signed")
remains legitimate geometry for whatever primary action a future task
routes into the dock, per that same DEVIATIONS entry.

---

# Portal v12 phone fidelity — findings (w3-b)

Shell-level findings the task window could not resolve inside the scoped
files (`src/routes/portal/edit.tsx`, `src/routes/portal/tasks.tsx` +
`tasks/**`, `src/routes/portal/shared.tsx`, `src/routes/portal/portal.css.ts`).
Frame citations are verbatim literals from `docs/design/Chautauqua Public
and Portal.dc.html`.

## 1. "Portal · Hotel stay form" (:518-521) draws a two-button footer dock that has no product behind it

`<div style="flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px">` /
`<span style="flex:1; ...">Send this in</span>` /
`<span style="border:1px solid #BAB6A6; ...">Save draft</span>`

`docs/design/DEVIATIONS.md:163` already rules "Hotel-form save-draft" as an
unbuilt feature (no data model or endpoint behind the drawing) — this is not
a new finding, just a pointer for whoever eventually builds it: when it
lands, `TaskFormPage` (`src/routes/portal/tasks/views.tsx`) will need a real
`.chq-portal-actions-footer`-shaped dock (the class already exists, built
for `EditPage`'s footer this same task) rather than its current bare inline
`Submit` button. Until then the bare button already clears the 44px floor
via `THEME_CSS`'s unconditional phone rule (`src/views/theme.ts:625`), so
there is no phone-conformance regression today — only a missing feature,
already tracked elsewhere.

## 2. "Portal · Your session" (:563-596) markup is owned by `src/routes/portal/index.tsx`, outside this task's file grant

The frame's read-only session detail (status eyebrow, title, meta,
placement line, Abstract, Slides row with a Replace/upload control) renders
from `SubmissionDetailPage` in `src/routes/portal/index.tsx:420-520`, not
from any file this task owns. Everything that page consumes from the shared
sheet this task DID touch — `.chq-portal-actions .chq-btn`'s 44px floor,
`.chq-portal-status-badge`'s unmediated block-level register, the phone
shell's `.chq-portal-shell > .chq-measure` scroll region — is already
conformant (pinned by `test/portal-session-phone-frames.test.ts`'s second
describe block). `index.tsx` itself was cited in this task's authority list
for that reason only; a future task that owns that file should confirm its
own H1 (`docs/design/...:471`, `<h1 class="chq-portal-hero">Your session</h1>`)
gets the same 25px back-linked drill-in register (`--chq-type-page-title-
phone-drill`, DEC-643 amendment) this task wired up for
`TaskFormPage`/`EditPage` — `.chq-portal-hero-drill` is a modifier class,
not a rewrite of the shared `.chq-portal-hero` rule, specifically so a
sibling task can adopt it on that page's H1 without any coordination.

## 3. `--chq-type-page-title-phone-drill` had zero readers before this task

`src/views/theme.ts:76` declares the 25px drill register (DEC-643) but no
selector in the tree consumed it — every `.chq-portal-hero` instance,
back-linked or not, fell back to the 27px cluster-landing size
(`.chq-portal-hero { font-size: var(--chq-type-page-title-phone-size) }`,
unconditional in the phone block). This task wires it up for the two H1s it
owns (`TaskFormPage`, `EditPage`, both back-linked drill-ins per :508/:603)
via a new `.chq-portal-hero-drill` modifier class, added to those two
`<h1>` elements only. Three other `.chq-portal-hero` pages still carry the
same latent mismatch and are out of this task's file grant:
`src/routes/portal/index.tsx:471` ("Your session", back-linked — see
finding 2), `src/routes/portal/index.tsx:537` ("Your submissions",
back-linked), and `src/routes/portal/tasks/views.tsx:473` and :553 ("Your
tasks" / "Resources", both back-linked but neither is one of this task's
three named frames). `src/routes/portal/index.tsx:326` (the portal
dashboard's own "N things to do" H1) is the one genuine cluster-landing
page and correctly keeps the 27px base rule untouched.

---

# Portal SSR 390 per-frame render verdicts, part 1 of 2 (w14-sd, DEC-976 wave-158 amendment)

MEASUREMENT ONLY — fixes nothing, touches no route module and no
`*.css.ts`. Each row below is entered by a real `app.request()` through the
mounted `/portal/*` route sub-apps (never a hand-built-props view call) and
graded by `test/portal-390-frame-verdicts.test.ts`, per the DEC-976
wave-158 amendment's SSR verdict contract. A DIVERGES row is a finding, not
a failure. Frame citations are verbatim literals from `docs/design/
Chautauqua Public and Portal.dc.html`. The remaining ten of the fourteen
Public-and-Portal SSR phone frames are part 2 of 2, a sibling task's file.

## Frame :414 "Speaker portal" (GET /portal) — DIVERGES (narrowed, task
v12m-w21-l, DEC-976: ruled product surface, not an open gap)

The frame's scroll body (:410-462) draws exactly three sections — "Waiting
on you", "Your session", "Done" — and a footer band with the speaker's
name/company and a "Profile" link only. The route (`PortalPage`,
`src/routes/portal/index.tsx`) renders a FOURTH section, "Your submissions"
(`aria-label="Your submissions"`, DEC-729), between "Waiting on you" and
"Your session" — every submission the speaker owns, pending/accepted/
declined alike, a section the frame never draws. The footer additionally
links to `/portal/resources` (DEC-988 wave-74 amendment: reachable whenever
any of the speaker's events permits resources) alongside "Profile", where
the frame's footer band draws only the name/company clause and "Profile".
Both are RULED product surface, not an unresolved question: DEC-729 and
DEC-988 record that the frame predates these features and is therefore
stale, not the route — this row states that ruling, it does not seek one.

## Frame :476 "Portal · Your tasks" (GET /portal/tasks) — DIVERGES (blessed,
task v12m-w21-l, DEC-976)

The frame (:473-497) matches on back link ('‹ Your portal'), H1 ("Your
tasks"), and per-row anatomy (title / state flag / due / action). Its
docked footer draws TWO controls — a primary ("Mark the release signed")
and a bordered secondary ("Later"). The route's dock
(`tasksPageDockPrimary`, `src/routes/portal/tasks/views.tsx`) renders
exactly ONE real control — the first incomplete task's own action (e.g.
"Mark complete") — and no secondary at all, at any task-list state. This is
a dock secondary the frame draws with no verb behind it, and it is already
blessed in `docs/design/DEVIATIONS.md`'s "Portal task-list dock 'Later'"
bullet, which records: "the portal task model exposes only
complete-or-not: `src/routes/portal/**/*.tsx` and
`src/server/repo/portal*` carry no snooze, defer, dismiss, or later
capability anywhere in the tree. 'Later' persists nothing, returns on no
schedule, and is visible to no organiser, so the second button's copy is
not manufactured — it names a real gap in the domain." This is its first
render-through-the-route confirmation of an already-blessed finding.

## Frame :531 "Portal · Your profile" (GET /portal/profile) — DIVERGES
(blessed, task v12m-w21-l, DEC-976)

The frame (:528-556) matches on back link, headshot section, and field
anatomy. (1) CLOSED (wave 19, task w19-d): the H1 text clause is
resolved — `src/routes/portal/profile.tsx` renders `<h1 class="chq-portal-hero
chq-portal-hero-drill">Your profile</h1>`, the frame's own literal (:534),
not `My Profile`; `test/portal-390-frame-verdicts.test.ts` already pins
this with `expect(html).toContain(">Your profile<");` and
`expect(html).not.toContain("My Profile");` (its :297 `it()` per the
DEC-576 wave-16 amendment). No H1 divergence remains. (2) the docked
footer: the frame draws a primary "Save" plus a bordered secondary
"Cancel"; the route's `profileDock` renders only "Save profile", with no
Cancel control. This is a dock secondary the frame draws with no verb
behind it, and it is already blessed in `docs/design/DEVIATIONS.md`'s
"Portal · Your profile dock has no Cancel" bullet, which records: "The
profile form has no 'leave without saving' destination distinct from the
header/footer sign-out and the existing '‹ Your portal' back-link already
on screen ... so minting one here would be a control invented to fill the
band — the exact thing DEC-576's wave-110 amendment forbids ('a second
control is never manufactured just to fill the band')."

---

## Request verdicts (wave 28)

MEASUREMENT ONLY (task w28-e, DEC-976 wave-28 amendment) — companion to
`test/portal-phone-frames.test.ts`'s CSS-text scan (which issues zero
requests and pins `PORTAL_CSS`'s text, so it cannot see markup at all).
Before writing a new render test, this lane checked for an existing one:
`test/portal-390-frame-verdicts.test.ts` (task w14-sd, already committed on
`main`) already dispatches real `app.request()` calls against `/portal`,
`/portal/tasks`, and `/portal/profile` and asserts H1/back-link/dock/
section structure in frame order — the three "Portal SSR 390 per-frame
render verdicts" entries above are its findings. That file is the
already-built companion for the bulk of this brief and is NOT duplicated
here. `test/portal-phone-frames.render.test.ts` (new, this task) isolates
the four assertion classes this task's brief names as their own directly
citable population — exactly-one-`<h1>` with text equality against the
frame's literal, dock-band cardinality (zero on the landing frame, one on
each drill frame), back-link presence on the two drill frames, and full
static control-label coverage — and surfaces two findings the order-only
checks above do not name:

1. **"Speaker portal" (:414-472) H1 literal, DIVERGES (new).** The frame's
   hero (:420, `Two things to do`) spells its count in words. The route's
   H1 (`src/routes/portal/index.tsx`) composes the same copy through
   `src/domain/count-copy.ts`'s `countOf` (DEC-925, the one count-phrase
   helper for the whole codebase), which always renders a numeral — with
   this task's 2-pending-task fixture the real text is `2 things to do`,
   not byte-equal to the frame's spelled-out `Two`. Read as illustrative
   mockup copy, not a literal requirement (DEC-925's helper is used
   uniformly across the tree and a numeral-vs-word difference is not a
   markup or geometry defect) — flagged for the planner in case a future
   ruling wants the frame's exact wording enforced instead.

2. **"Portal · Your profile" (:531-559) headshot control label, DIVERGES
   (new).** The frame draws a bordered pill labelled `Replace` at :541 for
   the headshot slot. `src/routes/portal/profile.tsx`'s empty-headshot
   state (this task's fixture has no `headshotUrl`) renders a plain
   `<label>Upload a new headshot<input type="file" ...></label>` instead —
   `Replace` renders nowhere in the body. Not previously named in this
   file's DEC-576/wave-16 entries (which cover the H1 and the dock's
   missing Cancel only); recorded here as a control-shape gap for the
   planner, not fixed by this lane.

## Frame :1561 "Portal · Resources" (GET /portal/resources) — MATCHES

The frame (:1554-1580) draws: back link, H1 "Resources", subtitle "The same
for every speaker · nothing here is about your session", per-resource rows,
and a footer note ("Questions? Reply to any of our emails.") with no docked
control. `ResourcesPage` (`src/routes/portal/tasks/resources.tsx` +
`src/routes/portal/tasks/views.tsx`) renders every element in that exact
order, including the deliberate absence of a dock — the only one of this
task's four frames with a clean render-through-the-route MATCH.
