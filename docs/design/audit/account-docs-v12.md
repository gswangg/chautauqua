# Account + Docs v12 phone conformance — audit findings

Findings surfaced while implementing w1-h (TIER 1: Account cluster's two
phone frames + the Docs article phone frame, SSR).

## Sign in · 390 omits "Forgot your password?" from the phone submit row

**Frame**: docs/design/Chautauqua Account.dc.html:121-141 ("Sign in · 390").
The desktop twin (top of the same file, "Sign in · a card, not a stretched
phone") draws `Forgot your password?` inline with the Sign in button
(`justify-content:space-between`). The 390 mockup's submit row (:127-136)
draws only the full-width Sign in action — no tertiary link at all, at any
position.

**Why not a straight cut**: DESIGN-RULINGS's corollary ("a centred card is
not a desktop design just because it is centred... full-column buttons ...
are phone anatomy") licenses the full-width button; nothing in it, or in
DEVIATIONS.md, licenses dropping live navigation. A geometry frame is not by
itself grounds to delete a working link — the omission reads as the
mockup's own scenario simplification (an entry point that just needs "Sign
in" drawn large), not a deliberate "no reset path on phone" ruling.

**What this task did**: kept `Forgot your password?` (`.chq-auth-tertiary`),
restacked `.chq-auth-submitrow` to `flex-direction: column-reverse` at
<=700px so the full-width primary action sits first and the tertiary link
sits centred beneath it at the 44px floor — narrowest reading that satisfies
both the frame's full-width-button geometry and DESIGN-RULINGS' phone-vs-
desktop-anatomy split without removing functionality. Flagged here per this
task's design-gap instruction rather than escalated, since the narrow
interpretation is defensible and low-risk to revise later.

**RESOLVED-BY-RULING (DEC-919 wave-114 amendment)**: the link stays,
re-lined, per the ruling recorded in DEVIATIONS.md §3 ("Interpretations
where the frames underspecify") — see the "Sign-in 390 keeps 'Forgot your
password?', re-lined" bullet there for the full ruling and its grounds. No
further code change is needed; the shipped treatment described above
already implements it.

**Correction, wave 116 (v12m-w5-aa, DEC-919/DEC-967)**: "no further code
change is needed" was false. A `.chq-auth-stack .chq-auth-tertiary {
display: none; }` rule (`src/routes/auth.css.ts`, added wave-101, after
this finding was filed) out-specified the re-line and erased the link from
the 390 screen — the exact frame this finding names. The hide rule is
deleted this wave; the re-line described above now actually reaches
/login. See `docs/design/audit/tap-floor-v12.md`'s wave-116 correction for
the counted-offender side of this same defect.

## The auth input fill (#FFFFFF) — DEVIATIONS §6, untouched

Frame lines 130/134/161/165/169 (docs/design/Chautauqua Account.dc.html)
sample the phone card's email/password inputs at `background:#FAF8F2`
(`--chq-surface`), which already matches `.chq-auth-card input[...]`'s
existing fill — no `#FFFFFF` literal appears on either 390 frame this task
touched, so DEVIATIONS §6's recorded verdict (desktop's own input fill vs
the palette-closure ban — RULED: the app keeps `--chq-surface`, no change,
DEC-383 wave-114 amendment) is out of scope here and was left exactly as-is,
per the task's explicit instruction not to touch it.

## Docs · an article · 390 — Contents disclosure now built (RESOLVED wave 27, task w27-c)

