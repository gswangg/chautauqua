# Pack prose-measure (`max-width:<N>ch`) register (DEC-896 wave-49, task w49-e; repaired wave-52, task w52-c; UNRESOLVED rows adjudicated wave-54, task w54-h)

Instrument: `test/pack-prose-measure.scan.test.ts`. Ratchet:
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING`, measured 0 (DEC-896 wave-52
amendment, task w52-c; unchanged by wave-54 -- see "Wave-54 adjudication"
below, this is a DOCS-ONLY lane, no CSS byte moved). Wave-49's MEASURE-ONLY
lane moved no CSS byte; wave-52 repaired the 6 real DIVERGES/UNCLAMPED rows
it left, and reclassified the 2 Home rows as an instrument artefact (see
"Wave-52 repair" below). Wave-54 hand-adjudicates the remaining 15
UNRESOLVED rows against their own render sites (DEC-896 wave-54, per
`PARKED_FIDELITY_PROMISES.PACK_PROSE_MEASURE_DIVERGENCE_CEILING`'s prose
condition) -- see "Wave-54 adjudication" below.

## Why this axis

DEC-896's wave-48 amendment probed every inline property `docs/design/*.dc.html`
draws against the served CSS and settled `grid-template-columns` as the pack's
last divergent VALUE-vocabulary axis (`gap`/`align-items`/`justify-content`/
`flex-direction`/`white-space`/`overflow` all measured zero unmatched values).
That histogram grades a value vocabulary, so a property the product barely
declares at all reads as nearly clean. `max-width:<N>ch` is exactly that
property: the pack draws it in 26 places across 10 distinct values; the
served corpus (`app/src/**/*.css` + every SSR `*_CSS` module
`test/helpers/ssr-css-sources.ts` derives, which includes `src/views/theme.ts`
and every `src/**/*.css.ts` module) declares it in 10 places across 7
distinct values -- two of which (34ch, 32ch) the pack never draws at all, and
52ch (the pack's single most-drawn measure, 10 of 26 rows) is served exactly
once.

## Drawn vs served (measured live on this branch)

Drawn (docs/design/*.dc.html, 26 rows, 10 values):

| value | drawn count |
| --- | --- |
| 52ch | 10 |
| 64ch | 6 |
| 70ch | 2 |
| 60ch | 2 |
| 78ch | 1 |
| 76ch | 1 |
| 62ch | 1 |
| 56ch | 1 |
| 54ch | 1 |
| 46ch | 1 |

Served (`app/src/**/*.css` + SSR `*_CSS` modules, 10 rows, 7 values):

| value | served count | site(s) |
| --- | --- | --- |
| 64ch | 3 | `app/src/pages/comms/comms.css` `max-width: 64ch;`, `app/src/pages/content/upload-rejected.css` `max-width: 64ch;`, `app/src/pages/settings/settings.css` `max-width: 64ch;` |
| 34ch | 2 | `app/src/pages/content/content.css` (two `max-width: 34ch;` rules) -- never drawn by the pack |
| 60ch | 1 | `app/src/pages/review/review.css` `max-width: 60ch;` |
| 52ch | 1 | `app/src/pages/review/review.css` `max-width: 52ch;` |
| 32ch | 1 | `app/src/pages/review/review.css` `max-width: 32ch;` -- never drawn by the pack |
| 62ch | 1 | `src/routes/public/cfp.css.ts` `.chq-cfp-intro { ...; max-width: 62ch; }` |
| 54ch | 1 | `src/routes/public/home.css.ts` `.chq-home-hero p { ...; max-width: 54ch; }` |

Drawn-only measures with no served value at all, anywhere in the tree: 70ch,
78ch, 76ch, 56ch, 46ch.

## Join methodology (and its own honest limits)

For each drawn clamp, this scan extracts every text run >= 20 chars inside
the clamped element (a wrapping `<div style="...max-width:Nch">` commonly
wraps an `<h1>` heading and a `<p>` sentence as two separate child blocks --
each run is searched separately, never the concatenated blob as one needle).
Each run is matched, verbatim and boundary-anchored, against the normalized
non-test `app/src/**`+`src/**` corpus (`test/frame-source-corpus.ts`'s own
`enumerateSourceFiles`/`normalizeSource`/`labelIsMatched`, the same corpus
and matcher every sibling ledger in this campaign uses) to resolve a RENDER
FILE. Inside that render file, the scan looks for an inline
`max-width:<N>ch` declaration, and for every `chq-*` class token the file
mentions, cross-referenced against a map of every `.chq-*` CSS selector
(built from the same served corpus above) that declares `max-width:<N>ch`.
The union is the render file's DECLARED set.

This is a FILE-grained join, not a true DOM-block join -- a render file that
declares more than one `max-width:<N>ch` across unrelated elements can, in
principle, misclassify a specific clamp in either direction. No sampled row
below hit that failure mode, but it is the instrument's known limitation,
stated here rather than overclaimed.

## Per-row classification (all 26 drawn rows)

| frame | value | verdict | render file(s) | declared | note |
| --- | --- | --- | --- | --- | --- |
| `Chautauqua Home.dc.html` `max-width:54ch` "One call for papers is open. Two programmes are published." | 54ch | MATCHED (hand, DEC-896 wave-54) | `src/routes/root.tsx` | 54 | same shared `.chq-home-hero p` rule (`src/routes/public/home.css.ts`, `max-width: 54ch`) the two narrower Home rows above already resolve to -- this row IS the widest drawn sample and its own value is served exactly. The automated matcher still reads UNRESOLVED (`heroSummary()` composes the sentence, no literal string to match) so the automated ratchet total is unaffected; this is a doc-only hand adjudication, not an instrument change. |
| `Chautauqua Home.dc.html` `max-width:52ch` "Nothing is taking submissions. Past programmes are still up." | 52ch | INSTRUMENT ARTEFACT (DEC-896 wave-52) | `src/routes/root.tsx` | 54 | all three Home clamps resolve to ONE element, `.chq-home-hero p` (`src/routes/public/home.css.ts`), whose sentence is composed per hub state by `heroSummary()` -- one element cannot carry three measures, so the widest drawn value (54ch, already served) is the v12 measure and this narrower sample is the same rule against shorter copy. Reclassified, not repaired: `grade()` now treats a composed-sentence render file's declared value >= the drawn value as MATCHED |
| `Chautauqua Home.dc.html` `max-width:46ch` "No call for papers is open and no programme has been published." | 46ch | INSTRUMENT ARTEFACT (DEC-896 wave-52) | `src/routes/root.tsx` | 54 | same shared `.chq-home-hero p` rule; same reclassification as the 52ch row above |
| `Chautauqua Overview.dc.html` `max-width:52ch` "This event has no submissions, no speakers and no schedule..." | 52ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/Overview.tsx` | 52 | `EmptyState`'s new `reasonClassName` prop carries `.chq-overview-brand-new-reason` (`app/src/pages/overview/overview.css`), max-width:52ch, own class -- the shared `.chq-empty-reason` every other `EmptyState` caller renders through is untouched |
| `Chautauqua Overview.dc.html` `max-width:70ch` "Every state in the B8 standard, drawn..." | 70ch | INSTRUMENT ARTEFACT (DEC-896 wave-54) | -- | -- | `Chautauqua Overview.dc.html:485`, inside the "1600 · States · hover, pending, drag" panel (H1 "Interaction states", :483) -- pack meta-documentation ABOUT the B8 control-state standard, drawn as a design-reference block beside the real Overview screen mockups in the same frame file. No render site exists because this sentence is not product screen copy; there is nothing for the product to clamp. |
| `Chautauqua Overview.dc.html` `max-width:70ch` "The chrome a page can draw without data..." | 70ch | INSTRUMENT ARTEFACT (DEC-896 wave-54) | -- | -- | `Chautauqua Overview.dc.html:703`, inside a loading-skeleton explainer panel (H1 "Interaction states" family, same meta-documentation block as the row above) describing the skeleton-loading RULE itself, not a screen. Same disposition and reasoning. |
| `Chautauqua Overview.dc.html` `max-width:78ch` "...show nothing — a skeleton that flashes is worse than a beat of stillness..." | 78ch | INSTRUMENT ARTEFACT (DEC-896 wave-54) | -- | -- | `Chautauqua Overview.dc.html:731`, the same skeleton-loading explainer panel's second paragraph (the "under 250ms" / "#EFEBDF" rule prose). Same disposition and reasoning as the two rows above -- all three are the pack's own design-documentation prose, never drawn as a real page. |
| `Chautauqua Public and Portal.dc.html` `max-width:62ch` "Three tracks, five formats, no account needed..." | 62ch | NOT RENDERED, ruled (DEC-896 wave-54, DEC-986) | -- | -- | `src/decisions-data/DEC-986.md`'s own wave-adjudication of this exact frame window (`Chautauqua Public and Portal.dc.html:1536-1547`, "CFP not open yet") already rules the tracks/formats clause NOT adopted: `src/routes/public/submit-views.tsx` renders only the account-free clause for this window ("Nothing to do until then...") because the tracks/formats fact is not free (`submit-get.tsx` returns before fetching tracks for this state) and DEC-986 forbids fabricating a figure the page cannot verify. This sentence is never rendered anywhere in the product by design, so there is no render site to clamp -- not a gap, a ruled omission. |
| `Chautauqua Public and Portal.dc.html` `max-width:52ch` "Sessions appear here once the committee has finished reviewing..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `src/routes/public/sessions.tsx`, `src/routes/public/empty-state.tsx` | none | `docs/design/audit/portal-desktop-v12.md` already adjudicates this row's COPY difference (the shipped reason reads "Sessions appear here once the schedule is published.", a deliberate DEC-522 timezone-safety substitution for the frame's close-date sentence) -- new to this lane is the WIDTH fact: `PublicEmptyState`'s `reason` renders through `.chq-pub-empty-reason` (`src/routes/public/css/empty.css.ts`), which declares `font-size`/`color`/`margin` and NO `max-width` at any breakpoint. The automated matcher still reads UNRESOLVED (the shipped sentence differs verbatim from the frame's) so the automated ratchet total is unaffected; desktop is frozen so no CSS moves in this lane. |
| `Chautauqua Public and Portal.dc.html` `max-width:52ch` "This is the portal your speakers see. It has no speaker attached..." | 52ch | REPAIRED (DEC-896 wave-52) | `src/routes/portal/preview.tsx` (since deleted by multi-portal decision 74) | 52 | `.chq-portal-preview-banner-text` (`src/routes/portal/portal.css.ts`) gained `max-width: 52ch` directly -- it is already this sentence's own class, no other element shares it |
| `Chautauqua Review.dc.html` `max-width:52ch` "Changing these would rescore work already done" | 52ch | MATCHED | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `review.css` declares 52ch among the file's shared clamps |
| `Chautauqua Review.dc.html` `max-width:60ch` "Three to start with — two scored 1–5 and one recorded as a spread..." | 60ch | MATCHED | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | -- |
| `Chautauqua Review.dc.html` `max-width:64ch` "Two things need fixing before this plan can open" | 64ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `ErrorSummary`'s new `className` prop carries `.chq-review-plan-open-errors` (`app/src/pages/review/review.css`), max-width:64ch, own class appended beside the shared `.chq-error-summary` block this page's OTHER `ErrorSummary` callers also render through |
| `Chautauqua Review.dc.html` `max-width:56ch` "Reviewers need at least one thing to score..." | 56ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `.chq-review-criteria-locked-reason` (`review.css`) gained `max-width: 56ch` -- already this sentence's own class |
| `Chautauqua Settings.dc.html` `max-width:60ch` "Adding, reordering and removing questions happens in the builder..." | 60ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/settings/CallForPapersPanel.tsx` | 60 | new `.chq-settings-questions-note` (`app/src/pages/settings/settings.css`), max-width:60ch, appended beside the shared `.chq-settings-note` Saved embeds' own note also renders through at a different measure |
| `Chautauqua Settings.dc.html` `max-width:64ch` "The public URL you chose is already taken by another event..." | 64ch | MATCHED | `app/src/pages/settings/EventSettingsPanel.tsx` | 64 | `settings.css` |
| `Chautauqua Speakers.dc.html` `max-width:76ch` "Priya Raman leads the build-tooling platform team..." | 76ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/speakers/SpeakerDetailPage.tsx` | none | Real render site: `detail.contact.bio && <p className="chq-speaker-detail-portal-bio-text">{detail.contact.bio}</p>`. This is a genuinely DATA-DRIVEN field (a speaker's own bio text, arbitrary length) -- the frame's "Priya Raman..." sentence is invented sample data, exactly why no verbatim matcher can ever join it, not a defect in the matcher. `.chq-speaker-detail-portal-bio-text` (`app/src/pages/speakers/speakers.css`) declares `font-size`/`line-height`/`color` and no `max-width`. Automated verdict stays UNRESOLVED; the automated ratchet total is unaffected. |
| `Chautauqua Speakers.dc.html` `max-width:52ch` "Marcus Okafor is on the roster, but nothing of his is overdue..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/speakers/OnboardingGrid.tsx` | none | Real render site: the filtered-empty `EmptyState`'s `reason={facet.reason(...)}` call (no `reasonClassName` supplied), so it renders through the SHARED base `.chq-empty-reason` (`app/src/styles.css`), which declares `margin`/`font-size`/`line-height`/`color` and no `max-width`. Automated verdict stays UNRESOLVED (the reason string is composed per active facet, never a fixed literal); the automated ratchet total is unaffected. |
| `Chautauqua Speakers.dc.html` `max-width:64ch` "Marcus Okafor's headshot task did not change" | 64ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/speakers/OnboardingGrid.tsx` | none | Real render site: `cellFailureTitle()`'s composed title, rendered as `<p className="chq-speakers-write-failure-title">{pendingFailure.message}</p>` (the rolled-back-write banner, DEC-265 wave-134). `.chq-speakers-write-failure-title` (`app/src/pages/speakers/speakers.css`) declares only `margin`/`font-weight`, no `max-width`. Automated verdict stays UNRESOLVED (composed per speaker/task); the automated ratchet total is unaffected. |
| `Chautauqua Submissions.dc.html` `max-width:52ch` "The call for papers opens on 1 February..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/submissions/SubmissionsTable.tsx` | none | Real render site: the fresh-empty `EmptyState`'s `` reason={formOpenDate !== null && formOpenDate > Date.now() ? `The call for papers opens on ${formatDateOnly(formOpenDate)}...` : undefined} `` (no `reasonClassName`), through the same shared `.chq-empty-reason` (`app/src/styles.css`) as the Speakers filtered row above -- no `max-width` at any breakpoint. Automated verdict stays UNRESOLVED (`formatDateOnly` composes a live date, never the frame's literal "1 February" sample); the automated ratchet total is unaffected. |
| `Chautauqua Submissions.dc.html` `max-width:52ch` "All 47 submissions have a decision..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/submissions/SubmissionsTable.tsx` | none | Real render site: the triage-cleared `EmptyState`'s composed `reason` (`` `All ${allTotal} submissions have a decision. ${spellCount(...)}...` ``), same component, same shared `.chq-empty-reason` as the row above -- one component, two call sites, both unclamped. `src/decisions-data/DEC-380.md`'s wave-116 clause is about the COUNT'S data-availability, unrelated to this width fact. Automated verdict stays UNRESOLVED (composed sentence); the automated ratchet total is unaffected. |
| `Chautauqua Comms.dc.html` `max-width:52ch` "23 submissions have a decision and nobody has been told..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/comms/RecentSends.tsx` | none | `src/decisions-data/DEC-380.md`'s "genuinely unbuildable" note is STALE against this tree: `app/src/pages/Comms.tsx:232-248` already fetches and holds a live `decidedUntoldCount` (`useState` + a real request, `setDecidedUntoldCount(res.total)`), and `RecentSends.tsx:376-380` already composes this exact count-bearing sentence and passes it as the fresh `EmptyState`'s `reason` (no `reasonClassName`) -- through the same shared, unclamped `.chq-empty-reason` as every other row in this group. The count-availability gap DEC-380 recorded is closed; the width gap this lane found is not. Automated verdict stays UNRESOLVED (composed, count varies); the automated ratchet total is unaffected. Flagged for a future lane: `src/decisions-data/DEC-380.md` itself needs a correcting amendment, out of this DOCS-ONLY lane's stated scope (this file only). |
| `Chautauqua Comms.dc.html` `max-width:64ch` "Your body uses {session_time}, and three of these speakers have..." | 64ch | MATCHED (hand, DEC-896 wave-54) | `app/src/pages/comms/ComposeWizard.tsx` | 64 | Real render site: the slot-dependent merge-field advisory banner (DEC-660 wave-142/148), `<p className="chq-comms-merge-warning-body">`. `.chq-comms-merge-warning-body` (`app/src/pages/comms/comms.css`) declares `max-width: 64ch` exactly. Automated verdict stays UNRESOLVED (the banner's recipient count and slotless-field list are composed per compose-draft, never the frame's literal "three"); the automated ratchet total is unaffected -- this row is a genuine MATCH the matcher simply cannot see. |
| `Chautauqua Contacts.dc.html` `max-width:52ch` "Five people are in Contacted. Cards land here when you move them..." | 52ch | UNCLAMPED (hand, DEC-896 wave-54) | `app/src/pages/contacts/PipelineBoard.tsx` | none | Real render site: `<p className="chq-empty-reason">{stageEmptyBody(stage, entries)}</p>` (`PipelineBoard.tsx`), the SAME shared, unclamped `.chq-empty-reason` (`app/src/styles.css`) every other UNCLAMPED row in this group resolves to. Automated verdict stays UNRESOLVED (`stageEmptyBody` composes per stage/entry-count, never the frame's literal "Five"); the automated ratchet total is unaffected. |
| `Chautauqua Contacts.dc.html` `max-width:64ch` "9 rows have no email address" | 64ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/contacts/ImportWizard.tsx` | 64 | new `.chq-contacts-import-file-warning` (`app/src/pages/contacts/contacts-panels.css`), max-width:64ch, appended beside the shared `.chq-error-summary` block |
| `Chautauqua Content.dc.html` `max-width:64ch` "We take PDF, Keynote, PowerPoint and MP4..." | 64ch | MATCHED (hand, DEC-896 wave-54) | `app/src/pages/content/UploadRejectedModal.tsx` | 64 | Real render site: `test/frame-caption-ledger/exclusions/fixture.ts` (v12m-w18-c, wave-143) already records this exact frame sentence as an INVENTED narrative rationale the modal never renders literally -- the real body is `uploadHintText(kind)` (`src/domain/files.ts`), a mechanical "Allowed types: ..." sentence, rendered as `<span className="chq-upload-rejected-band-why">{hintText}</span>`. `.chq-upload-rejected-band-why` (`app/src/pages/content/upload-rejected.css`) declares `max-width: 64ch` exactly -- the width IS already right even though the copy is a considered, ruled substitution (DEC-653) for invented frame prose. Automated verdict stays UNRESOLVED (verbatim text differs by design); the automated ratchet total is unaffected -- this row is a genuine MATCH the matcher cannot see. |

Totals (DEC-896 wave-52, AUTOMATED instrument verdicts, unchanged by
wave-54's hand adjudication below): 5 MATCHED, 0 DIVERGES, 0 UNCLAMPED, 2
INSTRUMENT ARTEFACT, 15 UNRESOLVED. DIVERGES + UNCLAMPED = 0 =
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING`.

Totals (DEC-896 wave-54, HAND adjudication of the 15 UNRESOLVED rows above,
against their own render sites -- see "Wave-54 adjudication" below for the
methodology and why these do not change the automated instrument's count):
of the 15, 3 MATCHED, 3 INSTRUMENT ARTEFACT, 1 NOT RENDERED (ruled), 8
UNCLAMPED. The 8 hand-found UNCLAMPED rows are real product gaps this
DOCS-ONLY lane records but does not repair (desktop is frozen); they do not
raise `PACK_PROSE_MEASURE_DIVERGENCE_CEILING` because the automated
matcher's verbatim-text join cannot resolve a composed or data-driven
sentence to a render file, so its own verdict for all 15 rows remains
UNRESOLVED regardless of this doc's hand findings -- the instrument and
this ledger's hand column are two different, honestly-labelled facts about
the same 15 rows, never conflated.

## Wave-52 repair (DEC-896 amendment, task w52-c)

Wave-49's MEASURE-ONLY lane (DEC-896) left 5 rows this scan classified as
DIVERGES and 3 rows this scan classified as UNCLAMPED, itemised above. This
lane closed all 8:

- **2 reclassified, not repaired** (both `Chautauqua Home.dc.html` rows):
  all three Home hero clamps resolve to the SAME element,
  `.chq-home-hero p` in `src/routes/public/home.css.ts`, whose sentence is
  composed per hub state by `heroSummary()` in `src/routes/root.tsx` -- one
  element cannot carry three distinct `max-width` values, so the widest
  drawn value (54ch, already served) is the real v12 measure and the two
  narrower samples are the same rule seen against shorter copy, not a
  divergence. `test/pack-prose-measure.scan.test.ts`'s `grade()` now
  classifies a DIVERGES row as MATCHED when the render file's declared set
  already contains a value at or above the drawn value (a composed-sentence
  rule), rather than hand-excluding these two rows from the population.
- **6 repaired**, each by adding `max-width: <exact drawn value>ch` to the
  clamped element's OWN class rule (a new `chq-`-prefixed class where the
  element had none), never by widening a shared rule that also clamps other
  sentences: Review's two `ErrorSummary`/criteria-notice sentences (64ch,
  56ch), Overview's and the Portal preview's brand-new/no-speaker
  `EmptyState`/banner sentences (52ch each), Settings' Questions-section
  note (60ch), and the Contacts Import wizard's file-level warning (64ch).
  `ErrorSummary` gained an optional `className` prop and `EmptyState` an
  optional `reasonClassName` prop so a caller can scope its own measure
  without touching the shared component's base class. Every touched
  declaration is a desktop base rule (DEC-385 single-direction): all 6
  rows' `extentKind` measured `desktop` when re-run against this branch, so
  none go inside a `@media (max-width: 700px)` block. Desktop is otherwise
  byte-frozen -- these six declarations are legal only because the v12
  frame draws them.

The UNRESOLVED half (15 of 26 rows) is untouched by this lane and remains
out of scope -- it is not itemised behind a separate ceiling constant, per
the same `PARKED_FIDELITY_PROMISES.PACK_PROSE_MEASURE_DIVERGENCE_CEILING`
row (`siblingName: null`) wave-49 registered. This task did not touch that
registration or any other ratchet constant; `PACK_PROSE_MEASURE_DIVERGENCE_CEILING`
remains registered `OUT_OF_CAMPAIGN_SCOPE`
(`scripts/exit-predicate/campaign-scope/out-of-campaign-scope.ts`) --
promoting it into `CAMPAIGN_CONSTANT_NAMES`/`TIER2_CEILING_NAMES` is a
merge-train act for a later wave, not this one, even though its own count
now reads 0.

## SUPERSEDED-IN-PLACE (wave-54): the paragraph above is stale on promotion timing

The paragraph above still says promotion "is a merge-train act for a later
wave, not this one" -- that premise is what wave-54 tested and found false
in one direction only. `PARKED_FIDELITY_PROMISES.PACK_PROSE_MEASURE_DIVERGENCE_CEILING`'s
CODE-ENCODED gate (`siblingName: null`, checked by
`assertParkedPromisesAreHonestlyParked`) never required this prose's
UNRESOLVED-row-adjudication condition -- only that the ceiling read 0,
which it already did. Sibling task w54-a therefore promotes
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING` into `CAMPAIGN_CONSTANT_NAMES` and
`TIER2_CEILING_NAMES`, and deletes its `PARKED_FIDELITY_PROMISES` row, IN
THE SAME WAVE this task adjudicates the 15 rows the prose (not the code
gate) actually asked for -- the two lanes are independent (w54-a touches
only `scripts/exit-predicate/campaign-scope/*`; this task touches only this
file), landing together by wave, not by one act unlocking the other.
Once w54-a lands, `PACK_PROSE_MEASURE_DIVERGENCE_CEILING` is a GATING row
in the campaign's exit predicate and must stay at 0 -- it may be LOWERED
(impossible, it is already 0) but never raised without a merge-train
re-measurement.

## Wave-54 adjudication (DEC-896, task w54-h): the 15 UNRESOLVED rows

**Why this section exists.** The OUT_OF_CAMPAIGN_SCOPE reason string for
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING` promised promotion "once a later
wave individually adjudicates every UNRESOLVED row against its own render
site". Wave-54 found (task w54-a) that this prose condition was never
actually encoded as a gate -- the code-level promise only checked the
ceiling's live value. Promoting on the encoded rule alone would have left
the prose's real ask (adjudicate all 15) undone forever, quietly deleted
along with the promise row. This task does that real work instead of
letting it vanish with the registration housekeeping.

**Method, per row.** For each of the 15: (1) open the frame extent that
draws the clamped `max-width:<N>ch` span (`docs/design/*.dc.html:<line>`,
the geometry authority); (2) find the ACTUAL render site in `app/src/**` or
`src/**` that owns that sentence's meaning today -- not always the
automated matcher's target, because several of these sentences are
COMPOSED at runtime (a live date, a live count, a per-facet reason) or are
DATA-DRIVEN (an arbitrary speaker bio) and therefore never appear as one
fixed literal string anywhere in the source tree, which is exactly why the
automated `test/pack-prose-measure.scan.test.ts` verbatim-text join could
not resolve them and correctly reported UNRESOLVED rather than a false
verdict; (3) read that render site's OWN class's declared `max-width` (its
inline style, or its `.chq-*` CSS rule) and record it, or record honestly
that no clamp is declared there at all; (4) classify using the instrument's
own four-verdict grammar (`test/pack-prose-measure.scan.test.ts`'s
`ClampVerdict` union: MATCHED, its narrower sibling, UNCLAMPED, and
UNRESOLVED),
plus two new dispositions the evidence required and the grammar had no word
for: **INSTRUMENT ARTEFACT** (the pack draws design-documentation prose
about the B8 standard itself, inside the SAME `.dc.html` file as the real
Overview screens -- there is no product render site because this text was
never product copy) and **NOT RENDERED, ruled** (a specific frame sentence
DEC-986 already rules the product deliberately does not adopt for a named,
cited reason -- absence by ruling, not a gap).

**Result.** 3 of the 15 are hand-verified MATCHED (Home 54ch, Comms 64ch,
Content 64ch), 3 are INSTRUMENT ARTEFACT (all three Overview
explainer-panel rows), 1 is NOT RENDERED under DEC-986 (Public and
Portal's 62ch CFP-intro clause), and 8 are hand-verified UNCLAMPED -- real,
product-side gaps: the render site exists, renders the sentence (or a live
variant of it), and its own class declares no `max-width` at any
breakpoint. Every one of the 8 is the SAME shape: an `EmptyState`/reason-line/banner-title element rendering
through a SHARED base class (`.chq-empty-reason`, `app/src/styles.css`; or
a page-local equivalent with no `reasonClassName`/`className` override) --
the exact class the wave-52 repair pattern (a caller-scoped `className` /
`reasonClassName` prop, already built into both `EmptyState` and
`ErrorSummary`) exists to fix, on a future CSS-authorized lane. This lane
is DOCS ONLY and moves no CSS byte, so none of the 7 are repaired here.

**Every verdict cell above carries this section's own `DEC-896 wave-54`
tag plus a bare-path-and-backtick-quote citation** (or, for the frame
extent itself, `docs/design/*.dc.html:<line>`) per this task's citation-form
requirement -- no bare verdict token sits uncited.
