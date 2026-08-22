# Portal/Submit v12 DESKTOP (1600) per-frame render verdicts (task w24-i, DEC-613/DEC-651 wave-24 amendments)

Per-frame render VERDICTS for seven of `Chautauqua Public and Portal.dc.html`'s
desktop and window-state frames — the CFP form's open state, its two closed
window states, the fresh-empty public sessions state, a rejected-on-submit
state, the desktop Portal edit view, and the organizer Portal preview —
entered through the app's real routes (`app.request(...)`) and asserted
against the returned HTML STRING. This supersedes
`test/desktop-frames-public.test.ts` and `test/desktop-frames-portal.test.ts`'s
citation-only claims for these seven frames specifically: every MATCHES/
DIVERGES row below was RENDERED off a real request, not merely cited against
source text. Receipts live in
`test/portal-submit-desktop-frame-verdicts.test.ts`. (Per DEC-099 wave-14m
clause 1, this sentence's own use of the word is a description of this
file's row-grammar, not itself a finding.)

**HARNESS RULE (DEC-613 wave-24 amendment):** every harness in that file is
copied unchanged from an existing `buildApp` — the mock-free `Hono<AppEnv>` +
`publicSubmitRoutes`/`publicRoutes` shape from
`test/public-390-frame-verdicts.test.ts` for the /submit and public-sessions
frames, and the four `vi.mock` blocks + `buildApp()` + `speakerAuth` from
`test/portal-390-frame-verdicts.test.ts` for the two /portal frames. Only
path, auth and fixture VALUES vary.

**STATE-DRIVEN, NEVER DIRECTLY MOUNTED (DEC-651 wave-24 amendment):** the two
CFP-window states and the fresh-empty sessions state are reached by setting
real fixture dates/row counts and letting the route's own
`formWindowState`/`isFresh` predicate decide the branch — never by importing
`ClosedPage`/`NotYetOpenPage` and mounting it directly.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no route module or `*.css.ts`, even where a real
divergence is found below.

## Frame :894 "Submit a talk · /submit/:slug" (open window state)

**MATCHES.** Entered via `GET /submit/:eventSlug` at the open window state
(`formWindowState` resolves `open` from a form with no `openDate`/
`closeDate`).

- The h1 reads `Submit a talk` (frame :902), rendered by
  `submit-views.tsx`'s `SubmitPage`.
- The Track/Format two-column row (frame :930-943, `display:grid;
  grid-template-columns:1fr 1fr; gap:18px`) MATCHES structurally —
  `.chq-cfp-track-format-row` wraps a `<legend>Track</legend>` fieldset
  beside a `<legend>Session format</legend>` fieldset, in that order.
  `test/desktop-frames-public.test.ts` already claimed the class token by
  source citation (`:894 Submit a talk -- the Track/Format two-column row is
  .chq-cfp-track-format-row`); this verdict is the first to prove the token
  actually renders in a real response.
- The dock (frame :989-990, `Submit this talk` primary + `Save draft`
  secondary) MATCHES both labels verbatim.

## Frame :1101 "CFP closed" (window state)

**MATCHES.** Entered via `GET /submit/:eventSlug` with a fixture
`closeDate` in the past — the SAME route as the open-state frame above,
driven into the closed branch by `formWindowState`, never by mounting
`ClosedPage` directly (DEC-651).

- Heading `The call for papers has closed` (frame :1103) MATCHES verbatim.
- Body opens `Submissions closed on` (frame :1104) MATCHES.
- The one link, `Browse the sessions ›` (frame :1107), MATCHES.
- Confirmed the branch is real, not an accident of a shared template: the
  same request never renders `.chq-cfp-track-format-row`, the open-state
  frame's own form-field marker.

## Frame :1532 "CFP not open yet · /submit/:slug" (window state)

**MATCHES** (DESIGN-RULINGS "CFP — the third window state"). Entered via
`GET /submit/:eventSlug` with a fixture `openDate` in the future, driven
into the `not_yet_open` branch by `formWindowState`.

- The heading LEADS with the date the form opens (`The call for papers
  opens on`, frame :1540) rather than an apology — the dateless
  "Submissions aren't open yet" wording DESIGN-RULINGS reserves for a form
  with no `open_date` set never renders for this (real-`openDate`)
  fixture.
- `You will not need an account.` (frame :1543's clause) MATCHES.
- DEC-986 (wave-130 amendment, cited in `submit-views.tsx`): the frame's
  "Three tracks, five formats." clause is deliberately NOT adopted here —
  `submit-get.tsx` returns before fetching tracks for this window state, so
  a track count would be fabricated. A previously-filed and settled
  divergence, not new debt.

## Frame :1167 "Public sessions · nothing published" (fresh-empty state)

**MATCHES.** Entered via `GET /e/:eventSlug/sessions` with a fixture that
resolves zero visible sessions — the route's own `isFresh` predicate
(`!anyFilterActive && grandTotal === 0`) decides the branch, never a
hand-set `SessionsContent` prop (DEC-651).

- The headline `The programme is not out yet` (frame :1174, adjacent
  reason sentence diverges — see below) renders inside
  `.chq-pub-sessions-fresh-layout`.
- **DIVERGENCE NAMED, not force-fit** (DEC-745 wave-107 amendment,
  restated here per this task's own instruction rather than re-filed): the
  frame's reason sentence names a CFP close DATE ("...closed on 16
  August."); this app's reason sentence
  ("Sessions appear here once the schedule is published.") stays, because
  a day label derived from a stored instant is a timezone bomb (DEC-522)
  and the bare close date is not actionable for a visitor with no CFP form
  to act on.
- The `Last year` aside (frame :1187-1198, a 300px `<aside>` linking the
  prior edition's session list) MATCHES. `test/desktop-frames-portal.test.ts`
  (branch v12m-w5-c) filed this as an unclaimed divergence ("No such
  feature exists anywhere in the tree"), and
  `test/public-sessions-lastyear.test.ts` later built it via a direct
  `SessionsContent(...)` call (predating DEC-651's wave-24 state-driving
  rule). This verdict is the first to prove it live off a REAL request:
  supplying a qualifying prior edition through the fixture db and letting
  the route's own `getPriorPublicEvent` call render the aside, unprompted
  by any hand-built prop.

## Frame :1211 "Submit a talk · rejected on submit" (state)

**MATCHES.** Entered via a real `POST /submit/:eventSlug` whose body
withholds a required field (`field__description`), supplies a malformed
email, and omits a track choice — a real product validation failure, not a
re-typing of the frame's own illustrative sample copy (an over-limit
abstract, an unpicked track, a malformed email).

- The top-of-form band (frame :1214-1220) MATCHES structurally:
  `.chq-error-summary[role="alert"]` opens with an `<h2>` reading "N things
  need fixing before this can be sent" (this fixture's own problem count —
  asserted via the shared `thingsNeedFixingHeading` stem, not a hardcoded
  "Three" the way the frame's sample happens to read), lists each problem
  as a link, and closes with "Nothing was lost. Everything you typed is
  still below." (frame :1220) verbatim.
- Both actions still render below the summary (frame :1290-1292, `Submit
  this talk` + `Save draft`) — the frame's own rule that nothing typed is
  discarded on a rejected submit.

## Frame :1373 "Portal · Edit your session · desktop" (form view)

**MATCHES** (DEC-029 wave-108). Entered via authenticated `GET
/portal/submissions/:id/edit` (speaker auth).

- `Edit your session` h1, `On this session` participant list section, and
  `Add a co-presenter` section all MATCH (frame :1387/:1418/:1444), in
  that order, inside exactly one `<form id="chq-portal-edit-form">`.
- **DEC-029 (wave-108): the co-presenter Add control is a SECOND SUBMIT of
  the one form, never a second `<form>`.** Every co-presenter input
  (`cp-first-name`, `cp-last-name`, `cp-role`) carries
  `form="chq-portal-edit-form"`, and the Add button additionally carries
  `formaction="/portal/submissions/:id/participants"` +
  `formenctype="multipart/form-data"` — so in-progress title/abstract/
  track edits ride along with an Add submission, exactly as the frame's
  footer row (`Cancel` / `Save changes`, frame :1465-1466) implies a single
  save surface.
- `test/desktop-frames-portal.test.ts` already claimed this frame's copy by
  source citation; this verdict is the first to prove the DEC-029 wiring
  live off a real authenticated request.

## Frame :1473 "Portal preview · /portal/preview" — DIVERGES

**DECIDED (DEC-613 wave-9 amendment):** the missing-capability question this
section previously escalated is now closed. The portal-390 harness's own
`vi.mock` set (`test/portal-390-frame-verdicts.test.ts`) was extended with
two more targets — `src/server/repo/events` (`getEventForOrg`) and
`src/server/repo/portal-config` (`getPortalSettingsForEvent`,
`listResourcesForEvent`) — rather than standing up a second, `makeChain`-
style fake-`db` stack. `c.set("db", {} as never)` stays valid because these
two additions are the only db reads `/portal/preview`'s handler makes. Any
future frame needing a repo this harness doesn't yet mock should extend
this same set again, never fork a new one. **Disposition of the four
findings below, per DEC-902 wave-14m** (a wording-only residual against a
v12 desktop frame is adjudicated, never deferred to the freeze — scope
guard: WORDING only, geometry/order residuals keep their prior
disposition): the **"Not shown here" chip wording/count** is a wording
residual, disposition (b) BLESSED — the tree's three chips name the real
domain concepts the route actually declines to load (submissions/tasks/
files, per `preview.tsx`'s own header comment), where the frame's
four-chip list includes two ("Their session", "Their notes") that
correspond to nothing this route withholds, so the shipped wording carries
MORE information than the frame's, not less. The **missing second Welcome
lede sentence** was a wording residual too, disposition (a) ADOPT, and is
now CLOSED (DEC-902 wave-19 clause (b)): the frame's fixed second sentence
carries information (a static reassurance) the organiser's own stored
welcome message cannot supply, so clause (b) settled it as APP-OWNED CHROME
— a separate node appended after the organiser's lede, never concatenated
into it, rendering even when `welcomeMessage` is null — and
src/routes/portal/preview.tsx`Everything we need from you is on this page, in order.`
 **Back-link placement** and
**meta-sentence order** are GEOMETRY/ORDER residuals. DEC-902's wave-20
amendment retires the reading that a geometry/order residual keeps a
standing exemption from the desktop freeze — the wording-only scope guard
was a scope limit on the wave-14m measurement lane, never a class
exemption, and both residuals now take the same two dispositions a wording
residual does. Both are DISCHARGED by task w20-g: **back-link placement**
takes disposition (a) ADOPT and is built — `preview.tsx` now renders the
link inside `.chq-portal-preview-banner` (`portal.css.ts`'s
`.chq-portal-preview-banner-link`), right-aligned beside the two sentences,
matching the frame's own placement, and the standalone bottom-of-page copy
the frame does not draw is deleted. **Meta-sentence order** also takes
disposition (a) ADOPT and is built — the "To see a real speaker's portal…"
sentence now renders as the last child of the "Not shown here" section,
after its chips, matching the frame's order.

**Now REACHED, and DIVERGES** off a real `GET /portal/preview` request
(organizer auth), asserted in `test/portal-390-frame-verdicts.test.ts`'s
own describe block for this frame. Structural anatomy matches (read-only
banner, Welcome hero + lede, Resources section, Not-shown-here section, in
that order), but four real divergences were named against
`docs/design/Chautauqua Public and Portal.dc.html` — each disposed under
DEC-902 wave-14m/wave-20, see the paragraphs above. Three are now CLOSED
(the Welcome lede's second sentence per wave-19 clause (b); back-link
placement and meta-sentence order per task w20-g); the fourth (the "Not
shown here" chip wording/count, disposition (b) BLESSED) is not a gap:

- **Back-link placement** — RESOLVED task w20-g (frame :1490 `<a href="#"
  style="margin-left:auto; font-size:13px; font-weight:700;
  white-space:nowrap">‹ Back to settings</a>`, drawn INSIDE the read-only
  banner card, right-aligned beside its two sentences): `preview.tsx` now
  renders the link inside the same banner card via
  `.chq-portal-preview-banner-link`; the standalone bottom-of-page copy is
  deleted. No longer a divergence.
- **Welcome lede is one sentence, not two** (frame :1495 `<span
  style="font-size:15px; line-height:1.65; color:#3F4237">Thanks for
  speaking at DevFlow. Everything we need from you is on this page, in
  order.</span>`) — **CLOSED (DEC-902 wave-19 clause (b))**: the frame's
  first sentence is the organiser's own stored welcome message in the
  frame's fictional world (DEC-967: frame sample data is not product
  copy) and stays data-driven; the frame's second sentence is APP-OWNED
  CHROME, appended as its own node after the organiser's lede — never
  concatenated into it, never replacing it — and rendered unconditionally,
  even when `welcomeMessage` is null. src/routes/portal/preview.tsx`Everything we need from you is on this page, in order.`
 , asserted off a real `GET /portal/preview`
  request in `test/portal-desktop-frame-verdicts.test.ts`.
- **"To see a real speaker's portal..." sentence order** — RESOLVED task
  w20-g (frame :1523 `<span style="display:block; padding:14px 0 0;
  font-size:13px; color:#565A4B; line-height:1.55">To see a real
  speaker's portal you would have to be them — this preview deliberately
  cannot.</span>`, trailed at the very END, after the "Not shown here"
  chips): `preview.tsx` now renders the identical sentence as the last
  child of the "Not shown here" `<section>`, after its chips, matching
  the frame's order. No longer a divergence.
- **"Not shown here" chip set** (frame :1518-1521, four chips: `Their
  tasks` / `Their session` / `Their files` / `Their notes`): the route
  renders three differently-worded chips instead — `Their submissions` /
  `Their tasks` / `Their uploaded files` (`preview.tsx`'s own header
  comment draws this list from what the route declines to load —
  submissions/tasks/files — never from the frame's four-chip wording).
  Neither "Their session" nor "Their notes" render at all.

Named here rather than force-fit (the desktop freeze this document's
preamble states): no desktop byte was moved to produce this verdict.

**Superseding note:** this file's own "## 2. `:1473` ... MATCHES" section
below (task w26-h, via `test/portal-desktop-frame-verdicts.test.ts`) checked
structural anatomy and order only — its `expectInOrder` needles never
verbatim-quoted the frame's back-link/lede/chip lines above, so it did not
catch these four divergences. That section is left as-is (disjoint task,
disjoint file) but should be read alongside this one, not as a conflicting
verdict: "matches in the ways it checked" and "diverges in the ways this
section additionally checked" are both true statements about the same
render.

## Summary

| Frame | Verdict |
| --- | --- |
| :894 Submit a talk · /submit/:slug (open) | MATCHES |
| :1101 CFP closed | MATCHES |
| :1532 CFP not open yet · /submit/:slug | MATCHES |
| :1167 Public sessions · nothing published | MATCHES (reason-sentence divergence, DEC-745, previously filed) |
| :1211 Submit a talk · rejected on submit | MATCHES |
| :1373 Portal · Edit your session · desktop | MATCHES (DEC-029) |
| :1473 Portal preview · /portal/preview | DIVERGES (back-link placement, meta-sentence order — one-sentence lede CLOSED wave-19 clause (b), "Not shown here" chip wording/count BLESSED — DEC-902 wave-14m/wave-19 disposition, see section above) |

5 of 7 frames MATCH as rendered off a real request; one previously-filed,
already-adjudicated reason-sentence divergence (:1167, DEC-745/DEC-522)
carries forward unchanged; :1473 is now REACHED via the portal-390
harness's extended `vi.mock` set (DEC-613 wave-9 amendment) and DIVERGES in
four named ways. No desktop byte was moved to produce this verdict.

---

<!-- Two independently-authored ledgers landed at this same path in the
     Thunderdome megabatch (task w24-i above, task w26-h below). Both are
     kept whole: they cover disjoint frame sets and neither supersedes the
     other. -->

# Portal + public-empty SSR desktop frame verdicts (task w26-h)

3 of Public-and-Portal's 13 desktop frames — the last three no ledger owns.

`docs/design/audit/desktop-frame-ledger-v12.md`'s population lists 108
desktop frames across the pack, 20 of them in
`docs/design/Chautauqua Public and Portal.dc.html`. That ledger's own
"Divergences found while claiming" section records that its six
portal/refusal frames (:1101, :1167, :1211, :1373, :1473, :1532) are
"claimed by `test/desktop-frames-portal.test.ts`, which asserts all six by
line number ... RESOLVED, not a gap in this ledger" — but
`test/desktop-frames-portal.test.ts` is a **source scan**
(`readFileSync` over `src/routes/...` plus a nearby `expect()`, never a
dispatched request), the same "SSR phone-frames tests were source scans not
requests" shape wave-25's field-guide entry names for the phone half. A
citation is not a render (DEC-967). This file supplies the missing render
verdict for the three of those six frames this task was assigned — :1373,
:1473, :1167 — via `test/portal-desktop-frame-verdicts.test.ts`, which
dispatches a real request through a `Hono<AppEnv>` with the actual route
sub-app mounted and asserts the returned HTML string's structure and order.

**Sibling lanes** — RETIRED task w20-g (DEC-902): the two bullets below
used to read `:1101`/`:1211`/`:1532` "remain source-scan-only, still open
for a future render-verdict lane" and `:28`/`:132`/`:249`/`:680`/`:730`/
`:779`/`:894` "claimed by `test/desktop-frames-public.test.ts` (also a
source scan)". Both are FALSE at main: `test/cfp-desktop-frame-verdicts.test.ts`
dispatches real requests through a bare `Hono<AppEnv>` with
`publicRoutes` and `publicSubmitRoutes` mounted (`app.request(...)`, no
`readFileSync`) and verdicts :894/:1101/:1211/:1532; `test/public-desktop-frame-verdicts.test.ts`
carries its own `PUBLIC SSR desktop (1600) frame
render verdicts` describe block, likewise real requests, and verdicts
:28/:132/:249/:680/:730/:779. Neither is a source scan any longer:

- `:1101` (CFP closed), `:1211` (Submit a talk · rejected on submit),
  `:1532` (CFP not open yet), and `:894` (Submit a talk · open) are
  render-verdicted by `test/cfp-desktop-frame-verdicts.test.ts`
  (bare-path citation per DEC-967: no `:line`, resolved against the whole
  file).
- `:28, :132, :249, :680, :730, :779` — six of the seven non-portal public
  frames in this file — are render-verdicted by `test/public-desktop-frame-verdicts.test.ts`
  (bare-path citation, same reason).
- The remaining Public-and-Portal desktop frames (:1017-1211's internal
  CFP-flow states not named above, Submitted states, etc.) sit outside
  both this task and the two render-verdict files above.

MEASUREMENT ONLY (DEC-651 wave-26): this task fixed nothing, and touched no
route module and no `.css.ts`.

## 1. `:1373` "Portal · Edit your session · desktop" — MATCHES

`GET /portal/submissions/:id/edit` (`src/routes/portal/edit.tsx`'s
`EditPage`). Back link, H1, Title/Abstract/Session-length fields, the
"On this session" participants list, the "Add a co-presenter" section, and
the terminal Cancel/Save row all render in the frame's own top-to-bottom
order.

The one clause this task's brief called out by name — that the co-presenter
controls are a **second submit of `#chq-portal-edit-form`**, not a second
form (DEC-029's wave-108/114 amendment) — verdicts true: every co-presenter
input (`cp-first-name`, `cp-last-name`, `cp-email`, `cp-role`) carries
`form="chq-portal-edit-form"`, and the "Add co-presenter" button carries
`formaction="/portal/submissions/:id/participants"
formenctype="multipart/form-data"` on that same form id rather than opening
a form of its own. The page renders exactly three `<form>` elements total:
the one edit form, plus PortalLayout's own two shared sign-out forms
(header + footer, DEC-154 chrome every `/portal/*` page carries) — never a
fourth, standalone co-presenter form. The frame draws this section inline
below "On this session" with no visual seam marking it as a second door,
which is exactly what the second-submit wiring produces: one page, one
form, two submit buttons.

Not asserted: the frame's own `560px` "one portal view with a form" note.
That is a already-adjudicated, already-cited deviation
(`docs/design/DEVIATIONS.md` §6, "Portal measure WIDENED against the
frames: `--chq-portal-measure` 560px (drawn) -> `var(--chq-measure)` (the
820px admin/overview measure)", confirmed live at
`src/routes/portal/portal.css.ts:328`) — re-asserting it here would just be
a second citation of the same ruling, not a new finding.

## 2. `:1473` "Portal preview · /portal/preview" — MATCHES

`GET /portal/preview` (`src/routes/portal/preview.tsx`'s `PreviewPage`,
organizer-only). The identity slot ("Preview · no speaker"), the "Preview ·
read-only" banner (with the frame's own explanatory sentence verbatim), the
Welcome hero + configured welcome message, the Resources section, the "Not
shown here" chip row (Their submissions / Their tasks / Their uploaded
files), and the "‹ Back to settings" link all render in the frame's own
order. The one sanctioned disabled control (`Download`, DEC-747) is present
and inert; no other mutating control appears anywhere in the content the
frame draws — the page's only `<form>` is PortalLayout's shared footer
sign-out, chrome the frame's own annotation ("An organiser looking in · not
an impersonation") never depicts as part of this screen's content.

## 3. `:1167` "Public sessions · nothing published" — MATCHES

`GET /e/:eventSlug/sessions`, fresh-and-empty branch
(`src/routes/public/sessions.tsx`'s `SessionsContent`, fed by
`dispatch.tsx`'s `renderSurfaceContent`). This is the frame this task's
sibling ledger's own `test/desktop-frames-portal.test.ts` leaves
**UNCLAIMED**, with a header comment stating the frame's "Last year" aside
"has no feature behind it anywhere in the tree" (`grep -rn "Last year" src/`
returning nothing, as of that file's own wave). That claim has rotted
(DEC-976's recurring "grep the tree, not the ledger's own claim" lesson,
restated at field-guide waves 17/21/25/26): src/routes/public/dispatch.tsx`getPriorPublicEvent`
now calls this (DEC-745, wave-107 amendment) exactly on the
fresh-empty branch, and `sessions.tsx`'s `.chq-pub-lastyear-rail` renders
its result — the "Last year" aside genuinely exists and is wired end to
end. This file's render verdict supersedes that stale UNCLAIMED note for
:1167 specifically (the other two frames `test/desktop-frames-portal.test.ts`
marks UNCLAIMED-or-partial, `:1373`'s 560px note and any other file's own
findings, are untouched here).

Verdicted: the filter chrome (`chq-pub-filter-row`/`chq-pub-active-filters`)
is hidden entirely on the fresh-empty branch, matching DESIGN-RULINGS.md
B7's "fresh and empty hides the filter chrome entirely" rule and the
frame's own chrome-free anatomy at :1167-1210; the headline "The programme
is not out yet" renders via `PublicEmptyState`'s `fresh` variant; the
"Last year" aside names the prior event (`DevFlow Conf 2026`), its session
count ("48 sessions"), and a "Sessions ›" link to that event's own sessions
surface, matching the frame's card at :1187-1198 in shape (name, count,
escape link) — the visitor-facing structure the frame draws is what
renders.

One divergence, already named in this file's own source comment
(`sessions.tsx`, above the `PublicEmptyState` call) and left as-is per this
task's measurement-only scope: the frame's reason sentence names a CFP
close **date** ("The call for papers closed on 16 August."); the shipped
copy reads "Sessions appear here once the schedule is published." instead.
The comment there records why: a day label rendered as a headline sentence
without going through the event's own timezone is exactly DEC-522's
"day label from a sub-day clock offset is a timezone bomb" failure mode,
and DESIGN-RULINGS.md B7 rule 2 ("give the reason only when it is
actionable") does not require a bare close date specifically — this is a
considered, in-code-commented adjudication, not an oversight, so it is
named here rather than asserted around.

No button renders on this branch — B7 rule 3 ("no button at all" when the
visitor cannot act) and `PublicEmptyState`'s own `fresh` variant (which has
no action prop at all, by construction) agree, and the "Last year" aside's
own link is a plain `<a>` navigational escape to a different event's
surface, never a `.chq-btn-primary`.
