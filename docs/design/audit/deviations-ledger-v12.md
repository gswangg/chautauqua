# DEVIATIONS.md ledger -- wave-31 population extension (DEC-967 amendment, task w31-c)

`test/deviations-ledger.scan.test.ts` graded four of `docs/design/DEVIATIONS.md`'s
nine `## ` sections through wave 30 (`## 1`, `## 2`, `## 3`, `## 6`), via a
hand-listed `INCLUDED_HEADINGS` literal array with a matching
`EXCLUDED_HEADINGS`. This wave replaces both arrays with `LEDGER_SECTIONS`,
derived at test time from every `## ` heading the file actually contains, and
transcribes the twenty newly-visible rows below.

The two old exclusion reasons were both stale and are dropped rather than
carried forward:

- "`## v12 frame errata`" -- cited as being actively deleted by an in-flight
  branch (v12m-w14-b). That branch landed; the heading no longer exists in
  the file. A population derived from real headings can never resurrect a
  deleted one, so no special case is needed.
- "`## 5. Pending adjudication`" -- cited as stale prose whose one entry was
  answered elsewhere. The section's own text now says exactly that ("No
  adjudication is currently open... recorded, resolved, in §6's
  'Adjudications recorded'"). It is now GRADED, as a single divider row (see
  below), not skipped.

## New rows, by section

### ## 4. Voice -- 1 row, gap

| key | verdict | citation |
|---|---|---|
| `docs-prose-follows-the-ste-derived-house-rules-not-the-designs-house-voice-note` | gap | none -- see reason |

