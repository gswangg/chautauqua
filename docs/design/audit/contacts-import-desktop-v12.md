# Contacts v12 DESKTOP (1600) per-frame render verdicts — import/bulk-modal family (w26-b)

5 of Contacts' 12 desktop frames — the import wizard's three states
(`:279` Match the columns, `:672` the plan/commit review, `:770` the
file-level refusal) plus the two per-selection bulk modals (`:546` Bulk
email, `:582` Add to an event). The remaining 7 desktop frames (the
directory rail + drawer family) belong to sibling lanes; this document
makes no claim about them. Receipts live in
`app/src/pages/Contacts-import.desktop-frame-verdicts.render.test.tsx`.

STRICTLY MEASUREMENT ONLY (DEC-651 wave-26): this document and its test
file render the real components, verdict what the tree actually produces,
and file divergences in prose — they move no byte and edit no component or
stylesheet, even where a real divergence is found below.

## Frame :279 "Import CSV · step 2 of 3" (Subscreen)

**DIVERGES**, in three ways, none of them new debt — the wizard is a
multi-step React dialog reusing one shared `ModalFrame` chrome across all
four of its steps, where the frame draws each step as an independently
composed static mock.

- **Escape count and location.** The frame draws exactly ONE escape for
  this step — a head-band `Cancel` link (`Chautauqua Contacts.dc.html:288`)
  — with the primary `Import 214 rows` action and the dedupe caption living
  INSIDE the content, beside each other (`:302-303`). The tree draws TWO
  escapes: `ModalFrame`'s own head `Close` button (never the frame's
  "Cancel" wording) plus a footer `Cancel` button in `.chq-modal-actions`,
  with the primary rendered in that SAME footer bar — a sibling of the
  content, not inline beside the dedupe caption.
- **The dedupe caption's source** (blessed, DEC-663 wave-108 amendment).
  The frame's caption (`:303`, "9 rows match existing contacts by email ·
  they will be updated") is sourced from the dry run's `plan.updated`,
  which does not exist yet at this step. The tree ships a differently
  worded, truthfully computed statement instead — an in-file email
  collision count ("Same-file email repeat: N rows · the later row wins")
  — rather than fabricate the frame's plan-sourced sentence early. The
  frame-accurate sentence lands later, on the Review step
  (`.chq-contacts-import-matched`). This finding is ALREADY RESOLVED per
  `contacts-v12.md` finding 2 and `ImportWizard.tsx`'s own citation of it;
  filed here again only because this task's mandate is to verdict every
  frame explicitly, not to skip a previously-adjudicated one.
- Column-mapping structure MATCHES: one full-width grid row per CSV
  column (`:292`, `grid-template-columns:1fr 26px 1fr`) — name over
  sample on the left, a `→` glyph, the target `<select>` on the right —
  rendered once per header column with `Match the columns` as the step
  title (`:285`).

## Frame :672 "Import CSV · step 3 of 3"

**RESOLVED-BY-RULING** at the chrome level, **RESOLVED** on the footer,
**MATCHES** on content.

- **Chrome — RESOLVED-BY-RULING (DEC-575 wave-9 amendment).** The frame
  draws this step under a `1600` section badge (`:719`, green — a
  full-page-width state, unlike `:279`'s `Subscreen` or `:546`/`:582`'s
  `Modal` badges) as a chromeless 1600px surface with no head-band escape
  at all — just a centered 820px column. The tree keeps this step inside
  the exact SAME 640px `ModalFrame` dialog (`.chq-modal .is-wide`, scrim,
  head `Close` button, footer actions bar) as every other step of the
  wizard — never a distinct full-width surface. DEC-575's wave-9
  amendment rules this deliberate: the `1600` badge is the pack's drawing
  convention for a desktop-width mock, not an instruction to rebuild step
  3 as a full-width page — doing so would break the DEC-651 focus trap
  and the 390 drill flow. The head `Close` stays as DEC-651's shared
  dialog chrome (never a step-local escape). Not scheduled for any future
  wave; see the call-site comment in `ImportWizard.tsx`.
- **Overwrite disclosure MATCHES**: an update row's `overwrites` render as
  `<field-label> <s>from</s> → to` (`:697`) — a capitalised human field
  label, a genuinely struck-through old value (`<s>` carrying
  `chq-contacts-import-overwrite-old`), then the new value — exactly the
  frame's grammar, sourced from `describeImportOverwrites`
  (`src/domain/contacts-parts/duplicates.ts`) via the plan row's own
  `overwrites` array (never re-derived client-side).
- **Footer control set — RESOLVED (DEC-575 wave-9 amendment).** The
  footer now takes the frame's exact membership and order: `Back` then
  the primary `Import N rows` (`:709-710`), and the third control
  (`Cancel`, previously inherited from the shared `ModalFrame`/step-2
  actions fallback) no longer renders at this step. Steps 1, 2 and the
  completion screen keep their own footers unchanged. Pinned by
  `ImportWizard.render.test.tsx`'s "DEC-575 wave-9 amendment" describe
  block.

