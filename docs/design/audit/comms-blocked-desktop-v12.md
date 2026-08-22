# Comms v12 DESKTOP (1600) per-frame render verdicts — residue part 2 of 2 (w26-d, DEC-976/DEC-651/DEC-032)

3 of Comms' 9 desktop frames. This document covers the send-blocked state
and the two template-render reference panels: `docs/design/Chautauqua
Comms.dc.html` frames `:750` (extent 750-983, "Compose · send blocked"),
`:686` (extent 686-694, "What each template renders") and `:712` (extent
712-749, "DevFlow Conf 2027"). It is sibling to the residue-part-1 desktop
ledger, which this task does not touch. Receipts live in
`app/src/pages/Comms-blocked.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26, the mandate's desktop freeze):
this document and its test file render, verdict, and file divergences in
prose — they move no desktop byte and edit no component or stylesheet, even
where a real divergence is found below.

## Frame :750 "Compose · send blocked"

**DIVERGES.** Entered via `ComposeWizard` at the `preview` step, with
`attachIcs` toggled on against a fixture where some selected recipients'
submissions are not yet scheduled.

- The frame draws this as a distinct, page-level state: a `<h1>Check before
  sending</h1>` beside a `"N recipients"` caption (frame :763-764), inside
  its own 1600px card with its own header. The tree renders no such page —
  the refusal is an inline `<div role="alert" className="chq-comms-refusal-banner">`
  appended to the SAME `preview` step the organizer was already on. No
  `<h1>` and no text "Check before sending" appear anywhere on the page.
- The frame's population table is a two-column CSS grid with a header row
  (`Recipient` / `Missing`, frame :773-774,
  `grid-template-columns:1fr 190px 150px`). The tree instead renders a
  plain `<ul className="chq-comms-blocked-list">` (confirmed against
  `comms.css`'s own selector text) — no `role="table"`, no `Recipient`/
  `Missing` column heads anywhere in the DOM.
- The unresolved recipients ARE named individually inside that list, never
  as a bare count — each `<li>` carries the recipient's name/ref and a
  `Place on the agenda ›` link (frame :779-783), matching the frame's own
  population-naming intent even though the container isn't a table.
- **The cause differs.** The frame's banner reads "One merge field will not
  resolve for 3 of the 23" (frame :768) — an unresolvable `{session_time}`
  merge field. The actual refusal this app renders in this exact
  structural position (a `chq-error-banner.chq-comms-refusal-banner` with a
  named list and a 3-button footer) fires for a DIFFERENT, real cause: the
  DEC-051 "not scheduled" preflight on `attachIcs`. This is not new debt —
  `ComposeWizard.tsx`'s own comment (DEC-660, wave-148, cited beside the
  pre-emptive merge-field advisory band on the template step) already
  states the frame's "merge field / literal placeholder text" premise is
  false for this app: `renderTemplate` throws `MergeFieldError` for a
  missing merge var and `/compose/preview` turns that into a whole-batch
  refusal surfaced as a TOP-of-wizard banner (`missingMergeFieldLines`, a
  plain `<ul>` inside `chq-error-banner`, no 3-button footer, no partial-
  send option) — a different location and shape from the table+footer this
  frame draws. The table+3-button STRUCTURE this frame draws is real in the
  tree, but wired to scheduling, not merge fields.
- **The 3-button action row MATCHES** in order and labels: "Send to the N
  who have a slot" / "Edit the template" / "Place all N first" (frame
  :791-793) — structurally identical to what the tree renders for its own
  (scheduling) refusal, differing only in element roles (interactive
  `<button>`/`<a>` vs. the frame's decorative `<span>`, which the mandate
  already treats as an intentional a11y improvement elsewhere in this
  pack).
- The footer caption MATCHES modulo a trailing period the frame omits
  (frame :789 has no trailing `.`; the tree's caption does) — a wording
  nuance, not a structural divergence.

**Recommendation:** none needed beyond this row — the underlying refusal
mechanism (named population, no silent count, partial-send escape hatch)
is real and DEC-660-blessed; only the frame's specific "merge field" flavor
of the story is aspirational for this app, and that finding is already on
record via the DEC-660 wave-148 comment this task's receipt corroborates.

## Frames :686 "What each template renders" and :712 "DevFlow Conf 2027"

**DIVERGES (both).** These two frames are one continuous panel: a 4-up
reference gallery of email cards ("Submission received" / "Accepted" /
"Tasks outstanding" / "Schedule published"), each captioned with an eyebrow
("Emails"), a `seenIn`/`seenWhy` provenance note, and a full rendered card
body at a fixed `560px` measure ("One shell · 560px measure · no images",
frame :687).

- This panel documents a VOCABULARY, not a screen the app renders. The
  distinguishing text this gallery is built from — `seenIn`, `seenWhy`,
  `One shell`, `560px measure` — appears NOWHERE in
  `app/src/pages/comms/ComposeWizard.tsx`, `PreviewPane.tsx`, or
  `TemplatesTab.tsx` (grepped directly; zero hits). No route or component
  produces a 4-card side-by-side gallery of past/possible sends.
- The nearest real analogue is `PreviewPane`, reached from `ComposeWizard`'s
  own `preview` step: it renders exactly ONE recipient's resolved card at a
  time (confirmed: `.chq-comms-preview-card` count is 1, never 4, when
  rendered), with Prev/Next navigation on the section header rather than a
  gallery layout.
- The ONE factual claim the panel makes that IS verifiable against the
  product — the fixed event-name masthead ("DevFlow Conf 2027", frame :712
  and :737, appearing as plain text rather than a live `{{ event.name }}`
  binding) — does hold: `src/mail/render.ts`'s own `event_name` merge
  field resolves to the literal string `"DevFlow Conf 2027"` in its sample
  vars, and the wizard's resolved subject line interpolates the event name
  exactly where `{event_name}` sat in the composed subject, confirmed by
  rendering the wizard with `{event_name}` in the subject and finding the
  resolved text.

**Recommendation:** `docs/design/DEVIATIONS.md` should record that
`Chautauqua Comms.dc.html:686-749` ("What each template renders") is a
documentation/reference panel for the product's email vocabulary, not a
built screen, per this task's instruction not to construct a new surface
under the desktop freeze to make it "MATCH."

## Summary

| Frame | Verdict |
| --- | --- |
| :750 Compose · send blocked | DIVERGES (real cause substitution + table→list shape; population-naming and 3-button footer both hold) |
| :686 What each template renders | DIVERGES (documents a vocabulary, not a rendered screen — recommend DEVIATIONS) |
| :712 DevFlow Conf 2027 (template card body) | DIVERGES (same finding as :686; the one interpolation fact it demonstrates is real) |

3 of 3 frames in this residue slice DIVERGE, none newly broken by this
task: :750's population-naming and action-row structure are real and
correct even though the specific "merge field" cause the frame narrates
isn't the one wired up (a documented, DEC-660-blessed substitution);
:686/:712 document a reference gallery this app has never built as a
screen. No desktop byte was moved to produce this verdict.
