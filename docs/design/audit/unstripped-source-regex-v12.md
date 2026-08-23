# Unstripped-source-regex family audit (DEC-374 wave-39, task w39-f)

Task w39-f (INSTRUMENT, plus one concrete repair -- see below). Instrument:
`test/unstripped-source-regex.scan.test.ts`. Ratchet:
`UNSTRIPPED_SOURCE_REGEX_CEILING`, in
`app/src/unstripped-source-regex-scan/ceiling.ts` -- seeded at 221 on this
task's own branch, LOWERED to 219 by `v12m-w44-i` (see that section below)
-- measured by forcing the constant to `-1` and reading the printed
offender list back (never by arithmetic). Registered `OUT_OF_CAMPAIGN_SCOPE` in
`scripts/exit-predicate/campaign-scope.ts` (instrument-coverage fact, not
itself a v12 frame or 390-geometry conformance fact -- see that file's own
entry for the reason).

DEC-808 wave-45 amendment (task v12m-w45-c): the merge train landing
v12m-w37-{c..h}/w38-{a..i}/w39-{a..g}/w40-{a..g}/w41-{a..g}/w42-{a..f}
pushed the measured count from the seeded 221 to 227; six files were
repaired (five net-new since the w39-f seed, one substituted per DEC-808
clause (c) after a design-frame HTML repair attempt was rejected) and the
ceiling was re-measured and lowered to 220. See
`app/src/unstripped-source-regex-scan/ceiling.ts`'s own history comment for
the full repair list and roster cross-check. The roster below is the
wave-39 snapshot and is now stale by that delta; it is not re-printed here
(later wave work, same disposition as the rest of this doc's "Disposition"
section already grants).

## Why this instrument exists

The same defect -- a scan-shaped file reads source off disk and applies a
content match to it without ever stripping comments first, so a comment
merely QUOTING a pattern is graded as though it were live code -- has now
silently disabled three separate guards, each fixed at its own site, with
no instrument ever enumerating the family:

