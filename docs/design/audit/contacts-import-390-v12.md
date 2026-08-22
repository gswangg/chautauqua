# "Import CSV · 390" frame verdict (task w30-d)

Frame: `docs/design/Chautauqua Contacts.dc.html:487` ("Import CSV · 390"),
extent 487-517 — the one-column-per-screen match-columns pager. Graded
against `app/src/pages/contacts/ImportWizard.tsx` +
`app/src/pages/contacts/contacts-panels.css`, pinned by
`app/src/pages/contacts/ImportWizard.frame390.render.test.tsx`.

## Verdict: MATCHES, with one filed shape divergence (below)

Literal-by-literal:

1. **`‹ Contacts` back control + `Match the columns` title (:489-490).**
   MATCHES. `ModalFrame`'s `backLink={{ label: '‹ Contacts', onClick:
   onClose }}` (`ImportWizard.tsx:726`) renders the exact label. The
   heading text matches; the tag is `<h2>` (ModalFrame's shared
   `.chq-modal-title`) against the frame's `<h1>` — this is the SAME
   H2-vs-H1 clause `contacts-v12.md`'s finding 4 already narrowed for the
   "Contact · 390" frame and adjudicated as a shared-component concern
   (`ModalFrame.tsx`, not `app/src/pages/contacts/**`), out of this task's
   scope. Not re-filed as a new divergence here — same root cause, same
   owner, already on record.

2. **File summary line (:491) — DIVERGES (shape, not data); CLOSED
   (DEC-385 wave-18).** Was left OPEN across several waves pending a
   `contacts-panels.css` change outside earlier lanes' FILES-I-OWN lists.
   `v12m-w18-a` (DEC-385 wave-18 amendment) built it: `ImportWizard.tsx`'s
   `.chq-contacts-import-match-head` now additionally renders
   `.chq-contacts-import-match-sep` (the `·` glyph, twice) and
   `.chq-contacts-import-match-position` (`{i} of {n}`, reading the SAME
   `phoneColumnIndex`/`header.length` state the `Column i of n` eyebrow
   already reads — no second derivation). Both new nodes are `display:
   none` at base (desktop byte-identical to before) and revealed to
   `display: inline` inside the SAME `@media (max-width: …)` block that
   switches the head from a column stack to the frame's single wrapping
   row (`contacts-panels.css`). The frame's `speakers.csv · 214 rows · 2
   of 5` shape — filename, row count, and column position joined by ` ·
   ` — now renders at phone width; desktop is unchanged (DEC-385
   single-direction). Filename and the row/column counts remain DATA
   (sourced, not hardcoded); what previously diverged was the SHAPE, and
   the shape now matches.

   Pinned by `ImportWizard.frame390.render.test.tsx`'s "the file summary
   line" test, rewritten this wave to assert the joined shape renders AND
   to prove the phone cascade governs the reveal (brace-depth-selecting
   the governing `@media` block and asserting its reveal declarations,
   per DEC-994) — a future regression flips this test rather than
   silently going stale.

3. **`Column i of n` eyebrow + column header name (ImportWizard.tsx:1006,
   :1008).** MATCHES the frame's `Column 2 of 5` / `email_address` shape
   exactly (data — the sample header/position differ, structure doesn't).

4. **`First three values: {a}, {b}, {c}` (ImportWizard.tsx:1011).**
   MATCHES. Label literal exact; `.slice(0, 3)` + `.filter((v) => v !==
   '')` caps at three non-blank samples joined with `, `, mirroring the
   frame's three comma-space-joined emails at :493.

5. **`Import it as` label + option list, `Skip this column` (:494,
   :968).** MATCHES. `phoneImportTargetOptions` (app/src/pages/contacts/ImportWizard.tsx`Skip this column`)
   puts that option first, matching the desktop `<select>`'s own
   empty option (app/src/pages/contacts/ImportWizard.tsx`(ignore)`) — not a separate
   option, per the DEC-825-era copy rule this task's brief named.

6. **Match-summary slot at :507 (`9 rows match an existing contact by
   email · those get updated`).** ALREADY ADJUDICATED, not re-opened here.
   `docs/design/audit/contacts-v12.md` findings 1 & 2 (DEC-663 wave-108
   amendment, RESOLVED) ruled that this exact slot renders the wizard's
   own, already-computed same-file dedupe note (`Same-file email repeat: N
   rows · the later row wins`, sourced from `dedupeCount`) instead of the
   frame's literal wording, because the frame's wording needs
   `plan.updated`, which does not exist before the dry run runs — the
   product ships a TRUE statement it can actually compute at this step,
   built from the SAME counts the plan step already computes (`dedupeCount`
   is the in-file email-collision tally the match step already needed for
   its own validation), never a second independently-derived tally. This
   task's own test ("the match-summary slot at :507...") re-derives that
   the resolution still holds against the current tree — it does; no new
   finding.

7. **Pager dock — `Next column` / `Skip`, 44px floor, `data-chq-phone-dock`
   (:508-511).** MATCHES. `.chq-contacts-import-phone-dock` carries
   `data-chq-phone-dock`, the last-in-DOM-order dock per the established
   idiom (`app/src/styles.css`'s `.chq-main:has([data-chq-phone-dock])`
   family uses the same contract, per `contacts-v12.md` finding 1's
   citation). Both buttons hit `min-height: 48px` (above the 44px floor),
   centred flex, horizontal `0 16px` padding
   (`contacts-panels.css:1714-1730`).

## Summary

9/10 of the frame's drawn phone literals render exactly (back control,
title text, column eyebrow, column name, samples line, target list incl.
"Skip this column", dock labels, 44px dock floor, and now the file
summary line's `·`-joined shape with the column-position clause folded
in). One (the match-summary slot) is a pre-existing, already-RESOLVED
adjudicated substitution, not a fresh gap. The file summary line's
DIVERGES row is CLOSED as of DEC-385 wave-18 — see finding 2 above.
