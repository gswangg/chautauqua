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

Two real offenders were found in an earlier wave. One was in reach and fixed
then (`.chq-review-editor-title-actions` / `app/src/pages/review/
PlanEditor.tsx` -- the page root now sets `data-chq-phone-dock` when
`isPhone`, matching Scorecard.tsx's idiom). The other -- the ModalFrame
portal gap below -- is FIXED as of wave-106:

| class | sheet | renderer | owning cluster | status |
|---|---|---|---|---|
| `.chq-contacts-import-phone-dock` | `app/src/pages/contacts/contacts-panels.css:1605` | `app/src/pages/contacts/ImportWizard.tsx:1015` | Contacts | FIXED (DEC-576 wave-106). |

`ImportWizard` renders through `ModalFrame`, which `createPortal`s its whole
tree to `document.body` (`app/src/components/ModalFrame.tsx:161-177`) --
entirely outside `.chq-shell`/`.chq-main`, so neither existing shell
`:has()` selector (scoped to `.chq-shell`/`.chq-main` descendants) could
reach a `data-chq-phone-dock` set anywhere inside the modal. `.chq-tabbar`
and `.chq-scrim` (`ModalFrame`'s portal root) are both descendants of
`<body>`, so a body-rooted `:has()` is the one combinator that spans the
portal boundary. `app/src/styles.css`'s terminal
`@media (max-width: 700px)` block now adds a third suppression rule beside
the two existing ones:

```
body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar { display: none; }
```

scoped to `.chq-scrim` on purpose, so only a MODAL dock reaches across the
portal boundary -- an in-shell dock keeps using the two narrower rules.
`ImportWizard.tsx`'s `.chq-contacts-import-phone-dock` element now carries
`data-chq-phone-dock`, the same attribute contract other page-local docks
already use, closing this row without any rework of `ModalFrame` itself.

`app/src/phone-dock-declares.scan.test.ts`'s `KNOWN_UNFIXABLE_BY_ATTRIBUTE`
array is now empty (kept exported, for the next genuine structural gap)
and a new assertion checks the body-rooted rule is actually present in
`styles.css`, so the attribute alone can't pass this scan by accident.