This section draws one real top-level bullet, so it is bullet-derived like
sections 1/2/3, not a zero-bullet divider. But its claim ("docs prose follows
the STE-derived house rules") is a broad style/voice policy governing all
docs prose, not a fact any single artifact discharges. The bullet names one
real supporting file, `src/routes/docs-content/technical-names.ts` (the
declared domain-terms glossary), but that file only carries the domain-terms
half of the policy -- the should/might-ambiguity and metaphor bans have no
single artifact at all. Citing the glossary as though it proved the whole
policy would be the exact force-fit DEC-967's "gap" verdict exists to avoid.
Recorded gap under the same reasoning
`test/design-rulings-ledger.scan.test.ts` already applies to its own
`governing-principle-applied` row.

### ## 4a. Docs screenshots: tall frames, prepared states, and focus -- 4 rows, all honored

| key | citation |
|---|---|
| `capture-is-fullpage-by-default-still-at-1600-wide` | `scripts/docs-shots.ts` `const fullPage = (entry.capture ?? "fullPage") === "fullPage";` |
| `a-row-may-declare-prep-steps` | `scripts/docs-shots-lib.ts` `readonly prep?: readonly DocsShotStep[];` |
| `clip-selector-padding` | `scripts/docs-shots-lib.ts` the agenda break-band row's `clip: { selector: '.chq-agenda-break-band:has-text("Afternoon break")', padding: 300 },` |
| `highlight-selectors-dim` | `scripts/docs-shots-lib.ts` the agenda held-back/toast row's `highlight: { selectors: [".chq-agenda-held-back", ".chq-toast"], dim: true },` |

All four resolve against real, already-shipped mechanics in
`scripts/docs-shots.ts` / `scripts/docs-shots-lib.ts`, exercised by
`test/docs-shots-manifest.test.ts`.

### ## 5. Pending adjudication -- 1 row (divider), gap

| key | verdict | citation |
|---|---|---|
| `5-pending-adjudication-not-yet-blessed-sweep-should-verdict` | gap | none -- see reason |

The section draws zero top-level bullets; its whole content is now the
sentence "No adjudication is currently open," with the formerly-pending
tracks-and-rooms item pointed at `## 6`'s already-honored
`tracks-and-rooms-save-model` row. A section whose entire content is a
statement that nothing is open is recorded as one divider-style gap row keyed
to its own heading -- same reasoning
`test/design-rulings-ledger.scan.test.ts` applies to its `## A.`/`## B.`
section dividers -- rather than force-fit to `## 6`'s citation.

### ## 7. Settled frame divergences (wave 16 amendment, DEC-663) -- 10 rows, all honored

| key | citation(s) |
|---|---|
| `contacts-merge-390-picker-block` | `app/src/pages/contacts/MergePage.tsx` `chq-contacts-merge-picks` |
| `speaker-portal-landings-fourth-section-and-its-resources-footer-link` | `src/routes/portal/index.tsx` (two citations: the `Your submissions` section and the `chq-portal-footer-resources` link) |
| `speakers-390-landings-roster-trigger` | `app/src/pages/speakers/OnboardingGrid.tsx` `chq-speakers-phone-roster-link` |
| `submit-a-talks-format-legend` | `src/routes/public/submit-views.tsx` `<legend>{field.label}</legend>` |
| `cfp-wizard-docks-save-draft-vs-the-frames-draft-already-ruled-recorded-here-only-so-the-ledger-stops-re-filing-it` | `src/routes/public/cfp.css.ts` `the accessible name stays "Save draft" per DEC-613 wave-96 amendment` |
| `plan-editors-v4-title-row-shell-name-as-input-duplicate-save-on-the-back-link-row-is-blessed-superseding-the-frames-separate-h1-footer-save-cancel-anatomy` | `app/src/pages/review/PlanEditor.tsx` `chq-review-editor-title-row` |
| `settings-events-read-drill-footer-has-no-cancel` | `app/src/pages/settings/settings.css` + `app/src/pages/settings/EventSettingsPanel.tsx` (two citations) |
| `a-modalframe-dialogs-title-stays-an-h2-referenced-by-aria-labelledby-not-the-frames-h1` | `app/src/components/ModalFrame.tsx` `<h2 className="chq-modal-title">{title}</h2>` |
| `contacts-390-stands-down-three-purely-informational-readings-with-no-surviving-path-wave-16-r5-amendment-src-decisions-data-dec-919-md` | `app/src/pages/contacts/contacts.css` `.chq-contacts-rail { display: none; }` (phone media query) |
| `settings-events-slug-field-stays-slug-not-the-frames-public-url-dec-613-wave-24-amendment` | `app/src/pages/settings/EventSettingsPanel.tsx` `slug: 'Slug',` |

Every claim in this section was already recorded as "settled" in
DEVIATIONS.md's own prose; this wave's job was verifying each cited artifact
actually exists and carries the cited literal (all ten do) rather than
inventing new dispositions.

### ## 8. Wave 9 rulings (DEC-976 / DEC-781 wave-9 amendments) -- 4 rows, all honored

| key | citation |
|---|---|
| `a-pack-frame-that-documents-a-vocabulary-is-not-a-screen` | `src/routes/docs-content/types.ts` `DocsBlock's union is DEC-650's closed nine-block element library` |
| `confirmdialog-gains-no-subtitle-slot` | `app/src/pages/settings/SavedEmbedsPanel.tsx` `Copy rule 3 forbids asserting what no endpoint stores.` |
| `settings-950s-edit-footer-keeps-its-single-close` | `app/src/pages/settings/PeopleRolesPanel.tsx` the edit-drill footer's `onClick={closeEdit}` primary button |
| `contacts-720s-single-stage-pill-page-is-the-phone-register` | `app/src/pages/contacts/PipelineBoard.tsx` `function stageEmptyBody(...)` |

## Re-measured population (was 49 across four sections; now 69 across all nine)

| section | rows |
|---|---|
| ## 1. Ruled omissions | 3 |
| ## 2. State-layer additions | 6 |
| ## 3. Interpretations where the frames underspecify | 18 |
| ## 4. Voice | 1 |
| ## 4a. Docs screenshots | 4 |
| ## 5. Pending adjudication | 1 (divider) |
| ## 6. Deferred post-deadline | 22 |
| ## 7. Settled frame divergences | 10 |
| ## 8. Wave 9 rulings | 4 |
| **total** | **69** |

## Gaps a later wave can drain

Two rows in this ledger are `gap` and both are structural, not offenders to
fix -- there is no code change that would turn either into `honored`:

1. `docs-prose-follows-the-ste-derived-house-rules-not-the-designs-house-voice-note`
   (`## 4`) -- a cross-cutting prose-style policy with no single artifact.
   Could only be closed by either (a) building one canonical
   style-conformance checker that covers the whole policy (should/might
   ambiguity + metaphor + synonym-wobble bans, not just the domain-terms
   glossary), or (b) a future ruling narrowing the claim to something a
   single file can discharge.
2. `5-pending-adjudication-not-yet-blessed-sweep-should-verdict` (`## 5`) --
   a divider row for a section whose entire content is "nothing is open."
   This can only stop being a gap if `## 5` starts drawing a real bullet (a
   new pending adjudication is filed) with its own real citation, or if the
   section is removed from the document entirely (at which point the
   population derivation drops it automatically, no ledger edit needed).

No other row from this wave's twenty new entries is a gap -- all eighteen
bulleted rows resolved to a verifiable, already-shipped artifact on
inspection.
