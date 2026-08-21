# Submissions v12 phone audit (task w1-c)

Findings surfaced auditing `docs/design/Chautauqua Submissions.dc.html`
('Submissions' 390 at :137, 'Submission detail' 390 at :355) against
`app/src/pages/submissions/submissions.css` and `detail.css`'s phone
(`max-width:700px`) blocks. Fixable items landed in this task; the items
below need a decision or land outside this task's scope
(`app/src/pages/submissions/**` only, no page header/footer band).

1. **RESOLVED.** Frame :355 lines 388-392 draw Accept/Decline/Wait as a
   `flex-shrink:0` band pinned below the scrollable body
   (`border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px
   16px`), outside the `overflow-y:auto` content area — never in the
   aside/rail flow the desktop 1600px subscreen uses (frame lines
   305-317). `SubmissionDetailPage.tsx` now renders
   `.chq-detail-decision-rail` inside `.chq-phone-dock` at 390 (rather than
   inside `.chq-detail-aside`, in the scrolling body), with dock-specific
   geometry at app/src/pages/submissions/detail.css`.chq-phone-dock .chq-detail-decision-rail`
   (drift-proof citation, DEC-967 wave-115) / `.chq-detail-decision-primary`, per DEC-610.

2. **Submissions :137's phone head chipstrip is a simpler control set than
   the app's status-filter row.** The frame's chip strip (lines 148-152)
   is exactly three chips — "Needs triage" / "Accepted" / "All 47" — with
   no track selector, divider, or column picker visible. The app's
   `.chq-submissions-filterbar` carries the full desktop toolbar (a
   "Status" caption, up to six `SUBMISSION_STATUSES` pills, a divider, the
   track `<select>`, and the `ColumnPicker` `<details>`) reflowed into one
   horizontal scroller at phone width. Task w1-c fixed the scroller's chip
   geometry (7px gap, 44px/13px-padding/radius-99 chips, ink-filled active
   state) to match the frame's drawn chips, but left the wider
   composition question — whether the track select/column picker/divider
   should be hidden or relocated at phone width to match the frame's
   3-chip head — unresolved. That is a content/IA decision, not a CSS
   geometry fix, and belongs to a design ruling, not this task's narrow
   interpretation.

3. **Submissions :137's app-shell chrome (logo bar, event-name pill,
   bottom tab bar) is out of this file set's scope.** Frame lines 138-142
   (top bar) and 173-180 (bottom tab bar) are drawn as part of the 390
   device frame but live in `App.tsx`/the shared shell, not under
   `app/src/pages/submissions/**`. Not audited here; flagging so the shell
   task doesn't miss that Submissions' own 390 frame is one of the
   reference frames for that chrome.

## Per-frame render-verdict ledger (task w14-sb, DEC-976 wave-157)

Measurement only (fixes nothing): each frame entered through its real
route/page component and rendered against `docs/design/Chautauqua
Submissions.dc.html`, receipts at
`app/src/pages/Submissions.frame-verdicts.render.test.tsx`.

4. **Frame :137 "Submissions" — DIVERGES.** The head band (H1 `Submissions`
   at :144, the `12 awaiting triage` summary, the 44px search field at
   :147, the status chip strip at :148-151) renders in the frame's own
   top-to-bottom order. Two divergences: (a) the frame's filled/active
   first chip reads "Needs triage" (:149); the real control's own
   vocabulary (`STATUS_LABELS`) reads "Pending" — never the frame's copy.
   (b) the worklist itself is a desktop `<table>` (`role="cell"` cells for
   ref/title/speakers/tracks/status/date/custom-columns/clone, then the
   `role="group"` triage actions), not the frame's standalone stacked
   card — extra columns interleave between the frame's four content blocks
   (ref → title → speakers → actions). The triage row's own action triple
   itself — Accept/Decline/Read (:165-167) — is present in the frame's
   exact order.

5. **Frame :355 "Submission detail" — DIVERGES (clause (a) live; clause (b)
   CLOSED).** Ref/eyebrow → title (:362) → byline (:363) → abstract (:367)
   → form answers → reviews (:375) render in the frame's own block order,
   with real content (`DFC-033`, `Dana Whitmore · Fieldnote Docs`, the
   abstract paragraph) present exactly where the frame draws it. (a) LIVE:
   the back link (:358) keeps its full desktop text ("All submissions") as
   one span on the SAME anchor, with a second short span ("Triage")
   alongside it — never the frame's own bare "‹ Triage" text (DEC-919
   wave-98's deliberate one-anchor-two-spans shape). This half is not this
   task's to fix or to close. (b) **CLOSED (commit 023e1257, DEC-878 wave-16
   amendment).** Both the Abstract and Form answers `<h2>` elements keep
   `chq-detail-section-title` and additionally carry
   `chq-detail-section-title-frameless`, whose rule — inside
   `app/src/pages/submissions/detail.css`'s ONE terminal
   `max-width:700px` block (the file's only phone layer) — applies the
   house visually-hidden clip recipe (`position:absolute; left:-9999px;
   width:1px; height:1px; clip:rect(0,0,0,0)`), never `display:none`. At
   390 this now matches the frame's drawn anatomy exactly: the abstract
   paragraph and answer rows sit directly under the title/byline with no
   heading visually drawn above either. Desktop is byte-identical — the
   class only exists inside the phone block, so `.chq-detail-section-title`
   itself is untouched above 700px. The heading keeps its DOM position,
   text, and `<h2>` level and stays in the accessibility tree, so no
   capability is removed (visual-only stand-down, DEC-919 wave-98's
   capability-removal receipt is satisfied by construction — see
   `app/src/pages/submissions/detail-390-headings.test.ts`).

6. **Frame :468 "CFP form · 390" — DIVERGES (route: the admin form
   BUILDER, `app/src/pages/forms/FormsPage.tsx`, per this task's
   disambiguation, not the public SSR CFP).** The back link "‹
   Submissions" (:470), H1 "CFP form" (:471), the field-list row's drag
   handle "⋮⋮" (:476) and boxed "Edit" pill (:481), the phone "Add a
   question" dashed control (:484), and the fixed footer's "Save the
   form" + "Preview" pair (:486) all render in the frame's own order and
   text. Two divergences: (a) the meta line under the H1 (:472) spells out
   the close date's year — "Closes 16 Aug 2025 · 47 received" — where the
   frame's own copy carries no year ("Closes 16 Aug · 47 received"),
   because `formatDateOnly` always includes one. (b) each field row also
   renders a "Delete" button beside "Edit" that the frame's row (:475-481)
   never draws (frame shows one action pill only).
