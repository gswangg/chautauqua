# "Contact · 390" frame verdict (task w31-b, DEC-976 wave-31)

Frame: `docs/design/Chautauqua Contacts.dc.html:407-437` ("Contact · 390" —
"the errand you actually run on a phone"). Before this task the frame was
the worst-covered unclaimed frame in the population: 5 of 11 drawn
literals were asserted (by `app/src/pages/contacts/contacts-phone-frames.test.ts`'s
CSS-text pins and `ContactDrawer.phoneRead.render.test.tsx`'s behaviour
checks), and nothing rendered the real DOM against the frame's own drawn
order. `ContactDrawer.frame390.render.test.tsx` (new, this task) mounts
the real `ContactDrawer` — the exact harness
`ContactDrawer.phoneRead.render.test.tsx` already uses, copied verbatim
per DEC-663 — and now asserts all 11 drawn literals, in drawn order,
against the live DOM plus a CSS-text receipt over
`contacts-panels.css`'s single terminal `max-width:700px` block. Every
row below is MATCHES; the file changes nothing else — no code fix was
needed once the real DOM was checked line-by-line.

## Drawn-literal verdict, in frame order

| Frame line(s) | Drawn value | Shipped value | Verdict |
| --- | --- | --- | --- |
| `:409` | `‹ Contacts` back link, `min-height:44px` | `ModalFrame`'s `backLink` prop renders a `.chq-phone-back` button reading `‹ Contacts`, wired to the same `onClose` the header Close control uses (`app/src/pages/contacts/ContactDrawer.tsx`\`backLink={{ label: '‹ Contacts', onClick: onClose }}\`) | MATCHES |
| `:410` | `<h1>` name (SHAPE — the frame's own "Priya Raman" is sample data, never pinned) | `ModalFrame`'s `.chq-modal-title` (`25px/700/-0.04em/1.05`, matching the frame's own type exactly), rendered as the "First Last" the loaded contact carries | MATCHES (title register); heading-level (`<h1>` vs `<h2>`) is a pre-existing, already-SETTLED divergence — see "Known, already-adjudicated divergences" below, not reopened here |
| `:411` | `<company> · <title>` identity line (SHAPE) | `ContactDrawer.tsx`'s `drawerSubtitle`, passed to `ModalFrame`'s `subtitle`, joining company/title with ` · ` when both are present | MATCHES |
| `:413-416` | Body section eyebrow, `{{ g.name }}` (SHAPE, template-driven) | Each `FieldGroup`'s `.chq-section-head`/`.chq-section-label` (Contact, Profile, `currentEventName ?? 'On this event'`, Notes, in that order) | MATCHES (shape — group naming is the app's own record structure, the frame draws no fixed group list) |
| `:417-420` | Record row: label eyebrow (`{{ c.label }}`, 11/800 uppercase) above value (`{{ c.value }}`) | `.chq-contacts-record-row` > `.chq-contacts-record-label` + value (button on desktop, inert `.chq-contacts-record-readonly` span in phone READ mode, DEC-959) | MATCHES |
| `:424-425` | `Across your events` eyebrow (literal, not templated) | `<h3 className="chq-contacts-drawer-section-title">Across your events</h3>` | MATCHES |
| `:427-430` | History row: `{{ h.event }}` / `{{ h.what }}` (SHAPE) | `.chq-contacts-history-row` > `.chq-contacts-history-event` + `.chq-contacts-history-what`, one per `buildHistoryRows()` entry | MATCHES |
| `:433` | Footer dock band, `padding:12px 16px 16px; display:flex; gap:8px` | Shell-shared `.chq-phone-dock` (`app/src/styles.css`, not owned by this task, reused per DEC-613 wave-93) | MATCHES — receipted directly against the shared rule, not re-declared here |
| `:434` | `Email Priya` (SHAPE: `Email <first name>`), `flex:1`, `min-height:48px` | Dock's primary button, `{firstName.trim() ? `Email ${firstName.trim()}` : 'Email'}` | MATCHES |
| `:435` | `Edit`, `min-height:48px`, `padding:0 16px` | Dock's secondary button, `onClick={() => setPhoneEditing(true)}` | MATCHES |
| n/a (companion CSS) | — | `contacts-panels.css`'s one terminal `max-width:700px` block blanks `.chq-contacts-drawer .chq-modal-close-btn` — the drill's back link substitutes for the shared `ModalFrame` header Close so the drawer never draws a second, frame-silent escape | MATCHES (pinned by this task's new test's CSS-text assertion) |

11 of 11 drawn literals now asserted (up from 5). No `MAY FIX` file needed
a code change — `ContactDrawer.tsx` and `contacts-panels.css`'s terminal
block already implement the frame correctly; this task's only change is
the render-verdict test itself.

## Known, already-adjudicated divergences (referenced, not reopened)

Two structural gaps between this frame and the shipped drawer are
pre-existing, already RULED in `docs/design/DEVIATIONS.md`, and are
receipted (not re-litigated) by the new test:

1. **Heading level, `<h1>` vs `<h2>`.** `docs/design/DEVIATIONS.md` §7
   rules a `ModalFrame` dialog's title stays an `<h2>` referenced by
   `aria-labelledby` — the frame's own `<h1>` is a drawing convention for
   a full-screen drill, and demoting the page's real `<h1>` for a dialog
   would trade an accessibility contract for pixel resemblance. Also
   recorded in `docs/design/audit/contacts-v12.md` (Finding 4, RESOLVED
   v12m-w21-m). Not this task's file to fix (`ModalFrame.tsx` is shared,
   outside `ContactDrawer.tsx`/`contacts-panels.css`) and not reopened
   here.