## Frame :770 "Import CSV · the file will not do" (Modal)

**DIVERGES** on identity and heading wording, **MATCHES** on substance.

- **Dialog identity.** The frame gives this refusal its own dialog H1
  ("Nothing was imported", `:777`) and its own Close control (`:780`) —
  a distinct state. The tree shows this block as an overlay INSIDE step
  2's dialog: the H2 still reads "Match the columns" (the wizard's `step`
  computation resolves to 2 whenever a header has been parsed and neither
  `plan` nor `result` exist yet, which is exactly this refusal's
  condition) — the refusal has no title of its own.
- **Heading wording.** The frame's heading is a bare count
  ("9 rows have no email address", `:785`, no denominator). The tree names
  both the offending count AND the total ("N of M rows have no email
  address") — DEC-575's wave-28 amendment; arguably more informative, but
  not the frame's literal wording.
- **Explanatory sentence and three-action footer MATCH**: the sentence
  ("Email is how a contact is matched…", `:786`) renders verbatim, and the
  footer draws exactly the frame's three controls in the frame's order —
  primary "Import the N good rows", secondary "Upload a different file",
  tertiary "Download the N rows" (`:799-800`).

## Frame :546 "Bulk email" (Modal)

**MATCHES** on header and footnote, **DIVERGES** (blessed) on the footer.

- Header MATCHES: H1 "Email N contacts" (`:552`) over the recipient names
  sub-line (`:553`), sourced from the `recipientNames` prop (never a
  second contacts fetch).
- **Footer DIVERGES**, deliberately. The frame's footer for this state is
  `Send N emails` + `Cancel` (`:572-573`) — a direct send. The tree's
  compose-step footer is `Preview` + `Cancel`: the component's own comment
  cites frame `08-contacts--10`'s "pre-flight the irreversible" rule (an
  email send cannot be undone) and keeps a genuine preview step — which is
  what catches an unresolved merge-field token before anything goes out —
  before a confirm dialog ever offers `Send N emails`. Already named and
  reasoned about in `BulkEmailModal.tsx` itself; filed here as the
  explicit per-frame verdict this task requires.
- Merge-fields footnote MATCHES verbatim (`:570`), literal placeholder
  tokens (`{first_name}`, `{company}`) never resolved client-side.

## Frame :582 "Add to an event" (Modal)

**MATCHES** on header and footer, **DIVERGES** on the role vocabulary.

- Header and footer MATCH: H1 "Add to an event" / sub with the contact's
  name; footer draws exactly `Add them` then `Cancel`, in the frame's
  order (`:607-608`).
- **The "As" role control DIVERGES.** The frame draws exactly three chips
  — Speaker (selected) / Reviewer / Guest (`:601-603`). The tree offers
  the app's real `PARTICIPANT_ROLE_OPTIONS` vocabulary instead — four
  options, Speaker / Co-presenter / Moderator / Panelist — with "Speaker"
  still first and still pre-selected. This is a deliberate, already-ruled
  divergence: `AddToEventModal.tsx`'s own DEC-714 compile-checked marker
  states the control "offers the app's OWN role vocabulary... never a
  hardcoded Speaker/Reviewer/Guest list — 'reviewer' is an account role,
  'guest' has no representation in the data model" — i.e. the frame's own
  two non-Speaker chips could not be built honestly against the real data
  model. Filed here as the explicit per-frame verdict, not new debt.

## Summary

| Frame | Verdict |
| --- | --- |
| :279 Import CSV · step 2 of 3 | DIVERGES (escape count/location; dedupe caption wording, blessed) |
| :672 Import CSV · step 3 of 3 | RESOLVED-BY-RULING (chrome, DEC-575 wave-9) / RESOLVED (footer membership+order, DEC-575 wave-9) |
| :770 Import CSV · the file will not do | DIVERGES (dialog identity; heading wording) |
| :546 Bulk email | DIVERGES (footer: Send-direct vs. Preview-then-confirm, blessed) |
| :582 Add to an event | DIVERGES (role vocabulary: 3 hardcoded chips vs. 4 real roles, blessed) |

0 of 5 frames MATCH in full at the time of the original measurement; every
one carried at least one real, render-verified divergence. Four of the
five divergences (the :279 dedupe caption, the :546 Send-vs-Preview
footer, the :582 role vocabulary, and — as of the DEC-575 wave-9
amendment — the :672 chrome/footer findings) are now named and reasoned
about as deliberate, ruled decisions, or built to match, not open debt.
Only :770 (dialog-identity/heading wording) remains filed as an
unadjudicated finding for a future wave.
