# Phone dock -> shell declaration audit (DEC-576, wave-98 amendment)

Companion to `app/src/phone-dock-declares.scan.test.ts` (task w1-f). The scan
derives, by geometry (not by name), every class inside a
`@media (max-width: 700px)` block that declares `position: sticky|fixed`
with `bottom: 0` and a `border-top` -- a docked phone footer band -- and
asserts its renderer either applies the shared `chq-phone-dock` class or sets
`data-chq-phone-dock`, the two idioms `app/src/styles.css` uses
(`:453`, `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar`, and `:2469`,
`.chq-shell:has(.chq-phone-dock) .chq-tabbar`) to suppress the phone tab bar
underneath a docked footer.

Two real offenders were found this wave. One was in reach and fixed in this
task (`.chq-review-editor-title-actions` / `app/src/pages/review/
PlanEditor.tsx` -- the page root now sets `data-chq-phone-dock` when
`isPhone`, matching Scorecard.tsx's idiom). The other is a structural gap,
not a one-attribute fix, and is recorded here rather than patched:

| class | sheet | renderer | owning cluster | why it can't be a one-line fix |
|---|---|---|---|---|
| `.chq-contacts-import-phone-dock` | `app/src/pages/contacts/contacts-panels.css:1605` | `app/src/pages/contacts/ImportWizard.tsx:1015` | Contacts | `ImportWizard` renders through `ModalFrame`, which `createPortal`s its whole tree to `document.body` (`app/src/components/ModalFrame.tsx:161-177`) -- entirely outside `.chq-shell`/`.chq-main`. Neither shell selector (`.chq-shell:has(...)`, `.chq-main:has(...) ~ .chq-tabbar`) can ever match a node in a sibling DOM subtree, so setting `data-chq-phone-dock` anywhere inside the modal is a no-op regardless of placement. Suppressing the tab bar under this dock needs either a shell-side "a modal with a phone dock is open" signal (e.g. a body-level class toggled by `ModalFrame` itself, matched with a plain descendant/sibling combinator instead of `:has()` across the portal boundary) or a rethink of where the modal portals on phone. That's a shell/`ModalFrame` decision, not a page-local one -- out of this task's scope (`app/src/styles.css` and `App.tsx` are both off-limits here), and `ModalFrame.tsx` is shared infrastructure other clusters render through, so it isn't a narrow single-page fix either. |

No ratchet is seeded for this: the scan's assertion (`every real docked
footer class declares itself to the shell`) stays un-relaxed and will
correctly stay RED on `.chq-contacts-import-phone-dock` until a future wave
either fixes `ModalFrame`'s portal boundary or the shell's suppression
mechanism. A ceiling above the truth is a licence (field guide, wave 95) --
this row is a to-do, not an exemption list entry in the scan itself.