2. **Phone EDIT-state footer button order.** `docs/design/DEVIATIONS.md`
   §3 "Contact drawer footer" rules the app keeps the recorded A20 ruling
   (Delete far-left as a destructive tertiary, separate from the
   right-flushed Email/Add to event/Cancel/Save group, with the
   save-scope sentence on its own line above the bar) over the frame's
   own buttons-only `Cancel · Save · Email · Add to event` order — the
   frame loses here (DEC-576 wave-31 tie-break: the later DEVIATIONS
   entry wins). `ContactDrawer.frame390.render.test.tsx`'s second `it()`
   asserts the APP's order (`Email`, `Add to event`, `Cancel`, `Save`
   right-flushed; `Delete this contact` far left, never adjacent to
   Save) — the frame's own order is recorded here as the blessed
   divergence it already is, not a new finding.

3. **Phone EDIT-state five-control bar is an undrawn state.**
   `docs/design/DEVIATIONS.md` §3 "Contact drawer's phone EDIT stack is
   not the frame's read dock" (DEC-959; DEC-380 wave-120 struck) records
   that `:433-436` draws ONLY the 390 READ footer — the EDIT bar's shape
   (`min-height:48px`, `padding:0 16px`, one control per line, reached
   through the dock's own `Edit`) is the recorded interpretation, graded
   against that interpretation rather than the frame. `contacts-phone-frames.test.ts`'s
   existing "stacks the phone EDIT state's action bar…" `it()` already
   pins this in `contacts.css` (owned by task w31-c this wave, not
   touched here).

## Files touched by this task

- `app/src/pages/contacts/ContactDrawer.frame390.render.test.tsx` (new) —
  the render-verdict test above.
- `docs/design/audit/contacts-drawer-390-v12.md` (this file, new).

No change was needed to `app/src/pages/contacts/ContactDrawer.tsx` or
`app/src/pages/contacts/contacts-panels.css` (the two files this task was
allowed to fix) — both already implement the frame correctly once
checked against the real DOM. `app/src/pages/contacts/ImportWizard.tsx`,
`MergePage.*`, `PipelineBoard.*`, `contacts.css`,
`src/server/repo/contacts/**`, `src/domain/contacts-parts/**`,
`docs/design/DEVIATIONS.md` and `src/decisions-data/**` were not touched,
per this task's hard ban.
