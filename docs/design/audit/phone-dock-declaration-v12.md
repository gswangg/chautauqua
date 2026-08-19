# Phone dock self-declaration -- outstanding rows (DEC-576 amendment, wave 98)

Produced by `app/src/phone-dock-declares.scan.test.ts` (task w1-f). That scan
derives, by geometry rather than by name, every class declared inside a
`@media (max-width: ...)` block whose body carries `position: sticky` (or
`fixed`) with `bottom: 0` and a `border-top` -- a page-local docked footer
band. The shell suppresses the phone tab bar only for elements that carry
the shared `chq-phone-dock` class or the `data-chq-phone-dock` attribute
(`app/src/styles.css:430,2300`). A docked class that does neither renders a
frame with both the dock AND the tab bar mounted, which no 390 drawing
shows.

Task w1-f fixed its own lane's offender
(`.chq-review-scorecard-dock` / `app/src/pages/review/Scorecard.tsx`, now
sets `data-chq-phone-dock` on the page root). The three rows below sit in
files this task does not own and are recorded here instead of being
allow-listed inside the scan (`OFFENDER_CEILING` in
`phone-dock-declares.scan.test.ts` is pinned at exactly this count -- it may
only shrink as each row's owner fixes it, never rise to cover a new one).

| Class | Sheet | Renderer | Owning cluster | Fix |
| --- | --- | --- | --- | --- |
| `.chq-contacts-import-phone-dock` | `app/src/pages/contacts/contacts-panels.css:1608-1616` | `app/src/pages/contacts/ImportWizard.tsx` | Contacts | Set `data-chq-phone-dock` on `ImportWizard.tsx`'s phone page/step root (or apply the shared `chq-phone-dock` class alongside the page-local one), gated by the same phone condition that renders the dock. |
| `.chq-bulkbar` (selector `.chq-content-worklist-selecting .chq-bulkbar`) | `app/src/pages/content/content.css:1505-1531` | `app/src/pages/content/SessionList.tsx` (bulk bar renders here; the mounting page root is `ContentApp.tsx`) | Content | `content.css:1512-1515`'s own comment already names this gap ("True tab-bar SUPPRESSION while the dock is up is shell geometry, out of this task's file scope"). Needs `data-chq-phone-dock` set on `ContentApp.tsx`'s page root while the worklist is in Select mode with a selection dock showing -- `ContentApp.tsx` already sets the attribute for `phoneSelectMode` (`:353`); confirm that condition covers the docked-bulkbar state or add a second gate for it. |
| `.chq-review-editor-title-actions` | `app/src/pages/review/review.css:2539-2549` | `app/src/pages/review/PlanEditor.tsx` | Review (admin) | Set `data-chq-phone-dock` on `PlanEditor.tsx`'s phone page root whenever the fixed Save/Cancel title-action dock is showing. |

Note: `.chq-phone-dock` itself (the shared scaffold class, `app/src/styles.css:2268-2277`) trivially satisfies the check -- it IS the class the shell selectors key on -- and is not a row here.