1. A CSS comment quoting a frame literal was graded as a violation
   (`comment-blind-css-assertion-scan`'s own origin story, DEC-374).
2. Frame prose quoting product copy was matched as product copy.
3. `test/test-tiers.test.ts`'s `importedModules()` applies
   `IMPORT_SPECIFIER_RE` to raw, un-stripped source, so
   `test/render-sweep-public-gate.test.ts`'s own header sentence ("must
   never import playwright") reads as a real import and the DEC-727 tier
   predicate has been enforcing nothing for an unknown number of waves.
   This instrument counts that offense honestly -- it is included in the
   221-file roster below -- but does NOT repair `test/test-tiers.test.ts`
   or the DEC-727 tier predicate: that repair is owned by `v12m-w38-c`,
   in flight, by this task's own explicit scope boundary.

## Population and detection

Walked (never hand-listed): every `.ts`/`.tsx` file under `test/**` and
`app/src/**`. A file is a candidate if it (a) reads source off disk --
`readFileSync(`/`readdirSync(` -- into a variable/property name (`const X
= readFileSync(...)`, or the `{ ..., X: readFileSync(...) }` object-field
idiom), and (b) applies `.test(`/`.exec(`/`.match(`/`.replace(`/
`.includes(`/`.indexOf(` to that same variable, in either calling
direction (`X.test(...)` or `SOME_REGEX.test(X)`). A file is an OFFENDER if
it is a candidate and carries no comment-stripping step anywhere in the
file: a named `strip[A-Za-z]*[Cc]omments?(` call, an import from
`test/helpers/strip-css-comments.ts`, or an inline comment-shaped
`.replace(/\/\*[\s\S]*?\*\//...)` / `.replace(/\/\/[^\n]*/...)` regex --
this codebase's own real, on-tree, naive-but-genuine local-stripper idiom.

## The one repair landed in this wave

`test/module-reachability.scan.test.ts`'s `extractSpecifiers()` applied
`IMPORT_FROM_RE`/`EXPORT_FROM_RE`/`DYNAMIC_IMPORT_RE` straight to raw
source, with only a type-only-import erasure (`stripTypeOnlyImportExport`)
standing in for real comment stripping. A `//`- or `/* */`-quoted import
specifier in a doc comment could create a FALSE reachability edge -- the
"positive assertion passes vacuously" direction of this bug family (an
orphan module hiding behind a comment that merely mentions how it would be
imported). Fixed by adding a string-aware, char-by-char `stripComments`
(copied verbatim from `test/control-class-conformance.test.ts`'s own
`stripComments`), applied BEFORE `stripTypeOnlyImportExport` and before
specifier extraction. A first attempt used the naive
`.replace(/\/\*[\s\S]*?\*\//g, '')` one-liner instead and was REJECTED on
inspection: on this repo's own TSX corpus
(`app/src/pages/Overview.tsx`), an unbalanced `/*`-looking sequence
elsewhere in the file made the greedy block-comment regex swallow roughly
60% of the file's bytes, up to an unrelated `*/` far away -- three modules
that are genuinely reachable (`AgendaWorkSection.tsx`, `rows.ts`,
`overview.css` under `app/src/pages/overview/`) read as FALSE orphans
under that broken stripper (the naive regex's own over-stripping failure
mode, distinct from the under-stripping defect this whole instrument
exists to catch). The string-aware replacement fixes this: re-running the
scan is fully green, with no new orphans and no `ENTRY_OR_ALLOWED` changes
needed for `app/src/pages/overview/**` at all.

## v12m-w44-i update (DEC-374 wave-44, task w44-i)

Re-measured at 227 on this branch before repair: a merge train added 7
genuine new offenders since the 221-file baseline above (a scan-shaped file
reading source off disk and content-matching it with no stripping step,
same population definition), plus one same-count rename
(`test/frame-control-label.scan.test.ts`'s population walk moved to
`test/frame-control-label/population.ts`, contention decomposition), and
`test/test-tiers.test.ts` dropped OUT of the roster (a prior lane, not this
one, gave it a real `stripTsComments` call before matching).

All 7 new offenders were repaired in this task by adding a genuine
comment-stripping step before their risky content match, reusing shared
strippers (DEC-613, never a private copy): `app/src/phone-hidden-drawn-text.
scan.test.ts`, `test/campaign-scope-registry-partition.scan.test.ts`,
`test/render-sweep-advisory-gate-promotion.scan.test.ts` and
`test/deviations-ledger/resolvers.ts` via the existing
`test/helpers/strip-ts-comments.ts`; `app/src/phone-hidden-drawn-text/
frame-blobs.ts` and `test/desktop-eyebrow-label.scan.test.ts` via a new
shared `test/helpers/strip-html-comments.ts` (a genuinely different
`<!-- -->` comment grammar -- `.dc.html` frame markup and the HTML-comment
syntax GitHub-flavoured Markdown also accepts -- gets its own shared
instrument rather than a bent reuse of the TS or CSS one, DEC-613);
`test/audit-ratchet-statement-drift.scan.test.ts` used both (TS source for
its live-constant read, `.md` audit docs for its statement-drift read).
`test/frame-control-label/population.ts` (the rename target) was also
repaired with the new HTML stripper, even though its rename was already
net-zero against the ceiling. No offender was named genuinely
un-repairable this wave -- all 7 (plus the rename target) had a real,
applicable shared stripper.

Forced to `-1` and the printed roster read back (never arithmetic): **219
files.** `UNSTRIPPED_SOURCE_REGEX_CEILING` in
`app/src/unstripped-source-regex-scan/ceiling.ts` LOWERED from 221 to 219.

## The remaining 219 offenders (roster, read back live -- never hand-edit this list; re-run the scan forced to `-1` to refresh it)

The population is dominated by ordinary component render/CSS tests whose
risk is genuinely lower than the three named instances above: most
`.includes(selector)` calls check a literal, unambiguous class-selector
substring, not a vocabulary ban/require regex a comment could plausibly
satisfy or trip. A handful are true "scan"/"ledger"/"citation" files (the
higher-risk shape the three named instances share) and are better
candidates for a focused future repair lane:
`test/query-scoping-invariant.test.ts`,
`test/write-scoping-invariant.scan.test.ts`,
`test/decision-registry-collision.scan.test.ts`,
`test/decision-doc-citation.scan.test.ts`,
`test/decision-path-references.scan.test.ts`,
`test/desktop-frame-ledger.scan.test.ts`, `test/phone-frame-ledger.scan.test.ts`,
`test/frame-eyebrow-label.scan.test.ts`,
`test/deviations-ledger.scan.test.ts`, `test/design-rulings-ledger.scan.test.ts`.

Full roster (219 files):


- app/src/admin-first-paint.render.test.tsx
- app/src/aria-structure-role.scan.test.ts
- app/src/b7-empty-collection.scan.test.ts
- app/src/b7-empty-table.scan.test.ts
- app/src/byte-size-vocabulary.scan.test.ts
- app/src/components/EventSwitcher.render.test.tsx
- app/src/components/loading-first-paint.scan.test.ts
- app/src/components/modal-form-row-scan.test.ts
- app/src/components/modal-frame-phone.w7g.test.ts
- app/src/components/PageSkeleton.render.test.tsx
- app/src/components/pending-action.scan.test.ts
- app/src/confirm-primary-object.scan.test.ts
- app/src/confirm-verb.scan.test.ts
- app/src/delete-confirm.scan.test.ts
- app/src/dialog-field-vocabulary.test.ts
- app/src/lib/api-cache-single-home.scan.test.ts
- app/src/lib/api-mutation-bump.scan.test.ts
- app/src/optionality-grammar-scan.test.ts
- app/src/pages/agenda/agenda-render-gate.receipt.test.ts
- app/src/pages/comms/comms-tier2-floor.test.ts
- app/src/pages/comms/compose-refusal-shapes.test.ts
- app/src/pages/comms/ComposeTable.columns.test.ts
- app/src/pages/comms/RecentSends.render.test.tsx
- app/src/pages/comms/TemplatesTable.columns.test.ts
- app/src/pages/Contacts.desktop-frame-verdicts.render.test.tsx
- app/src/pages/contacts/contacts-drill-phone-heads.test.ts
- app/src/pages/contacts/contacts-phone-standdown-receipts.test.ts
- app/src/pages/contacts/contacts-role-chip-floor.scan.test.ts
- app/src/pages/contacts/contacts-wave16-citation.scan.test.ts
- app/src/pages/contacts/ContactsTable.render.test.tsx
- app/src/pages/contacts/drawer-overflow.test.ts
- app/src/pages/contacts/DuplicatesView.render.test.tsx
- app/src/pages/contacts/FilterRulesPanel.capSlot.render.test.tsx
- app/src/pages/contacts/ImportWizard.review-table-columns.render.test.tsx
- app/src/pages/contacts/NewContactModal.render.test.tsx
- app/src/pages/Content.frame-verdicts.render.test.tsx
- app/src/pages/content/content-tier2-floor.test.ts
- app/src/pages/content/ContentApp.download-all-flex.receipt.render.test.tsx
- app/src/pages/content/ContentApp.landing390.render.test.tsx
- app/src/pages/content/ContentApp.render.test.tsx
- app/src/pages/content/ContentApp.worklist-390.render.test.tsx
- app/src/pages/content/DeliverableDetail.stack-390.render.test.tsx
- app/src/pages/content/FilesLibrary.render.test.tsx
- app/src/pages/content/SessionList.render.test.tsx
- app/src/pages/forms/FieldModal.frame-residue.render.test.tsx
- app/src/pages/forms/forms-footer-copy-tap-floor.test.ts
- app/src/pages/Overview.desktop-frame-verdicts.render.test.tsx
- app/src/pages/overview/AgendaWorkSection.clash390.render.test.tsx
- app/src/pages/overview/Overview.css.render.test.tsx
- app/src/pages/overview/Overview.phone.render.test.tsx
- app/src/pages/Review-reviewer.desktop-frame-verdicts.render.test.tsx
- app/src/pages/Review.desktop-frame-verdicts.render.test.tsx
- app/src/pages/review/planEditor-refusal-shapes.test.ts
- app/src/pages/review/PlanEditor.heading-390.render.test.tsx
- app/src/pages/review/PlanList.render.test.tsx
- app/src/pages/review/ResultsTable.render.test.tsx
- app/src/pages/review/review-criteria-head-row-390.w6cf.test.ts
- app/src/pages/review/ReviewerQueue.hub-390.render.test.tsx
- app/src/pages/settings/ApiTokensPanel.render.test.tsx
- app/src/pages/settings/ExportsPanel.render.test.tsx
- app/src/pages/settings/SavedEmbedsPanel.render.test.tsx
- app/src/pages/settings/section-key-parity.scan.test.ts
- app/src/pages/settings/SessionboardImportPanel.render.test.tsx
- app/src/pages/settings/settings-drill-phone-frames.test.ts
- app/src/pages/settings/settings-field-width.test.ts
- app/src/pages/settings/settings-overflow-390.w5p.test.ts
- app/src/pages/settings/settings-phone-frames.test.ts
- app/src/pages/settings/settings-track-edit-row-390.w5bg.test.ts
- app/src/pages/settings/Settings.hub390.render.test.tsx
- app/src/pages/settings/SummarySection.phone-drill-head.render.test.tsx
- app/src/pages/Speakers.desktop-frame-verdicts.render.test.tsx
- app/src/pages/speakers/SpeakerDetailPage.render.test.tsx
- app/src/pages/Submissions.frame-verdicts.render.test.tsx
- app/src/pages/submissions/detail-390-headings.test.ts
- app/src/pages/submissions/detail-css.test.ts
- app/src/pages/submissions/submissions-css.test.ts
- app/src/pages/submissions/submissions-decision-pair-floor.scan.test.ts
- app/src/pages/submissions/submissions-phone-card.test.ts
- app/src/pages/submissions/submissions-phone-frames.test.ts
- app/src/pages/submissions/submissions-table-columns.render.test.tsx
- app/src/pagination-summary.scan.test.ts
- app/src/phone-verdict-cascade-read.scan.test.ts
- app/src/refusal-rendering-ledger.scan.test.ts
- app/src/routeManifest.test.ts
- app/src/send-failure-reason.scan.test.ts
- app/src/server-bound-parity.scan.test.ts
- app/src/status-vocabulary.scan.test.ts
- app/src/text-caps.scan.test.ts
- test/account-docs-phone-frames.test.ts
- test/account-password-phone.test.ts
- test/account-signin-phone.test.ts
- test/admin-390-offender-roster.scan.test.ts
- test/answer-text-single-source.scan.test.ts
- test/audit-claims.test.ts
- test/cap-copy-single-source.scan.test.ts
- test/cfp-phone-submit-relining.test.ts
- test/chunk-sweep-exports.test.ts
- test/chunk-sweep-overview.test.ts
- test/claim-mint-guard-population.test.ts
- test/clarifications-ledger.scan.test.ts
- test/copy-no-hardcoded-host.scan.test.ts
- test/credential-url-redaction.scan.test.ts
- test/cross-org-refusal-vocabulary.scan.test.ts
- test/d1-bind-safety.test.ts
- test/decision-doc-citation.scan.test.ts
- test/decision-path-references.scan.test.ts
- test/decision-registry-collision.scan.test.ts
- test/design-rulings-ledger.scan.test.ts
- test/desktop-control-floor.scan.test.ts
- test/desktop-control-label.scan.test.ts
- test/desktop-field-width.scan.test.ts
- test/desktop-frame-ledger.scan.test.ts
- test/deviations-ledger.scan.test.ts
- test/docs-figure-availability.test.ts
- test/docs-group-vocabulary.test.ts
- test/docs-route-coverage.test.ts
- test/docs-ste.scan.test.ts
- test/drawn-field-label.scan.test.ts
- test/email-log-single-author.scan.test.ts
- test/email-shell-sweep.scan.test.ts
- test/entity-decode-coverage.scan.test.ts
- test/epoch-validation-enumeration.test.ts
- test/evaluation-read-doors-submitted.scan.test.ts
- test/evaluation-read-draft-gate.scan.test.ts
- test/evaluation-read-recusal-population.test.ts
- test/evaluation-scores-json.test.ts
- test/event-days-single-source.scan.test.ts
- test/exports-bounds.test.ts
- test/field-length-limits.test.ts
- test/file-delete-edit-lock.test.ts
- test/file-put-compensation.scan.test.ts
- test/file-serve-content-type.test.ts
- test/files-reviewer-submission-write.test.ts
- test/filter-token-loudness.scan.test.ts
- test/fixed-table-column-hack.scan.test.ts
- test/form-title-unique.test.ts
- test/frame-eyebrow-label.scan.test.ts
- test/headshot-upload-contract.test.ts
- test/helpers/composed-label-resolve.ts
- test/helpers/index-mounts.ts
- test/helpers/ssr-css-sources.ts
- test/import-row-cap-single-source.scan.test.ts
- test/js-paged-read-bounded.scan.test.ts
- test/json-column-parser-ownership.scan.test.ts
- test/kv-r2-loop.scan.test.ts
- test/link-targets-scan.test.ts
- test/list-filter-vocabulary.test.ts
- test/mail-swallow-honesty.scan.test.ts
- test/manifest-parity-exports.test.ts
- test/migration-parity.test.ts
- test/mint-door-cap-census.scan.test.ts
- test/onboarding-grid-driving-relation.test.ts
- test/page-skeleton-coverage.scan.test.ts
- test/participant-invite-audience.scan.test.ts
- test/perf-smoke.test.ts
- test/phone-frame-ledger.scan.test.ts
- test/phone-wrap-conformance.test.ts
- test/plan-evaluation-scan-cap.scan.test.ts
- test/plan-rounds-bound.test.ts
- test/portal-copresenters.test.ts
- test/portal-header-identity.test.ts
- test/portal-remaining-phone-frames.test.ts
- test/portal-settings-default-single-source.test.ts
- test/portal-upload-refusal.test.ts
- test/pubcache-key-param-derivation.scan.test.ts
- test/public-390-inline-link-grounding.test.ts
- test/public-390-offender-roster.scan.test.ts
- test/public-error-shape.test.ts
- test/public-filter-submit-pairing.scan.test.ts
- test/public-session-gate.scan.test.ts
- test/query-scoping-invariant.test.ts
- test/quickstart-contract.test.ts
- test/rate-limit-atomicity.test.ts
- test/rate-limit-spend-refund.scan.test.ts
- test/readme-evaluator-surfaces.test.ts
- test/render-sweep-lib.test.ts
- test/render-sweep-public-gate.test.ts
- test/response-headers-scan.test.ts
- test/retired-symbol.scan.test.ts
- test/role-answer-single-source.scan.test.ts
- test/role-label-spelling.scan.test.ts
- test/room-label-single-source.scan.test.ts
- test/room-ownership-one-owner.test.ts
- test/route-manifest-authz-parity.scan.test.ts
- test/route-manifest-fixture-coverage.test.ts
- test/route-substate-coverage.scan.test.ts
- test/schedule-copy.test.ts
- test/schema-migration-parity.scan.test.ts
- test/score-grammar-single-source.scan.test.ts
- test/security-invariants.test.ts
- test/seed.test.ts
- test/server-date-format-single-source.test.ts
- test/server-middleware.test.ts
- test/session-rotation.test.ts
- test/session-vocabulary-sweep.scan.test.ts
- test/sessionboard-expectations-ledger.scan.test.ts
- test/spa-count-source-ledger.scan.test.ts
- test/spa-envelope-reader-ledger.scan.test.ts
- test/spa-internal-links.scan.test.ts
- test/spa-mock-route-contract.scan.test.ts
- test/ssr-button-vocabulary.scan.test.ts
- test/ssr-declared-target.scan.test.ts
- test/ssr-document-lang.test.ts
- test/ssr-empty-collection.scan.test.ts
- test/ssr-form-csrf.scan.test.ts
- test/ssr-link-targets-scan.test.ts
- test/suite-timeout-policy.scan.test.ts
- test/support/list-envelope-enumeration/pagination-const-scan.ts
- test/task-title-unique.test.ts
- test/text-cap-declaration.scan.test.ts
- test/text-vocabulary.scan.test.ts
- test/theme-tap-floor-scope.test.ts
- test/touch-on-write-population.scan.test.ts
- test/unique-index-guard-coverage.scan.test.ts
- test/upload-cap-single-source.test.ts
- test/user-content-nosniff.test.ts
- test/verification-log-assemble.test.ts
- test/walkthrough-day-label-clock.test.ts
- test/write-scoping-invariant.scan.test.ts

## Disposition

Migrating this roster to the shared/string-aware stripper (or a per-file
inline stripper, for the files whose match is genuinely CSS-only) is later,
separately-ruled wave work -- the same disposition
`comment-blind-css-assertion-scan`'s own first landing gave its 39-file
population (wave-152, task w8-ef). This wave ships the instrument, one
concrete repair (`test/module-reachability.scan.test.ts`), and the
`ENTRY_OR_ALLOWED` entries the repair's own newly-surfaced orphans required.

## Wave-44 update (thunderdome medic)

Re-measured live on the composed megabatch tree, not inherited from this
doc's own roster above. Two independent moves, both accounted for file by
file in `app/src/unstripped-source-regex-scan/ceiling.ts`'s own header:

- **-1**: `test/test-tiers.test.ts` is no longer an offender. Task
  `v12m-w38-c` landed the repair this instrument's seeding note said would
  "flip this row" -- the DEC-727 tier predicate now strips comments before
  applying its import regex. The scan's pin asserting that file is still an
  offender was inverted into a regression guard in the same commit, so the
  repair cannot silently come undone.
- **+7**: seven scan-shaped files landed by lanes that branched *before*
  this instrument was seeded, so no lane could see the family it was
  joining: `app/src/phone-hidden-drawn-text/frame-blobs.ts`,
  `test/audit-ratchet-statement-drift.scan.test.ts`,
  `test/campaign-scope-registry-partition.scan.test.ts`,
  `test/desktop-eyebrow-label.scan.test.ts`,
  `test/deviations-ledger/resolvers.ts`,
  `test/frame-control-label/population.ts` and
  `test/render-sweep-advisory-gate-promotion.scan.test.ts`. Each was
  confirmed absent at the seeding commit by `git log --diff-filter=A`.

221 - 1 + 7 = 227, and the live walk prints the same. None of the
seven is repaired here: adding a stripping step to a ratchet instrument
changes what it measures, and three of the seven carry ceilings of their
own, so each repair is its own re-ratcheting wave -- the same disposition
recorded above. Live measurement today:
`UNSTRIPPED_SOURCE_REGEX_CEILING = 227`.

**Update (task w50-d, wave 50)**: `UNSTRIPPED_SOURCE_REGEX_CEILING` moved
`227` -> `219` since the paragraph above was written (live value
re-measured at this task's branch point,
`app/src/unstripped-source-regex-scan/ceiling.ts:235`) -- further offenders
drained by other lanes, not repaired by this docs-only task.
