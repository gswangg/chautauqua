# Settings dialogs v12 DESKTOP (Modal) per-frame render verdicts (w24-c, DEC-032/DEC-651)

Per-frame render VERDICTS for the seven Settings dialog frames in
docs/design/Chautauqua Settings.dc.html:1268-1502, entered through the
app's real routes and asserted against jsdom DOM structure (never a
computed style — jsdom applies no stylesheet). Modelled on
`speakers-desktop-v12.md` (DEC-930 wave-158) and its sibling
`Speakers.desktop-frame-verdicts.render.test.tsx`. Receipts live in
`app/src/pages/Settings-dialogs.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (the mandate's desktop freeze): this document and
its test file render, verdict, and file divergences in prose — they move no
desktop byte and edit no component or stylesheet, even where a real
divergence is found below.

ENTRY RULE (DEC-651 wave-24): every dialog below is opened by rendering
`<SettingsPage />` under a `MemoryRouter` at its real
`?section=<key>[&edit=1][&view=embeds]` URL and firing the real control
that opens it. No `ConfirmDialog` or panel component is ever mounted
directly.

HARD CITATION CONSTRAINT (DEC-032 wave-24): every citation below lands in
1215-1506; none lands at or beyond :1507 ("Import from Sessionboard") or
inside 1111-1214 ("Your data" edit view) — both DEVIATIONS §6 deferred.

## Frame :1271 "Invite someone"

**MATCHES.** Entered at `/settings?section=people&edit=1`, opened via the
real "Invite someone" control.

- Header title (frame :1278, `Invite someone`) and subtitle (frame :1279,
  `They can sign in as soon as you do this`) MATCH verbatim, and a `Close`
  control renders (DEC-651's header contract).
- Actions row (frame :1311) MATCHES: primary `Create the account` precedes
  secondary `Cancel`, in that DOM order.

## Frame :1319 "Invite · the one-time password"

**MATCHES.** Same dialog's second step (the reveal), reached by submitting
the form above.

- Header title (frame :1326, `{name} can now sign in`) and subtitle (frame
  :1327, `{email} · {role}`) MATCH verbatim (dynamic per the created
  account), with a `Close` control.
- Actions row (frame :1344) MATCHES: primary `Done` precedes the tertiary
  `Invite someone else`.

## Frame :1352 "Invite · rejected"

**DIVERGES** (two findings, additive).

- The frame retitles the dialog's own header to `Nobody was invited`
  (frame :1359) on a duplicate-email refusal. The tree's dialog title
  never changes — it stays `Invite someone` through the whole flow. The
  subtitle DOES swap, matching the frame's `The address is already in use`
  (frame :1360).
- The frame draws all three action-row controls — primary `Create the
  account`, `Cancel`, and the `Open Sam's row` tertiary — in ONE row, in
  that order (frame :1384). The tree instead renders the escape route
  ("Open {name}'s row") inside the error-alert body, ABOVE the actions row
  (`ModalFrame`'s own children-before-actions composition) — so in DOM
  order it is FIRST, not last, and it names the contact by NAME ("Sam
  Whitfield"), never by email, unlike the frame's literal "Sam" reference.

## Frame :1392 "Confirm · reversible"

**DIVERGES** (additive — title and body text match).

Entered via `?section=public-pages&view=embeds` (`SavedEmbedsPanel` always
renders its full Edit/Turn on-off/Delete/Build set there — DEC-896 B10
DROP: Public pages has no edit view), opened via the real "Turn off"
control.

- Header title (frame :1399, `Turn off "Sponsor deck feed"?`) MATCHES.
- Header subtitle (frame :1400, `It is embedded on notion.so`) has NO
  DOM counterpart: the tree's `ConfirmDialog` component has no subtitle
  slot at all — every caller only supplies `title`/`body`/action labels.
  This is a structural gap in the shared dialog primitive, not a
  page-local choice, so it recurs identically at every `ConfirmDialog`
  call site.
- Actions row (frame :1406) MATCHES: primary `Turn it off` precedes
  `Cancel`, and the body sentence ("The embed will render nothing wherever
  it is pasted, until you turn it back on. Nothing is deleted.") matches
  the frame's body copy.

## Frame :1414 "Confirm · irreversible"

**MATCHES** (title/object-naming; one finding remains a filed deferral,
one is a settled ruling, not a gap).

Entered at `/settings?section=portal&edit=1` (the editable `ResourcesPanel`
lives inside its `SummarySection` "Change" drill), opened via the real
"Delete" control on the resource row.

- The frame folds the resource's file name directly into the header
  TITLE — `Delete "Speaker handbook 2027.pdf"?` (frame :1421). **Wave-9
  (DEC-941 amendment):** `ResourcesPanel.tsx`'s confirm now builds this
  exact object-naming form (`title={\`Delete "${resource.title}"?\`}`); the
  body sentence no longer repeats the quoted filename, keeping only the
  consequence (`Speakers lose the download from their portal. This cannot
  be recovered.`) — one copy of the name, in the title (DEC-613).
- The frame's header subtitle (frame :1422, `Downloaded 18 times by 12
  speakers`) is **DEVIATIONS §6 deferred** — quoting DEVIATIONS.md
  verbatim: *"the `resource` table (`src/db/schema/content.ts`) carries no
  download-count column and no read-tracking endpoint exists anywhere in
  the repo, so the count is absent by design — building a counter over a
  column nobody writes would be exactly DEC-851/DEC-988's declared knob
  with no reader (DEC-032, task w4-aq)."* Verdicted DIVERGES-by-deferral;
  nothing built here.
- The typed-name confirm row (frame :1429, `Type the file name to
  confirm`) MATCHES: `weight="irreversible"`, primary disabled until the
  resource's own title is typed.
- The frame's primary reads `Delete it` (frame :1432); the tree's reads
  the narrower, more specific `Delete resource` — **not adopted, by
  ruling** (DEC-941 wave-9 amendment): `app/src/confirm-primary-object.
  scan.test.ts` requires every destructive `ConfirmDialog` primary to name
  its object, never a bare verb, and DEC-967 rules frame sample prose is
  not product copy. Recorded at the call site, not a backlog item.

## Frame :1440 "Portal resource · add"

**MATCHES.** Same route as :1414, opened via the real "Add a resource"
control.

- Header title (frame :1447, `Add a resource`) and subtitle (frame :1448,
  `Shown to every speaker in their portal`) MATCH verbatim.
- Actions row (frame :1469) MATCHES: primary `Add it` precedes `Cancel`.

## Frame :1477 "Reset a password"

**DIVERGES** (structural — no dialog at all).

Entered at `/settings?section=people&edit=1`, "reached" via the real
"Reset password" → "Confirm reset" controls on a teammate's row.

- The frame draws this as a full Modal: a bordered header carrying the
  title `Sam Whitfield can sign in again` (frame :1484), a subtitle line,
  and a `Close` control, with the reveal content (`New password · shown
  once`, frame :1491) inside the modal body.
- The tree opens **no dialog whatsoever** for this reveal —
  `screen.queryByRole('dialog')` is null throughout. `PasswordRevealBlock`
  renders inline in the row (the same inline site the pre-existing
  `PeopleRolesPanel.resetPassword.render.test.tsx` already pins:
  `expect(screen.queryByRole('dialog')).not.toBeInTheDocument()`), so
  there is no header at all to carry a title, subtitle, or Close control
  — a full absence of DEC-651's header contract, not a partial one. The
  reveal's own content (`New password · shown once`, the password itself)
  still renders, just without any dialog chrome around it.

## Summary

| Frame | Verdict |
| --- | --- |
| :1271 Invite someone | MATCHES |
| :1319 Invite · the one-time password | MATCHES |
| :1352 Invite · rejected | DIVERGES (title stays fixed; escape-route control reorders and renames) |
| :1392 Confirm · reversible | DIVERGES (no subtitle slot on `ConfirmDialog`) |
| :1414 Confirm · irreversible | MATCHES (title now object-naming, wave-9; primary label non-adoption is a ruling, not a gap; subtitle line DEFERRED) |
| :1440 Portal resource · add | MATCHES |
| :1477 Reset a password | DIVERGES (no dialog renders at all — fully inline) |

4 of 7 frames MATCH as rendered; the other three are prose-filed divergences
per this task's measurement-only mandate — no desktop byte was moved and no
component or stylesheet was edited to produce this verdict. Frame :1422's
"Downloaded 18 times by 12 speakers" subtitle is separately DEFERRED under
DEVIATIONS §6 ("Unbuilt features (no data model or endpoint behind the
drawing)"): the resource table has no download-count column and no
read-tracking endpoint exists anywhere in the repo.
