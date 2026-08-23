# Phone hidden-drawn-TEXT ledger, phone (width:390) — DEC-725 wave-31 amendment

Instrument: `app/src/phone-hidden-drawn-text.scan.test.ts`. This ledger names
the pack's population that `app/src/phone-capability-removal.scan.test.ts`
(DEC-919) does not grade: a phone `display:none` rule whose hidden `chq-`
token carries **TEXT** (not an interactive control) the pack's own 390 frame
extents still draw. `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s population is
INTERACTIVE selectors keyed on a `/* phone-hidden: <reason> */` receipt; a
bare `<span>`/`<div>` carrying copy sits entirely outside it, and the prose
reason written above such a rule (e.g. "never paints at this width") is a
claim nothing previously checked. This file MEASURES AND RATCHETS ONLY — it
moves no product byte and no CSS.

## Worked example (the amendment's own motivating case)

`app/src/pages/review/review.css`'s terminal phone block sets
`.chq-review-criteria-eyebrow` and `.chq-review-criteria-head-row` to
`display: none`, arguing in its own comments that the eyebrow "never paints
at this width" and that "once the body rows below collapse to stacked cards
there are no columns left to label". `docs/design/Chautauqua Review.dc.html`'s
"Plan editor · 390" frame (line 594) draws `Weight` as a PER-CRITERION
eyebrow **inside** that very stacked card. `app/src/pages/review/PlanEditor.tsx`'s
`.chq-review-criteria-head-row` block carries a nested
`.chq-review-criteria-head-cell` span whose own static text is `Weight ` —
that literal is drawn verbatim inside the frame's phone extent, so the
premise is FALSE. `.chq-review-criteria-eyebrow`'s own text is either
composed (a "Locked — N scored..." sentence built from a live count) or a
static sentence ("Scores average by weight") that resolves against no frame
extent, so it grades UNVERIFIABLE rather than PREMISE-OK (a composed finding
on the same token means the join cannot fully clear the rule).

Both rows are graded and recorded in the rosters below. See "Both
worked-example rows, re-measured under scoping + twin detection" below for
each row's current grade against the live tree.

## Population (DEC-808, directory walk, never a hand list)

1. **CSS side** — every phone (`max-width <= 700px`) `display: none` rule in
   `app/src/**/*.css` and `src/**/*.ts` files declaring an exported CSS
   template literal — REUSED verbatim from
   `app/src/phone-capability-removal.scan.test.ts`'s exported
   `PHONE_DISPLAY_NONE_RULES` (comment-aware, brace-matched media-block
   walk; DEC-613, never re-implemented). Unlike that file, this ledger does
   NOT narrow to "interactive" — plain prose is squarely its subject.
2. **TSX side** — every `chq-…` class token on every element under
   `app/src/**` / `src/**` (`enumerateSourceFiles` + `stripComments` from
   `test/frame-source-corpus.ts`, DEC-613), walked to its BALANCED matching
   close tag (a token's own text may sit behind further nested markup, the
   worked example above) and every text/JSX-expression run inside that
   block, keyed by whether it is a static literal or a composed JSX
   expression. A candidate must carry at least 3 consecutive letters to
   count as real prose (bare punctuation/interpolation noise from the walk
   can never manufacture a finding).
3. **Frame side** — every `width:390px`/`height:844` phone frame extent in
   `docs/design/*.dc.html`, walked with the SAME frame/label/extent-end
   grammar `test/frame-eyebrow-label.scan.test.ts` and
   `test/frame-control-label.scan.test.ts` already share (ported, this
   campaign's standing convention), matched with `labelIsMatched` /
   `normalizeSource` imported verbatim from `test/frame-source-corpus.ts`
   (DEC-613).

A CSS rule enters the graded population only if some `chq-` token on its
selector has at least one text-bearing finding; a rule with no text-bearing
element at all (a decorative/layout-only hide) is outside this population
entirely — disjoint from `PHONE_HIDDEN_UNRECEIPTED_CEILING`'s own
INTERACTIVE population by construction.

## Grade (DEC-725 wave-31 amendment clause (c), wave-35 amendment adds TWIN-RESOLVED)

- **PREMISE-FALSE**: some static (non-composed) text finding for the rule's
  tokens occurs verbatim in the OWNING CLUSTER's own width:390 frame extent
  (wave-35: scoped, see below), with no visible twin resolving it — the
  hide's own premise is contradicted by the pack.
- **TWIN-RESOLVED** (wave-35): the same PREMISE-FALSE condition holds, but
  some OTHER `chq-` token that is never phone-hidden anywhere in the tree
  carries the identical static text on the SAME cluster surface — the
  frame's requirement is met by that still-visible twin, not by the hidden
  element. Recorded with its own reason (which twin, and where), never
  folded into PREMISE-OK silently (DEC-180). Counted in neither ratchet.
- **UNVERIFIABLE**: no static finding resolves against any frame, but at
  least one finding for the rule's tokens IS composed — the join technique
  is a static substring test and can never verify a value assembled at
  render time. Recorded WITH its reason, never a silent pass (DEC-180).
- **PREMISE-OK**: every text-bearing finding is static and none occurs in
  any frame extent — the hide's premise holds against the pack as measured.

## Cluster-scoped join + twin detection (wave-35 amendment, DEC-725)

The join was previously a **verbatim literal match against every width:390
frame extent in the pack**, not scoped to the hidden rule's own page or
feature. Short, common UI words ("Save", "Open", "Cancel", "Sign out",
"Agenda") legitimately recur across many unrelated frames, so a majority of
the original 59 PREMISE-FALSE rows were coincidental cross-page agreement
rather than a same-screen contradiction (`.chq-agenda-armed-bar` hiding
"Cancel" was flagged by the Account "Change password · 390" frame). This
amendment closes that gap two ways, both in
`app/src/phone-hidden-drawn-text.scan.test.ts`:

1. **Cluster scoping.** A sheet under `app/src/pages/<cluster>/*` is joined
   only against `docs/design/Chautauqua <Cluster>.dc.html`'s own frame
   extents (derived by name normalisation from the directory, never a hand
   list — `clusterKeyForPath`/`scopeBlobsForSheet`). An SSR sheet under
   `src/routes/public/**` or `src/routes/portal/**` is joined only against
   `Chautauqua Public and Portal.dc.html`; one under `src/routes/docs*` only
   against `Chautauqua Docs.dc.html`. Two kinds of sheet EXPLICITLY keep the
   full-pack join rather than being silently narrowed, both asserted by
   name in the instrument: the shared roots `app/src/styles.css` and
   `src/views/theme.ts`, and any sheet whose derived cluster has no
   same-named frame file (`app/src/pages/forms/forms.css` — there is no
   `Chautauqua Forms.dc.html`; `src/routes/auth.css.ts` — matches none of
   the three SSR prefixes).
2. **Twin detection**, reusing `phone-capability-removal.scan.test.ts`'s own
   precedent for this exact shape (its closed-row prose: `.chq-detail-back-
   full` was receipted "as a desktop twin: the SAME back link's phone label
   is `.chq-detail-back-short`") rather than a second copy of that judgment
   (DEC-613). A candidate additionally resolves to TWIN-RESOLVED when some
   OTHER `chq-` token, never itself phone-hidden anywhere in the tree,
   carries the identical static text on the SAME cluster surface. A
   candidate twin must also name exactly ONE distinct static text across
   the whole tree — this excludes bulk container tokens (a page-root
   wrapper like `chq-page` absorbs every nested string on its page through
   the balanced-close-tag walk, and is not a genuine twin label) without
   hand-listing wrapper token names (DEC-808).

Both mechanisms share ONE `clusterKeyForPath` normalisation (DEC-613) —
cluster scoping and "same phone surface" for twin detection are the same
population key, not two private notions of surface.

## TSX-side cluster scoping + generic-verb corroboration (wave-39 amendment, DEC-725)

Wave-35 scoped the FRAME side of the join to each sheet's own cluster
(`scopeBlobsForSheet`) but left the TSX side global: a text finding from ANY
component anywhere in the tree could still supply the literal that grades
ANY sheet's rule, because nothing checked that the finding's OWN file
belonged to the rule's cluster. The roster convicted itself: `.chq-agenda-
head-actions .chq-btn-secondary` (agenda.css, cluster "agenda") was graded
PREMISE-FALSE on the word "Cancel" sourced from `app/src/components/
EventSwitcher.tsx` — a shared component `clusterKeyForPath` returns
`undefined` for, matched only by coincidence against the Agenda frame.
Three changes, all in `app/src/phone-hidden-drawn-text.scan.test.ts`:

1. **TSX-side cluster scoping** (`findingsScopedForSheet`) — mirrors
   `scopeBlobsForSheet`'s own `clusterKeyForPath` normalisation (DEC-613,
   never a second cluster vocabulary): a `cluster`-scope sheet's candidate
   findings are narrowed to files resolving to that SAME cluster key.
   `shared-root` and `no-frame-fallback` sheets keep the full, unscoped
   finding population, mirroring the frame-side fallback those same two
   kinds already receive.
2. **Generic-verb corroboration** — even within one cluster, a single short,
   generic control word ("Cancel", "Edit", "Save", "Open", "Approve") drawn
   by one component and hidden by an unrelated rule in the SAME cluster is
   still coincidental agreement, not a same-screen contradiction. A
   candidate whose entire text is a single GENERIC verb — derived from the
   corpus, never a hand list (DEC-180): a word recurring as the complete,
   static, own-text of controls in `GENERIC_VERB_MIN_COMPONENTS` (3) or more
   DISTINCT files (`genericVerbsIn`) — may not, alone, produce PREMISE-FALSE.
   It needs corroboration from another finding among the SAME rule's own
   matches that also resolves against a frame extent: a longer multi-word
   run, or the identical token repeating the same text (`hasCorroboration`).
3. **CSS-selector class-token fix** — `tokensOf(selector)` previously
   matched any `chq-` substring anywhere in the selector text, including
   inside an ATTRIBUTE NAME: `[data-chq-cfp-step="1"] .chq-cfp-step-back`
   embeds the substring `chq-cfp-step` inside `data-chq-cfp-step` (never a
   class selector), which pulled in every `.chq-cfp-step` finding —
   including the unrelated "You" section label three sections away — as if
   it were a real match for `.chq-cfp-step-back`/`.chq-cfp-step-next`/
   `.chq-cfp-step-talk`'s own rule. `tokensOf` now requires a leading `.`
   (`CSS_CLASS_TOKEN_RE`): a genuine class selector only, never a substring
   of an attribute name. This is the SAME shape as (1), one layer earlier in
   the pipeline: a token the rule's own selector never actually named
   supplying the literal that condemns it.

Negative controls (both directions, proving this is a repaired predicate and
not merely a lowered ceiling): a synthetic IN-CLUSTER multi-word match still
grades PREMISE-FALSE; a synthetic CROSS-CLUSTER single-verb match grades
PREMISE-OK once TSX-side scoping excludes the stranger component.

## Ratchet: measured `-1`, two constants, both two-sided

`PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING = 20`,
`PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING = 49` (wave-39, re-measured
against the TSX-cluster-scoped + generic-verb-corroborated + class-token-only
instrument; down from 28/40 for PREMISE-FALSE, up for UNVERIFIABLE — rows
that were PREMISE-FALSE only via a cross-component match, an uncorroborated
bare verb, or the `data-chq-cfp-step` token-extraction bug fall through to
their own composed finding instead, exactly as wave-35 recorded for cluster
scoping). Both registered in `scripts/exit-predicate.ts`'s
`OUT_OF_CAMPAIGN_SCOPE` (a newly-derived, previously-uncounted population
must not move the campaign's goalposts mid-convergence — the same
disposition already given to `FRAME_EYEBROW_DIVERGENCE_CEILING` /
`FRAME_EYEBROW_UNRESOLVED_CEILING`). Both carry a companion "never sits
ABOVE the measured truth" `it` (two-sided, per
`test/campaign-ratchet-two-sided.scan.test.ts`). TWIN-RESOLVED (19 rows,
wave-39) is graded and recorded in the roster below but counted in neither
ratchet.

## Wave-42 amendment (DEC-967): extent derivation clipped at the template close

Wave 41 found that every frame-extent derivation in the tree computed
`extentEnd: nextLabel ? nextLabel.line : Infinity`, which lets the LAST
labelled block of a `docs/design/*.dc.html` file swallow the file's own
`</x-dc>` template close and everything after it — including the whole
`<script data-dc-script>` fixture body. This file's own `framesInFile`
(the frame-side population walk feeding both `TEXT_FINDINGS`-joined
rosters below) had exactly this shape and was in NONE of v12m-w41-{b,c,d}'s
scope.

**Fix**: a `templateCloseLine(fullPath)` helper (ported, not imported, from
`test/phone-frame-ledger.scan.test.ts`'s v12m-w41-c shape — this campaign's
standing "port, don't cross-import a population walk" convention) resolves
the file's single `</x-dc>` line and throws loudly on zero or multiple
matches; `framesInFile`'s `extentEnd` is now
`Math.min(nextLabel ? nextLabel.line : Infinity, templateCloseLine(full))`.
A synthetic control fixture (mirroring the w41-c precedent) proves a
label-shaped string placed BEFORE a fabricated `</x-dc>` stays inside the
clipped extent, and the identical shape placed AFTER it falls outside.

**Per-row delta, measured by forcing each ceiling to `-1` and re-reading the
printed roster**: both ceilings are **UNCHANGED** —
`PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` stays 28 (all 28 rows
SURVIVED against the clipped extent) and
`PHONE_HIDDEN_DRAWN_TEXT_UNVERIFIABLE_CEILING` stays 40 (all 40 rows
SURVIVED). Zero rows evaporated. This means none of the 28 PREMISE-FALSE or
40 UNVERIFIABLE matches in the current rosters below were matching against
swallowed `<script data-dc-script>` fixture JavaScript rather than pack
markup — every one is a real match against drawn frame content (or, for
UNVERIFIABLE, a real composed-text miss), and each row named individually
in the "PREMISE-FALSE roster" / "UNVERIFIABLE roster" sections below is a
genuine phone conformance divergence (or an unresolvable composed-text
claim), not an instrument artefact of the unclipped extent. Nothing in
this file's rosters needs re-attribution as a result of the clip.

**Completeness ratchet**: a two-sided `UNCLIPPED_EXTENT_DERIVATION_CEILING`
counts every `.ts`/`.tsx` file under `app/src`, `src`, `test` and `scripts`
that derives an `extentEnd` from a `.dc.html` label scan (matched by the
same `font-size:19px` marker every frame walk in this campaign keys on)
without also containing `templateCloseLine`. Seeded at 10 at wave-42; the
w41 clip lanes it named (`app/src/frame-citation-frames.ts`,
`desktop-control-floor.scan.test.ts`, `frame-control-floor.scan.test.ts`,
`phone-frame-ledger.scan.test.ts`, `frame-eyebrow-label.scan.test.ts`,
`phone-dock-ledger.scan.test.ts`, `frame-control-label.scan.test.ts`,
`desktop-frame-ledger.scan.test.ts`, `desktop-control-label.scan.test.ts`,
`desktop-field-width.scan.test.ts`) landed on main via the wave-44 merge
train, dropping the measured count to 1: the sole remaining offender was
`test/desktop-eyebrow-label.scan.test.ts`, whose own extent derivation
already clipped correctly at its file's single `</x-dc>` close but did so
through a private `xdcCloseLine(lines: string[])` port rather than the
literally-named `templateCloseLine` this scan's predicate greps for — a
naming gap, not a real unclipped extent. w44-b renamed that port to
`templateCloseLine(fullPath: string)`, the exact name and signature every
sibling ledger (`test/frame-eyebrow-label.scan.test.ts`,
`app/src/phone-hidden-drawn-text/frame-blobs.ts`) already carries, closing
the measured population to 0. `UNCLIPPED_EXTENT_DERIVATION_CEILING` now
reads 0. As with every other ratchet in this campaign, it may only be
RAISED by a future re-measurement; a future ledger that copies the OLD
unclipped shape must TIGHTEN it back down in the same commit.

## Both worked-example rows, re-measured under scoping + twin detection

- `.chq-review-criteria-head-row` is now **TWIN-RESOLVED**, not
  PREMISE-FALSE. `app/src/pages/review/PlanEditor.tsx`'s
  `.chq-review-criterion-weight` (built by `v12m-w31-a`/DEC-745, same wave
  as this row's own worked example) now carries a real, still-visible
  PER-CRITERION "Weight" eyebrow inside the stacked card — exactly the
  frame requirement `Chautauqua Review.dc.html:594` draws. The frame's
  requirement is met by that twin; the still-hidden head-row is no longer
  the pack's only source for the word.
- `.chq-review-criteria-eyebrow` stays **UNVERIFIABLE**. Its text child is
  assembled at render time from a live count, and a static substring join
  can never verify a composed value — an instrument-completeness fact about
  this scan's own technique, untouched by scoping or twin detection.

This file's own probe assertions pin both gradings against the LIVE tree,
so neither claim here rests on this prose: if a later wave changes either
row, those probes fail and force this section to be rewritten rather than
letting it quietly go stale.

## PREMISE-FALSE roster (20 rows)

- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-title-row .chq-summary` -- "Contacts" (app/src/pages/contacts/ContactsApp.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:179 "Contacts"
- `app/src/pages/content/content.css` :: `.chq-content-worklist .chq-bulkbar` -- "Approve" (app/src/pages/content/SessionList.tsx) is drawn verbatim at Chautauqua Content.dc.html:198 "Content"
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-bulkbar-count` -- "Approve" (app/src/pages/content/SessionList.tsx) is drawn verbatim at Chautauqua Content.dc.html:198 "Content"
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-bulkbar-actions .chq-btn-tertiary` -- "Approve" (app/src/pages/content/SessionList.tsx) is drawn verbatim at Chautauqua Content.dc.html:198 "Content"
- `app/src/pages/content/content.css` :: `.chq-content-comment-actions` -- "Ask for changes" (app/src/pages/content/CommentThread.tsx) is drawn verbatim at Chautauqua Content.dc.html:373 "Session · deliverable"
- `app/src/pages/review/scorecard.css` :: `.chq-review-overall-line:has(.chq-review-overall-value-phone) .chq-review-overall-value` -- "Overall" (app/src/pages/review/Scorecard.tsx) is drawn verbatim at Chautauqua Review.dc.html:280 "Reviewer scorecard · /review/plans/:id/submissions/:id"
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-drillrow-head-hide` -- "Add a track" (app/src/pages/settings/TracksRoomsPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:347 "Settings · Tracks and rooms"
- `app/src/pages/settings/settings-lists.css` :: `.chq-settings-token-create .chq-btn-primary, .chq-settings-people-invite-action` -- "Invite someone" (app/src/pages/settings/PeopleRolesPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:552 "Settings · People and roles"
- `app/src/pages/settings/settings.css` :: `[data-screen='true'] .chq-settings-saved-embed-heading` -- "Saved embeds" (app/src/pages/settings/SavedEmbedsPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:578 "Settings · Saved embeds"
- `app/src/pages/settings/settings.css` :: `.chq-settings-public-pages-own-hidden` -- "Public pages" (app/src/pages/settings/PublicPagesPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:481 "Settings · Public pages"
- `app/src/pages/submissions/detail.css` :: `.chq-detail-page .chq-participants-table thead` -- "Triage" (app/src/pages/submissions/SubmissionDetailPage.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:355 "Submission detail"
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-table thead` -- "Accept" (app/src/pages/submissions/SubmissionsTable.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:137 "Submissions"
- `app/src/styles.css` :: `.chq-shell:has([data-chq-phone-head]) .chq-header` -- "chautauqua" (app/src/App.tsx) is drawn verbatim at Chautauqua Account.dc.html:121 "Sign in · 390" -- OPENED wave-51 (see "Wave-51 amendment" section below): INSTRUMENT ARTEFACT, literal owned by the sign-in page's own heading, not by this shell rule's screen
- `app/src/styles.css` :: `.chq-header-identity .chq-user-identity` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id" -- OPENED wave-51 (see "Wave-51 amendment" section below): CORRECTLY DRAWN OPT-OUT, the frame draws the reviewer drill-in's own docked Sign out in its place
- `app/src/styles.css` :: `.chq-shell:has(.chq-phone-dock) .chq-tabbar` -- "Save" (app/src/pages/comms/TemplatesTab.tsx) is drawn verbatim at Chautauqua Comms.dc.html:286 "Templates · 390" -- OPENED wave-51 (see "Wave-51 amendment" section below): CORRECTLY DRAWN OPT-OUT, the frame draws the Templates editor's own docked Save/Cancel in its place
- `app/src/styles.css` :: `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` -- "Sign out" (app/src/App.tsx) is drawn verbatim at Chautauqua Review.dc.html:413 "Reviewer queue · /review/plans/:id" -- OPENED wave-51 (see "Wave-51 amendment" section below): INSTRUMENT ARTEFACT, literal owned by the same drill-in dock Row above already resolves, not by this modal-portal rule's own mechanism
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="1"] .chq-cfp-step-you` -- "You" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)` -- "Save draft" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:505 "Portal · Hotel stay form"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="2"] .chq-cfp-step-next` -- "Next: about you" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1017 "Submit a talk"
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="all"] .chq-cfp-steps, [data-chq-cfp-step="all"] .chq-cfp-step-next, [data-chq-cfp-step="all"] .chq-cfp-step-back` -- "Next: about you" (src/routes/public/submit-views.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:1017 "Submit a talk"

These 20 rows survived TSX-side cluster scoping, generic-verb corroboration
AND the class-token-only fix -- each is a genuine, in-cluster, either
multi-word or corroborated same-token match, and is a candidate for a future
repair lane naming its own sheet/selector/frame line above.

## UNVERIFIABLE roster (49 rows)

- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-day-tabs` -- app/src/pages/Agenda.tsx :: chq-agenda-day-tabs renders a composed (non-static) text child: "{formatDayLabel(day)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-summary` -- app/src/pages/Agenda.tsx :: chq-agenda-summary renders a composed (non-static) text child: "{`${agenda?.summary.unplaced ?? 0} unplaced · `}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-head-actions .chq-btn-secondary` -- app/src/pages/Agenda.tsx :: chq-agenda-head-actions renders a composed (non-static) text child: "{autoSchedulePendingLabel.label}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-armed-bar` -- app/src/pages/Agenda.tsx :: chq-agenda-armed-bar renders a composed (non-static) text child: "{armed && (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-batch-recipients .chq-comms-recipient-col-heads-row` -- app/src/pages/comms/RecentSends.tsx :: chq-comms-batch-recipients renders a composed (non-static) text child: "{statusTally(statusCounts)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-batch-recipients .chq-comms-recipient-row > span:empty` -- app/src/pages/comms/ComposeWizard.tsx :: chq-comms-recipient-row renders a composed (non-static) text child: "{r.name}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-templates-table thead` -- app/src/pages/comms/TemplatesTab.tsx :: chq-comms-templates-table renders a composed (non-static) text child: "{t.name}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/comms/comms.css` :: `.chq-comms-compose-table thead` -- app/src/pages/comms/ComposeWizard.tsx :: chq-comms-compose-table renders a composed (non-static) text child: "{s.title}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-pipeline-columns` -- app/src/pages/contacts/PipelineBoard.tsx :: chq-contacts-pipeline-columns renders a composed (non-static) text child: "{PIPELINE_STAGE_LABELS[stage]}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-compare-head` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-compare-head renders a composed (non-static) text child: "{keepHeadLabel}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-columns` -- app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-columns renders a composed (non-static) text child: "{ const sample = dataRows[0]?.[i] ?? ''; const skipped = !mapping[col]; return (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-review-table thead` -- app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-review-table renders a composed (non-static) text child: "{row.line}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-primary-desktop-label` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-primary-desktop-label renders a composed (non-static) text child: "{keepContact ? `Merge into ${keepContact.firstName} ${keepContact.lastName}` : 'Merge'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-merge-impact-name` -- app/src/pages/contacts/MergePage.tsx :: chq-contacts-merge-impact-name renders a composed (non-static) text child: "{keepContact.firstName} {keepContact.lastName}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-import-subtitle-desktop` -- app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-subtitle-desktop renders a composed (non-static) text child: "{(fileName ?? 'Pasted CSV') + ' · ' + countOf(dataRows.length, 'row')}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-filter-match-count` -- app/src/pages/contacts/FilterRulesPanel.tsx :: chq-contacts-filter-match-count renders a composed (non-static) text child: "{totalCount === null ? `${matchCount} match` : `${matchCount} of ${totalCount} match`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-rail` -- app/src/pages/contacts/DirectoryRail.tsx :: chq-contacts-rail renders a composed (non-static) text child: "{ } {topCompaniesLoaded && topCompanies.length === 0 ? (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-segment-summary` -- app/src/pages/contacts/ContactsApp.tsx :: chq-contacts-segment-summary renders a composed (non-static) text child: "Segment: { }" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-filter-rules-row` -- app/src/pages/contacts/FilterRulesPanel.tsx :: chq-contacts-filter-rules-row renders a composed (non-static) text child: "{ const pos = i + 1; const custom = isCustomField(rule.field); const fieldSelectValue = custom ? CUSTOM_FIELD_CHOICE : rule.field; const customKey = customKeyOf(rule.field); return (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/content.css` :: `.chq-content-files-download-all-wrap` -- app/src/pages/content/FilesLibrary.tsx :: chq-content-files-download-all-wrap renders a composed (non-static) text child: "{downloadPending ? 'Downloading…' : items.length === total ? `Download all ${items.length} (.zip)` : `Download ${countOf(items.length, 'file')} (.zip)`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/upload-zone.css` :: `.chq-content-upload-caps` -- app/src/pages/content/UploadZone.tsx :: chq-content-upload-caps renders a composed (non-static) text child: "{uploadHintText(kind)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/content/upload-zone.css` :: `.chq-content-upload-prompt-desktop` -- app/src/pages/content/UploadZone.tsx :: chq-content-upload-prompt-desktop renders a composed (non-static) text child: "{uploadPendingLabel.label}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/forms/forms.css` :: `.chq-forms-field-kind, .chq-forms-field-required, .chq-forms-field-optional, .chq-forms-field-help, .chq-forms-field-condition` -- app/src/pages/forms/FieldList.tsx :: chq-forms-field-help renders a composed (non-static) text child: "{row.caption}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/forms/forms.css` :: `.chq-forms-header-actions` -- app/src/pages/forms/FormsPage.tsx :: chq-forms-header-actions renders a composed (non-static) text child: "{windowSaving ? 'Saving…' : 'Save'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/overview/overview.css` :: `.chq-overview-overflow` -- app/src/pages/Overview.tsx :: chq-overview-overflow renders a composed (non-static) text child: "{payload.overdueTasks.total - payload.overdueTasks.rows.length} more overdue" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/overview/overview.css` :: `.chq-overview-clash-entries-desktop` -- app/src/pages/overview/AgendaWorkSection.tsx :: chq-overview-clash-entries-desktop renders a composed (non-static) text child: "{entry.title}{' '}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/review/review.css` :: `.chq-review-results-table thead` -- app/src/pages/review/PlanEditor.tsx :: chq-review-results-table renders a composed (non-static) text child: "{pr.name}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/review/review.css` :: `.chq-review-criteria-eyebrow` -- app/src/pages/review/PlanEditor.tsx :: chq-review-criteria-eyebrow renders a composed (non-static) text child: "Locked — {countOf(activeRoundLockedCount, 'review')} scored against these criteria" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/review/scorecard.css` :: `.chq-review-answers` -- app/src/pages/review/Scorecard.tsx :: chq-review-answers renders a composed (non-static) text child: "{a.label}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-portal-welcome-summary` -- app/src/pages/settings/PortalSettingsPanel.tsx :: chq-settings-portal-welcome-summary renders a composed (non-static) text child: "{`Shown above the task list · ${countOf(paragraphs, 'paragraph')}`}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings-drill-rows.css` :: `.chq-settings-drillrow-pills-desktop` -- app/src/pages/settings/YourDataPanel.tsx :: chq-settings-drillrow-pills-desktop renders a composed (non-static) text child: "{renderExportPills()}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/settings/settings.css` :: `.chq-settings-content` -- app/src/pages/Settings.tsx :: chq-settings-content renders a composed (non-static) text child: "&lsaquo; {editingSection ? editingSection.label : viewingEmbeds ? 'Public pages' : 'Settings'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/speakers/speakers.css` :: `.chq-speakers-grid-wrap` -- app/src/pages/speakers/OnboardingGrid.tsx :: chq-speakers-grid-wrap renders a composed (non-static) text child: "{ const done = taskDoneLabel(task); return (" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/speakers/speakers.css` :: `.chq-speakers-toolbar` -- app/src/pages/speakers/OnboardingGrid.tsx :: chq-speakers-toolbar renders a composed (non-static) text child: "{REMIND_SKIP_RULE_SENTENCE}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/speakers/task-view.css` :: `.chq-taskview-answers .chq-taskview-head-row, .chq-taskview-waiting .chq-taskview-head-row` -- app/src/pages/speakers/TaskView.tsx :: chq-taskview-answers renders a composed (non-static) text child: "{tab === 'answered' ? 'Their answers' : 'Where it stands'}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/detail.css` :: `.chq-detail-back-full` -- app/src/pages/submissions/SubmissionDetailPage.tsx :: chq-detail-back-full renders a composed (non-static) text child: "{DECISION_ACTION_LABELS.waitlisted}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/detail.css` :: `.chq-detail-ref-position-full` -- app/src/pages/submissions/SubmissionDetailPage.tsx :: chq-detail-ref-position-full renders a composed (non-static) text child: "{detail.ref} &middot; {listPosition.position} of {listPosition.total}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-status-label, .chq-submissions-filterbar-divider, .chq-submissions-columnpicker` -- app/src/pages/submissions/ColumnPicker.tsx :: chq-submissions-columnpicker renders a composed (non-static) text child: "{columnsSummary(columns, visibleFieldIds)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-viewtabs` -- app/src/pages/submissions/ViewTabs.tsx :: chq-submissions-viewtabs renders a composed (non-static) text child: "{error &&" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-filterbar-sort-select` -- app/src/pages/submissions/FilterBar.tsx :: chq-submissions-filterbar-sort-select renders a composed (non-static) text child: "{sortLabel(sort)}" -- a static substring join can never verify a value assembled at render time
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-status-pending-desktop` -- app/src/pages/submissions/FilterBar.tsx :: chq-submissions-status-pending-desktop renders a composed (non-static) text child: "{STATUS_LABELS.pending}" -- a static substring join can never verify a value assembled at render time
- `app/src/styles.css` :: `.chq-nav` -- src/routes/public/shell.tsx :: chq-nav renders a composed (non-static) text child: "{SURFACE_LABELS[s]}" -- a static substring join can never verify a value assembled at render time
- `app/src/styles.css` :: `.chq-main:has([data-chq-phone-dock]) ~ .chq-tabbar` -- app/src/App.tsx :: chq-tabbar renders a composed (non-static) text child: "{ const to = section.path.replace(/\/\*$/, ''); return (" -- a static substring join can never verify a value assembled at render time
- `src/routes/docs-site.css.ts` :: `.chq-docs-nav` -- src/routes/docs-site.tsx :: chq-docs-nav renders a composed (non-static) text child: "{group.label}" -- a static substring join can never verify a value assembled at render time
- `src/routes/docs-site.css.ts` :: `.chq-docs-figure-placeholder` -- src/routes/docs-site.tsx :: chq-docs-figure-placeholder renders a composed (non-static) text child: "screenshot &middot; {block.shotId}" -- a static substring join can never verify a value assembled at render time
- `src/routes/portal/portal.css.ts` :: `.chq-portal-shell > .chq-portal-footer .chq-portal-signout` -- src/routes/portal/shared.tsx :: chq-portal-shell renders a composed (non-static) text child: "{props.branding.logoUrl ?" -- a static substring join can never verify a value assembled at render time
- `src/routes/portal/portal.css.ts` :: `.chq-portal-taskform-submit` -- src/routes/portal/tasks/views.tsx :: chq-portal-taskform-submit renders a composed (non-static) text child: "{TASK_FORM_SUBMIT_LABEL}" -- a static substring join can never verify a value assembled at render time
- `src/routes/public/cfp.css.ts` :: `[data-chq-cfp-step="2"] .chq-cfp-step-talk` -- src/routes/public/submit-views.tsx :: chq-cfp-step-talk renders a composed (non-static) text child: ": null} {formatField ? (" -- a static substring join can never verify a value assembled at render time
- `src/routes/public/cfp.css.ts` :: `.chq-cfp-actions-note` -- src/routes/public/submit-views.tsx :: chq-cfp-actions-note renders a composed (non-static) text child: "Resuming your saved draft from {formatEventDateTime(props.savedAt, props.timeZone)}." -- a static substring join can never verify a value assembled at render time

## TWIN-RESOLVED roster (19 rows, wave-39 -- graded and recorded, counted in neither ratchet)

- `app/src/pages/agenda/agenda.css` :: `.chq-agenda-head .chq-page-title` -- "Agenda" (app/src/pages/Agenda.tsx) is drawn verbatim at Chautauqua Agenda.dc.html:127 "Agenda", but an identical, still-visible text child exists on the same phone surface: "Agenda" (app/src/pages/agenda/PhoneAgenda.tsx :: chq-phone-agenda-h1) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/comms/comms.css` :: `.chq-comms-main-landing` -- "Comms" (app/src/pages/Comms.tsx) is drawn verbatim at Chautauqua Comms.dc.html:177 "Comms", but an identical, still-visible text child exists on the same phone surface: "Comms" (app/src/pages/Comms.tsx :: chq-measure-table) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/contacts/contacts-panels.css` :: `.chq-contacts-pipeline-head > .chq-btn` -- "Email" (app/src/pages/contacts/ContactDrawer.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:179 "Contacts", but an identical, still-visible text child exists on the same phone surface: "Email" (app/src/pages/contacts/ImportWizard.tsx :: chq-contacts-import-review-col-email) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/contacts/contacts.css` :: `.chq-contacts-table thead` -- "Labels" (app/src/pages/contacts/ContactsTable.tsx) is drawn verbatim at Chautauqua Contacts.dc.html:522 "Merge · 390", but an identical, still-visible text child exists on the same phone surface: "Labels" (app/src/pages/contacts/ContactsTable.tsx :: chq-contacts-col-labels) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/content/content.css` :: `.chq-content-table thead` -- "Download" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Content.dc.html:338 "Files · 390", but an identical, still-visible text child exists on the same phone surface: "Download" (app/src/pages/content/FilesLibrary.tsx :: chq-content-files-col-actions) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/content/content.css` :: `.chq-content-worklist .chq-content-table tr.chq-content-row > td:nth-child(1)` -- "Download" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Content.dc.html:338 "Files · 390", but an identical, still-visible text child exists on the same phone surface: "Download" (app/src/pages/content/FilesLibrary.tsx :: chq-content-files-col-actions) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/content/content.css` :: `.chq-content-worklist-selecting .chq-content-table tr.chq-content-row > td:nth-child(6)` -- "Download" (app/src/pages/content/FilesLibrary.tsx) is drawn verbatim at Chautauqua Content.dc.html:338 "Files · 390", but an identical, still-visible text child exists on the same phone surface: "Download" (app/src/pages/content/FilesLibrary.tsx :: chq-content-files-col-actions) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/forms/forms.css` :: `.chq-forms-add-question` -- "Add a question" (app/src/pages/forms/FormsPage.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:468 "CFP form · 390", but an identical, still-visible text child exists on the same phone surface: "Add a question" (app/src/pages/forms/FormsPage.tsx :: chq-forms-add-question-phone) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/overview/overview.css` :: `.chq-overview-clash-eyebrow-group > .chq-overview-row-title-sm, .chq-overview-clash-eyebrow-group > .chq-overview-row-meta` -- "share this slot" (app/src/pages/overview/AgendaWorkSection.tsx) is drawn verbatim at Chautauqua Overview.dc.html:190 "Overview", but an identical, still-visible text child exists on the same phone surface: "share this slot" (app/src/pages/overview/AgendaWorkSection.tsx :: chq-overview-clash-line-phone) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/review/review.css` :: `.chq-review-criteria-head-row` -- "Weight" (app/src/pages/review/PlanEditor.tsx) is drawn verbatim at Chautauqua Review.dc.html:594 "Plan editor · 390", but an identical, still-visible text child exists on the same phone surface: "Weight" (app/src/pages/review/PlanEditor.tsx :: chq-review-criterion-weight) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-layout[data-drilled='true'] .chq-settings-rail` -- "Open" (app/src/pages/Settings.tsx) is drawn verbatim at Chautauqua Settings.dc.html:275 "Settings", but an identical, still-visible text child exists on the same phone surface: "Open" (app/src/pages/Settings.tsx :: chq-rail-link) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel .chq-table thead` -- "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:393 "Settings · Your data", but an identical, still-visible text child exists on the same phone surface: "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx :: chq-settings-summary-row-action) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-page:has(.chq-settings-layout[data-drilled='true']) > .chq-page-title` -- "Open" (app/src/pages/Settings.tsx) is drawn verbatim at Chautauqua Settings.dc.html:275 "Settings", but an identical, still-visible text child exists on the same phone surface: "Open" (app/src/pages/Settings.tsx :: chq-rail-link) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-saved-embed-body` -- "Edit" (app/src/pages/settings/SavedEmbedsPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:347 "Settings · Tracks and rooms", but an identical, still-visible text child exists on the same phone surface: "Edit" (app/src/pages/settings/CallForPapersPanel.tsx :: chq-settings-questions-list) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel > .chq-settings-section-head > h2` -- "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:393 "Settings · Your data", but an identical, still-visible text child exists on the same phone surface: "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx :: chq-settings-summary-row-action) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/settings/settings.css` :: `.chq-settings-panel[data-chq-section='event'] > .chq-settings-section-head > .chq-settings-section-action` -- "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx) is drawn verbatim at Chautauqua Settings.dc.html:393 "Settings · Your data", but an identical, still-visible text child exists on the same phone surface: "Revoke" (app/src/pages/settings/ApiTokensPanel.tsx :: chq-settings-summary-row-action) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/submissions/submissions.css` :: `.chq-submissions-filterbar .chq-submissions-filterbar-select` -- "Needs triage" (app/src/pages/submissions/FilterBar.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:137 "Submissions", but an identical, still-visible text child exists on the same phone surface: "Needs triage" (app/src/pages/submissions/FilterBar.tsx :: chq-submissions-status-pending-phone) -- the frame's requirement is met by that twin, not by the hidden element
- `app/src/pages/submissions/submissions.css` :: `.chq-status-pills [data-status]:not([data-status='pending']):not([data-status='accepted'])` -- "Needs triage" (app/src/pages/submissions/FilterBar.tsx) is drawn verbatim at Chautauqua Submissions.dc.html:137 "Submissions", but an identical, still-visible text child exists on the same phone surface: "Needs triage" (app/src/pages/submissions/FilterBar.tsx :: chq-submissions-status-pending-phone) -- the frame's requirement is met by that twin, not by the hidden element
- `src/routes/portal/portal.css.ts` :: `.chq-portal-actions-footer` -- "Title and abstract show on the public pages · co-presenters do not" (src/routes/portal/edit.tsx) is drawn verbatim at Chautauqua Public and Portal.dc.html:600 "Portal · Edit your session", but an identical, still-visible text child exists on the same phone surface: "Title and abstract show on the public pages · co-presenters do not" (src/routes/portal/edit.tsx :: chq-portal-actions-note) -- the frame's requirement is met by that twin, not by the hidden element

## Shell-row adjudication (wave 50)

DEC-725 wave-50, shell lane: the four `app/src/styles.css` rows named in
this ledger's own roster, adjudicated against their cited frame extents.
This section moves no product byte -- all four verdicts below are (b) or
(c), and none removes a row from the live population, so
`PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` (`app/src/phone-hidden-drawn-text.scan.test.ts`)
stays at 20 (re-measured, unchanged; see "Ratchet re-measurement" below).

1. `.chq-shell:has([data-chq-phone-head]) .chq-header` -- "chautauqua" --
   **(b) INSTRUMENT ARTEFACT.** The cited extent, `Sign in · 390`, draws
   `chautauqua` inside `docs/design/Chautauqua Account.dc.html`, which reads
   `<span style="font-family:'Familjen Grotesk', sans-serif; font-size:26px; font-weight:700; letter-spacing:-0.04em; line-height:1">chautauqua</span>`
   directly under the frame's unauthenticated sign-in stack. `app/src/App.tsx`'s
   `.chq-wordmark` -- the only element the hidden CSS selector's `.chq-header`
   reaches -- lives inside the AUTHENTICATED SPA shell (`app/src/App.tsx`'s
   `Header()`), which never mounts on the sign-in screen at all: the sign-in
   surface is server-rendered by `src/routes/auth-views.tsx`, whose own
   `<h1 className="chq-auth-wordmark">chautauqua</h1>` (styled by
   `src/routes/auth.css.ts`, not `app/src/styles.css`) is what actually
   satisfies this literal. The join between the shell's hidden selector and
   the sign-in frame's wordmark is a coincidental cross-surface verbatim
   match on the word "chautauqua" -- two unrelated components on two
   unrelated CSS files that happen to render the same product name.

2. `.chq-header-identity .chq-user-identity` -- "Sign out" --
   **(b) INSTRUMENT ARTEFACT.** The cited extent, `Reviewer queue · /review/plans/:id`,
   draws `docs/design/Chautauqua Review.dc.html`'s phone subscreen, whose
   only "Sign out" affordance is
   `<a href="#" style="margin-left:auto; font-size:13px; font-weight:700; display:inline-flex; align-items:center; min-height:44px">Sign out</a>`
   inside the frame's OWN bottom band
   (`flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; align-items:center; gap:12px`) --
   not inside the header identity block, which this same frame instead
   draws as the reviewer's name (`Sam Whitfield`), no Sign out. On the live
   tree that bottom-band "Sign out" is `app/src/pages/review/ReviewerQueue.tsx`'s
   own drill-in footer (`<div className="chq-phone-dock chq-review-phone-dock">`
   ... `Sign out`), gated by `data-chq-phone-signout="true"` on the page
   root -- the exact attribute `app/src/styles.css`'s
   `.chq-shell:not(:has(.chq-tabbar)):not(:has([data-chq-phone-signout])) .chq-header-identity .chq-user-identity`
   carve-out excludes for precisely this reason (comment at that rule:
   "this drill-in mints its OWN Sign out inside its .chq-phone-dock band").
   The frame's "Sign out" is drawn by that different affordance, not by
   `.chq-header-identity .chq-user-identity`.

3. `.chq-shell:has(.chq-phone-dock) .chq-tabbar` -- "Save" --
   **(c) CORRECTLY DRAWN OPT-OUT.** The cited extent, `Templates · 390`, draws
   `docs/design/Chautauqua Comms.dc.html`'s phone template editor with a
   docked footer -- `flex-shrink:0; border-top:1px solid #1B1D17; background:#EFEBDF; padding:12px 16px 16px; display:flex; gap:8px`
   containing `Save`/`Cancel` -- and no five-tab band anywhere in the same
   390x844 shell. `app/src/pages/comms/TemplatesTab.tsx` sets
   `data-chq-phone-dock={true}` on its page root exactly while editing and
   renders `<div className="chq-comms-editor-actions chq-phone-dock">Save…</div>`,
   which is what `.chq-shell:has(.chq-phone-dock) .chq-tabbar { display: none }`
   is answering. This is the DEC-576/DEC-381 dock-vs-tabbar opt-out pairing
   docs/mobile-campaign.md's Wave-1 handoff already records as CLOSED,
   confirmed here against the Comms frame rather than assumed.

4. `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` -- "Sign out" --
   **(b) INSTRUMENT ARTEFACT**, doubly coincidental. First, the cited extent
   is the same Reviewer-queue subscreen as row 2 above, which mounts no
   `.chq-scrim` modal at all -- this selector only fires for a PORTALED
   modal dock (`app/src/pages/contacts/ImportWizard.tsx`, via
   `ModalFrame.tsx`'s `createPortal` to `document.body`), a different
   surface than the reviewer drill-in. Second, `app/src/App.tsx`'s
   `.chq-tabbar` element (`<nav className="chq-tabbar" aria-label="Primary, phone">`)
   closes at its own `</nav>` and its balanced markup is dots + section
   labels + "More", never "Sign out" -- "Sign out" belongs to the sibling
   `{moreOpen && (<div className="chq-scrim">…<button>Sign out</button></div>)}`
   block that follows `</nav>` in the same fragment. The literal is drawn
   by that sibling More-sheet button, not by `.chq-tabbar`.

### Ratchet re-measurement

`npx vitest run app/src/phone-hidden-drawn-text.scan.test.ts` still reports
`PREMISE_FALSE_ROWS.length === 20` after this adjudication -- none of the
four verdicts above is (a), so no CSS byte moved and no row left the
population. `PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` stays `20`
(both directions of the two-sided ratchet still hold exactly).

## Wave-51 amendment (DEC-725, task w51-e): the four `app/src/styles.css` rows individually opened

This ledger's own closing sentence under the PREMISE-FALSE roster called each
of its 20 rows "a candidate for a future repair lane naming its own
sheet/selector/frame line above" -- none had been individually opened since
wave-39. This amendment is the SHELL LANE's own four rows (the other 16
belong to page sheets a page lane, not the shell lane, may touch). Each
verdict below was reached by opening the cited `.dc.html` file from its
`font-size:19px` label line through to the next label (never stopping at the
roster's cited line alone), reading the live component tree that mounts the
selector's opposite side, and reading the standing comment already sitting
above each rule in `app/src/styles.css` (all four already carry a
`v12m-w14-c`/`DEC-576`/`DEC-989` provenance comment naming the mechanism this
amendment confirms).

### Row 1 -- `.chq-shell:has([data-chq-phone-head]) .chq-header` ("chautauqua")

Verdict: **INSTRUMENT ARTEFACT**. Chautauqua Account.dc.html's "Sign in ·
390" frame extent (label line 118, extent 118-144) draws "chautauqua" once,
inside the sign-in card body itself (line 124, a 26px page heading), not
inside any app-shell header band -- the frame draws no wordmark/identity
chrome above the card at all. The unauthenticated sign-in screen never
mounts app/src/App.tsx's `.chq-shell` (that component tree renders only
under the authenticated `/admin` `BrowserRouter`), so the rule under review
cannot even reach the screen this frame draws. The literal's real, always-
visible owner is the server-rendered sign-in page's own heading: search
src/routes/auth-views.tsx for its `chq-auth-wordmark` h1 (two occurrences,
sign-in and its sibling reset view). `app/src/styles.css` is one of the two
sheets this ledger's own wave-35 amendment explicitly keeps on the FULL-PACK
join (a shared root with no single owning cluster) rather than narrowing to
one frame file, so a coincidental cross-surface word match like this one is
exactly the shape that join was already documented to admit.

### Row 2 -- `.chq-header-identity .chq-user-identity` ("Sign out")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Review.dc.html's "Reviewer
queue · /review/plans/:id" frame extent (label line 410, extent 410-445)
draws its own docked footer band at lines 441-444 ("Scores stay hidden from
other reviewers" plus a "Sign out" affordance, `border-top:1px solid
#1B1D17; background:#EFEBDF; padding:12px 16px 16px`) as the LAST child
inside the 390 frame -- there is no separate header-identity Sign out drawn
anywhere else in this extent (the header band at lines 414-425 carries only
the wordmark and the reviewer's name). This is precisely the drill-in's own
`.chq-phone-dock` band the standing comment above the rule (the DEC-576/
DEC-874 wave-86 amendment note, and the v12m-w14-c note just above it)
already documents: a reviewer drill-in mints its own Sign out inside its
dock and sets a `data-chq-phone-signout` marker on its page root for exactly
this purpose, so the header-identity's own Sign out correctly stands down
here rather than drawing a second one -- the un-hide rule directly below in
the same file already excludes any shell carrying that marker.

### Row 3 -- `.chq-shell:has(.chq-phone-dock) .chq-tabbar` ("Save")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Comms.dc.html's "Templates
· 390" frame extent (label line 282, extent 282-326) draws a docked footer
band at lines 322-325 (`border-top:1px solid #1B1D17; background:#EFEBDF;
padding:12px 16px 16px; display:flex; gap:8px`) holding exactly "Save" and
"Cancel" in place of a tab bar -- the frame draws no five-tab band anywhere
in this extent. This is the DEC-989 (wave-85 amendment) shape the standing
comment above the rule already names. The live component confirms the same
opt-in mechanism the comment describes: search app/src/pages/comms/
TemplatesTab.tsx for its `data-chq-phone-dock` page-root attribute (set only
while editing) and its `chq-comms-editor-actions chq-phone-dock` footer,
whose own "Save" action is the literal this roster row named.

### Row 4 -- `body:has(.chq-scrim [data-chq-phone-dock]) .chq-tabbar` ("Sign out")

Verdict: **INSTRUMENT ARTEFACT**. This roster row cites the same Chautauqua
Review.dc.html "Reviewer queue · /review/plans/:id" extent as Row 2 above,
and its "Sign out" literal is the SAME docked-footer text Row 2 already
attributes to the reviewer drill-in's in-shell `.chq-phone-dock` band --
reached and re-lined by the DIFFERENT, narrower `.chq-shell:has(.chq-phone-
dock) .chq-tabbar` rule (this ledger's Row 3 selector shape, standing a few
lines above this one in app/src/styles.css) rather than by the rule this row
actually names. The rule this row names is scoped, by design, to a dock
portalled ACROSS the `.chq-scrim` modal boundary -- the standing DEC-576
wave-106 comment directly above it names the one live mechanism that
reaches it: search app/src/pages/contacts/ImportWizard.tsx for its own
`data-chq-phone-dock` marker, mounted inside a ModalFrame `.chq-scrim`
portal. That dock's own primary actions are the import wizard's own, never
"Sign out" -- the roster's join matched this row's selector to an unrelated
occurrence of the same short phrase on `app/src/styles.css`'s full-pack join
(the same shared-root shape Row 1 above resolves the same way), not to any
text the modal-portal mechanism this rule implements ever draws.

### Outcome for `PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING`

All four rows resolve without a CSS change: two INSTRUMENT ARTEFACTs (the
join credited an unrelated surface's coincidental text) and two CORRECTLY
DRAWN OPT-OUTs (the frame draws the replacement band this ledger already
predicted). Re-measured with `app/src/phone-hidden-drawn-text.scan.test.ts`'s
own roster forced to `-1` (read back, never trusted from a prior wave): the
PREMISE-FALSE population is still 20 rows, byte-identical to the roster
below -- none of these four verdicts removes a row, so the ceiling is left
at `20`, unmoved, correctly.

## Wave-55 amendment (DEC-725, task w55-e): Slice B -- the eight Settings +
public-CFP `PREMISE-FALSE` rows individually opened

This ledger's own closing sentence under the PREMISE-FALSE roster called each
of its 20 rows "a candidate for a future repair lane naming its own
sheet/selector/frame line above" -- the four `app/src/styles.css` shell rows
were opened wave-51; these eight (the Settings cluster's four rows plus the
SSR public CFP sheet's four rows) are Slice B (Slice A, opened the same wave,
owns the remaining eight page-sheet rows). Each verdict below was reached by
opening the cited `.dc.html` file from its `font-size:19px` label line
through to the NEXT label (never stopping at the roster's cited line alone),
reading the live component tree that mounts the selector's opposite side, and
reading the standing provenance comment already sitting above each rule.
This section moves no CSS byte and touches no ceiling.

### Row 1 -- `app/src/pages/settings/settings-drill-rows.css` ::
`.chq-settings-drillrow-head-hide` ("Add a track")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Settings.dc.html's
"Settings · Tracks and rooms" extent (label line 344, extent 344-390) draws
no head-level "Add a track" link at all -- the desktop head action this rule
hides has no counterpart in the 390 body band. Instead, the frame draws a
dashed, centred, `min-height:44px` pill reading "Add a track" (line 365)
directly below the Tracks list, and a second one reading "Add a room" (line
389) below the Rooms list. The rule's own standing comment (settings-drill-
rows.css:225-245, DEC-919 wave-99) already names this: `TracksRoomsPanel.tsx`
renders BOTH the head link (hidden here) and the dashed sibling
(`.chq-settings-drillrow-add`, turned on by the adjacent `display:flex`
rule two rules above) wired to the identical `setShowAddTrack`/
`setShowAddRoom` handler -- so the capability moves position, not away. The
frame's "Add a track" requirement is met by that always-present dashed pill,
not by the hidden head link.

### Row 2 -- `app/src/pages/settings/settings-lists.css` ::
`.chq-settings-token-create .chq-btn-primary, .chq-settings-people-invite-action`
("Invite someone")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Settings.dc.html's
"Settings · People and roles" extent (label line 549, extent 549-575) draws
"Invite someone" once, as a filled, edge-to-edge 46px primary (line 568,
`background:#4E5C31; ... min-height:46px`) sitting BELOW the people list --
not as a small head-band link. The rule under review hides the desktop head
link (`.chq-settings-people-invite-action`); the frame's own 46px primary is
rendered by the sibling `.chq-settings-phone-action` element, which this
same file's terminal `@media (max-width:700px)` block turns on with the
exact quoted receipt for both this frame line and the sibling "New token"
frame line (settings-lists.css:147-166) and whose un-hide rule's own
standing comment (settings-lists.css:125-135, DEC-919 wave-99) states the
invariant directly: "the capability renders TWICE in the DOM, exactly ONCE
on screen." The frame's requirement is met by that phone-only primary, not
by the hidden desktop head link.

### Row 3 -- `app/src/pages/settings/settings.css` ::
`[data-screen='true'] .chq-settings-saved-embed-heading` ("Saved embeds")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Settings.dc.html's
"Settings · Saved embeds" extent (label line 575, extent 575-607) draws
"Saved embeds" once, as the drilled screen's own `<h1>` (line 581) in the
head band above the embed list -- there is no second "Saved embeds" text
anywhere else in this extent. The rule under review hides the in-panel
`<h2>Saved embeds</h2>` only while `data-screen='true'` (`SavedEmbedsPanel`'s
own nested-screen state, `?section=public-pages&view=embeds`); the standing
comment immediately above it (settings.css:2262-2277, DEC-728 wave-156)
names the replacement directly: "the redundant in-panel `<h2>` steps aside
for the page-level H1 the screen already carries (Settings.tsx's
`phoneDrillTitle`)." `Settings.tsx`'s `pageTitle` computation (:198-205) sets
that H1 to the literal string `'Saved embeds'` exactly while `viewingEmbeds`
is true -- the same state that fires this hide rule. The frame's H1
requirement is met by that page-level twin, not by the hidden in-panel
heading.

### Row 4 -- `app/src/pages/settings/settings.css` ::
`.chq-settings-public-pages-own-hidden` ("Public pages")

Verdict: **INSTRUMENT ARTEFACT**. Chautauqua Settings.dc.html's "Settings ·
Public pages" extent (label line 478, extent 478-505) draws "Public pages"
once, as the drilled screen's own `<h1>` (line 484) -- a *different* app
state (`active === 'public-pages'`, `viewingEmbeds === false`,
`PublicPagesPanel.tsx`:174-176's className branch takes the PLAIN
`chq-settings-panel chq-settings-numbered` class, never
`-own-hidden`) than the one the rule under review fires in. The rule under
review (`PublicPagesPanel.tsx`:175, gated on `viewingEmbeds === true`) only
applies while the reader has drilled one level further, into the nested
Saved-embeds screen this ledger's Row 3 above already covers (cited
separately at Settings.dc.html:578) -- a state the frame :478 extent does
not describe at all. In the state the frame :478 extent DOES describe, the
section's own `<h2>Public pages</h2>` is already unconditionally hidden by a
*different*, generic rule (`.chq-settings-panel > .chq-settings-section-head
> h2`, settings.css:2880, the same w17-d/DEC-919 de-duplication rule this
ledger's own TWIN-RESOLVED roster already credits for the sibling
"Open"/"Revoke" rows in this file), and the frame's H1 requirement is met by
`Settings.tsx`'s page-level `.chq-settings-drill-title` twin instead. The
join credited a coincidental cross-state text match -- the "Public pages"
literal this rule's own screen (the embeds-nested state) would need is
"Saved embeds," never "Public pages" -- not a defect on the screen the frame
actually names.

### Row 5 -- `src/routes/public/cfp.css.ts` ::
`[data-chq-cfp-step="1"] .chq-cfp-step-you` ("You")

Verdict: **INSTRUMENT ARTEFACT**. Chautauqua Public and Portal.dc.html's
"Portal · Edit your session" extent (label line 597, extent 597-680) is the
authenticated speaker PORTAL's edit-session screen (`src/routes/portal`), an
unrelated surface from the public CFP submission wizard
(`src/routes/public/submit-views.tsx`) the rule under review actually
belongs to; it draws no standalone "You" label at all -- the only
occurrences of the substring in this extent are "‹ Your session" and "You
can change this until the form closes on 16 Aug" (line 604), neither a drawn
label. The rule's own literal ("You", `submit-views.tsx`:730's
`.chq-cfp-section-label`) belongs to the public CFP wizard's step-2 "about
you" field group, which this pack never draws a dedicated 390 frame for (the
pack's only phone CFP frame, Public and Portal.dc.html:1014-1071, is
labelled "Step 1 of 2 · your talk" and shows only talk fields, consistent
with hiding the You section on step 1). The join matched an unrelated
surface's coincidental substring, not any label the rule's own screen draws.

### Row 6 -- `src/routes/public/cfp.css.ts` ::
`[data-chq-cfp-step="1"] .chq-cfp-actions button[type="submit"]:not(.chq-cfp-save-draft)`
("Save draft")

Verdict: **INSTRUMENT ARTEFACT**, doubly coincidental. First, the rule's own
target element is `submit-views.tsx`:748-750's primary submit button, whose
text is "Submit this talk" -- never "Save draft" -- so the roster's cited
literal was never inside the element this rule hides; "Save draft" is drawn
by the immediately adjacent, always-visible SIBLING button
(`.chq-cfp-save-draft`, :752-759), which this rule's own `:not(...)` clause
explicitly excludes from ever being hidden. Second, the cited frame extent,
"Portal · Hotel stay form" (label line 502, extent 502-528), is an unrelated
form (Chautauqua Public and Portal.dc.html:520, a hotel-stay dock action) --
its own "Save draft" pill has no relationship to the CFP wizard at all. The
standing comment already above this rule (cfp.css.ts:365-372) confirms the
element it actually hides is reachable one tap away via `.chq-cfp-step-next`
and never hidden without a same-surface path (DEC-919) -- the correct
verdict for the SUBMIT control this rule targets, just misattributed to a
"Save draft" literal it never carries.

### Row 7 -- `src/routes/public/cfp.css.ts` ::
`[data-chq-cfp-step="2"] .chq-cfp-step-next` ("Next: about you")

Verdict: **CORRECTLY DRAWN OPT-OUT**. Chautauqua Public and Portal.dc.html's
phone "Submit a talk" step-1 extent (label line 1014, extent 1014-1071)
draws "Next: about you" (line 1062) only inside the step-1 dock, alongside a
"Draft" secondary -- the pack draws no dedicated step-2 phone frame to
compare against directly, but the file's own sibling rules supply the
replacement band the frame's step-driven design implies: on step 2 the
primary submit control (`button[type="submit"]:not(.chq-cfp-save-draft)`,
Row 6 above) is no longer excluded and the back control un-hides
(`[data-chq-cfp-step="1"] .chq-cfp-step-back` is the ONLY hide for
`.chq-cfp-step-back`, so it renders at step 2), so the step-2 dock reads
Back + Submit this talk in place of Next. The standing comment directly
above this rule (cfp.css.ts:395-397, DEC-919) already names it: "navigation
control with nothing to reach -- step 2 is the last step of the wizard,
there is no next step." No CSS byte changes.

### Row 8 -- `src/routes/public/cfp.css.ts` ::
`[data-chq-cfp-step="all"] .chq-cfp-steps, [data-chq-cfp-step="all"] .chq-cfp-step-next, [data-chq-cfp-step="all"] .chq-cfp-step-back`
("Next: about you")

Verdict: **CORRECTLY DRAWN OPT-OUT**. This rule fires only when
`data-chq-cfp-step` sits at its markup default `"all"` -- the standing
comment directly above it (cfp.css.ts:399-407, DEC-986 wave-117) names the
one live mechanism that produces that state: `CfpStepsScript` returns before
wiring a step at all when the server re-renders the form carrying a
validation error, so every field (both "Your talk" and "You" groups) renders
at once with no wizard chrome to navigate between -- the same
all-fields-at-once shape Chautauqua Public and Portal.dc.html's 1600 "Submit
a talk · /submit/:slug" extent (label line 894, extent 894-1014) draws for
its single desktop layout, which never carries step chrome either. The
wizard's step label/progress bar and Next/Back controls correctly stand
down in this state because there is no step boundary left for them to
describe; the always-visible `.chq-cfp-actions` submit/save-draft pair
(unaffected by this rule) remains the way forward. No CSS byte changes.

### Outcome for `PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING`

All eight Slice B rows resolve without a CSS change: four INSTRUMENT
ARTEFACTs (the join credited an unrelated surface's, or an unrelated
sibling element's, coincidental text) and four CORRECTLY DRAWN OPT-OUTs (the
frame's requirement is met by a page-level twin, a relocated dashed pill, a
phone-only primary, or a step-driven replacement band already documented in
each rule's own standing comment). None of these eight verdicts is a REAL
DEFECT, so no CSS byte moved and no row left the population.
`PHONE_HIDDEN_DRAWN_TEXT_PREMISE_FALSE_CEILING` (`app/src/phone-hidden-
drawn-text.scan.test.ts`) stays at `20`, re-measured, unchanged.