**Frame**: docs/design/Chautauqua Docs.dc.html:166-204 ("Docs · an article ·
390"). The mockup draws a dedicated phone header band: `‹ Docs` back link on
the left, a `Contents` trigger on the right (:167-169) — implying a mobile
table-of-contents drawer/sheet, replacing the desktop brandrow+search+
leaving-link header entirely at phone widths.

**RESOLVED** (DEC-976: the pin moves with the fix): the gap this row
described is closed. src/routes/docs-site.tsx`chq-docs-phone-toolbar`
renders, carrying BOTH the `‹ Docs` back link and a
`Contents` trigger — a checkbox+label disclosure (`chq-docs-contents-
checkbox` / `chq-docs-contents-toggle`, the same `sr-only-checkbox` idiom
as `.chq-itinerary-toggle`) with `aria-controls="chq-docs-nav"` that
re-lines the EXISTING `DocsNav` element rather than mounting a second copy
of the article vocabulary (DEC-613; no second nav). Native checkbox
semantics make it keyboard-operable (Tab + Space) with no JS and no
framework. This was built at DEC-990 wave-128, and this file's own later
"w14-sg per-frame 390 RENDER verdicts" section already recorded it as
MATCHES against a live request through the mounted route
(`test/home-account-docs-390-frame-verdicts.test.ts`) — the standing
finding above simply never caught up to that section's own knowledge, and
is closed here.

**Historical note (superseded)**: this row previously claimed the phone
Contents disclosure was absent from the codebase — that was accurate for
the wave that wrote it but is not accurate against the current tree; kept
only as the pointer the RESOLVED citation above closes out.

## What this task did fix (docs-site.css.ts)

- `.chq-docs-figure`/`.chq-docs-figure-frame` edge-to-edge treatment
  (already landed pre-task) now carries an explicit `docs/design/Chautauqua
  Docs.dc.html:183/184` citation per DEC-976, confirmed against the frame's
  no-side-margin figure and top/bottom-only hairline frame.
- `.chq-docs-article-head h1`'s existing 28px already matched the frame
  (:175) — pinned in test/account-docs-phone-frames.test.ts rather than
  restated.
- `.chq-docs-pager`/`.chq-docs-pager-prev`/`.chq-docs-pager-next` gained a
  phone-only override: the frame's filled, edge-to-edge Previous/Next
  button bar (:200-202) replaces the desktop's bare `--chq-rule` divider +
  plain links, which previously had no phone treatment at all.

## w14-sg per-frame 390 RENDER verdicts (DEC-976 wave-158 SSR clause)

Every row below is a real Hono request through the mounted route, asserted
against the returned HTML string, in
`test/home-account-docs-390-frame-verdicts.test.ts` — additive to, and
never replacing, `test/account-docs-phone-frames.test.ts`'s existing
stylesheet-source-scan coverage (that file never calls `app.request`, so
these rows are the first live-request receipt these two frames have had).
Home's three states have no `docs/design/audit/home-v12.md` to file into
(per DEC-976 wave-105's note that a cluster with no audit doc files its
verdicts in the test file's own header instead) — see
`test/home-account-docs-390-frame-verdicts.test.ts`'s top-of-file comment
for those three rows.

- **"Sign in · 390" (Chautauqua Account.dc.html:121)** — MATCHES on
  wordmark, the single-event-scoped subtitle ("Sign in to
  {event.name}"), Email/Password, Sign in, and both "No account?" links
  (Submit a talk / Browse the sessions). DIVERGES on the "Forgot your
  password?" tertiary link: :121's drawn card carries no such link
  anywhere in its submit row (confirmed against the file — the only
  "Forgot your password?" text on Chautauqua Account.dc.html sits at :50
  and :317, both desktop/error-state blocks, never inside the 390 card),
  while `src/routes/auth-views.tsx:125-127` renders it unconditionally.
  This divergence is the SAME one this file's own earlier finding above
  ("Sign in · 390 omits 'Forgot your password?' from the phone submit
  row") already tracked and DEC-919 already RULED BLESSED (re-line, never
  remove) — restated here only because this is the first LIVE-REQUEST
  receipt of it, not a new finding.
- **"Change password · 390" (Chautauqua Account.dc.html:153)** — MATCHES
  on the "‹ Back" link, the "Change your password" H1, all three fields
  (Current password / New password, placeholder "At least 12 characters",
  matching `MIN_PASSWORD_LENGTH = 12` / New password again), and the sunk
  dock's two buttons ("Change it" primary, "Cancel" secondary). One
  addition the frame is silent on rather than a divergence from it: the
  dock also carries a "You stay signed in on this device" hint span that
  :153's dock does not draw at all — the frame neither confirms nor
  forbids it (no equivalent element exists to contradict), so this is
  filed as an addition, not a MATCHES/DIVERGES call.
- **"Docs · an article" (Chautauqua Docs.dc.html:166, GET
  /docs/reviewing-start-to-finish)** — MATCHES on the phone toolbar ("‹
  Docs" back link + "Contents" disclosure toggle, already built per
  DEC-990 wave-128 and cited at `src/routes/docs-site.tsx:488-508`), the
  article-head anatomy (eyebrow span, H1, standfirst paragraph), and a
  rendered `<h2 class="chq-docs-h2">` heading block. The frame's own H1
  text ("Triaging submissions") and body copy are illustrative mockup
  prose with no matching slug in `DOCS_ARTICLES` — graded on the
  STRUCTURE the frame draws (eyebrow/H1/standfirst/heading), not on a
  verbatim content match, since no real article's copy is a candidate for
  verbatim comparison against invented mockup text.

## Request verdicts (wave 28)

**Finding first, before the rows below: this population is already
covered.** `test/home-account-docs-390-frame-verdicts.test.ts` (landed
w14-sg, DEC-976 wave-158) already issues real requests and asserts
returned-HTML markup for all six of these same frames — Home's three
states plus both rows this section adds request coverage for. This task's
own brief ("VERIFIED: both existing files issue zero requests") is true of
`test/home-phone-frames.test.ts` / `test/account-docs-phone-frames.test.ts`
(the CSS-text pins, still true, still zero `app.request` calls) but stale
about the CLUSTER as a whole — a companion file closing exactly this gap
already exists and predates this task by several waves. The two new files
below are still real, passing, citation-contract-compliant additions (finer
per-`expect()` granularity tied to exact body lines, one assertion per
frame anatomy piece rather than one broad per-frame verdict) and do not
conflict with w14-sg's rows, but a planner auditing "which 390 frames still
lack a request verdict" should grep
`test/home-account-docs-390-frame-verdicts.test.ts` before scheduling
another lane here — this is the same ledger-rot pattern the field guide
names almost every wave (a claimed gap that was already closed upstream).

Covers both clusters named in this section's own citation contract: Home's
three 390 states (no dedicated `home-v12.md`, filed here per this doc's own
existing w14-sg precedent above) and this doc's own two Account rows plus
the one Docs row.

- **"Event hub · phone" (Chautauqua Home.dc.html:113, GET / full state)**
  — MATCHES. `test/home-phone-frames.render.test.ts`: exactly one `<h1>`
  reading "Events"; header "Sign in" present with no back link and no
  `data-chq-phone-dock` band (the anonymous hub mounts no shell tab-bar to
  stand down); "Submit a talk" and the footer's "API docs" (→
  `/docs/api`) both present.
- **"Between cycles · phone" (Chautauqua Home.dc.html:228, GET / with only
  a past event)** — MATCHES. `test/home-phone-frames.render.test.ts`:
  `<h1>` reads "No open calls right now"; archive row's "Sessions ›"
  present; footer "API docs" present (the between-cycles-only
  `.chq-home-footer-link-end-phone` anchor test/public-home-phone.test.ts
  already pins at the CSS level).
- **"Fresh deploy · phone" (Chautauqua Home.dc.html:299, GET / with no
  org)** — MATCHES. `test/home-phone-frames.render.test.ts`: `<h1>` reads
  "Nothing here yet"; body "Sign in" CTA present (a second occurrence
  beside the header's own); "API docs ›" present and — this frame's own
  footer draws no trailing "API docs" anchor (unlike the other two states)
  — `/docs/api` appears exactly once in the body, from the body CTA alone.
- **"Sign in · 390" (Chautauqua Account.dc.html:121, GET /login)** —
  MATCHES on the wordmark-as-H1 ("chautauqua"), no back link / no dock
  band, the submit control's own "Sign in" label, and both "No account?"
  links ("Submit a talk", "Browse the sessions") for a single visible
  event. `test/account-docs-phone-frames.render.test.ts`. (The "Forgot
  your password?" divergence this doc already tracks above is a DIFFERENT
  frame region — the submit row, not the H1/footer-link membership this
  file asserts — and is not re-checked here.)
- **"Change password · 390" (Chautauqua Account.dc.html:153, GET
  /account/password)** — MATCHES on the `<h1>` "Change your password",
  the drawn "‹ Back" link, and both footer controls ("Change it", "Cancel"
  → the organizer's `/admin` back-href). `test/account-docs-phone-
  frames.render.test.ts`.
- **"Docs · an article · 390" (Chautauqua Docs.dc.html:166, GET
  /docs/call-for-papers-and-submissions)** — MATCHES (structural). Exactly
  one `<h1>`; the drawn "‹ Docs" back link and "Contents" toggle present,
  no dock band; the figure block renders (`class="chq-docs-figure"`); the
  pager's prev/next controls render. As this doc's own w14-sg section
  already notes for this same frame, the H1 text ("Triaging submissions")
  and the pager's "‹ Previous"/"Next ›" literals are illustrative mockup
  copy with no real-content equivalent — this file asserts the requested
  article's OWN real title and its real neighbours' titles (Start here /
  Speakers, tasks and content) render in the corresponding slots, rather
  than a verbatim match against invented placeholder text.
  `test/account-docs-phone-frames.render.test.ts`.
