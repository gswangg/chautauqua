# Submissions v12 phone audit (task w1-c)

Findings surfaced auditing `docs/design/Chautauqua Submissions.dc.html`
('Submissions' 390 at :137, 'Submission detail' 390 at :355) against
`app/src/pages/submissions/submissions.css` and `detail.css`'s phone
(`max-width:700px`) blocks. Fixable items landed in this task; the items
below need a decision or land outside this task's scope
(`app/src/pages/submissions/**` only, no page header/footer band).

1. **Submission detail's decision bar wants a sticky footer, not an
   in-body rail.** Frame :355 lines 388-392 draw Accept/Decline/Wait as a
   `flex-shrink:0` band pinned below the scrollable body
   (`border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px
   16px`), outside the `overflow-y:auto` content area — never in the
   aside/rail flow the desktop 1600px subscreen uses (frame lines
   305-317). The current code keeps `.chq-detail-decision-rail` inside
   `.chq-detail-aside`, in the scrolling body, at every width; task w1-c
   fixed its in-body geometry (primary 46px / secondary pair 44px, matching
   frame lines 311/314) but did not relocate it, per this task's explicit
   scope note ("must NOT build a page header/footer band" — the sticky
   footer needs the shell scaffold landing in v12m-w1-a). Once that
   scaffold exists, this rail's phone variant should move into it instead
   of reflowing in place.

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
