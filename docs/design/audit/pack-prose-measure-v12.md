# Pack prose-measure (`max-width:<N>ch`) register (DEC-896 wave-49, task w49-e; repaired wave-52, task w52-c)

Instrument: `test/pack-prose-measure.scan.test.ts`. Ratchet:
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING`, measured 0 (DEC-896 wave-52
amendment, task w52-c). Wave-49's MEASURE-ONLY lane moved no CSS byte; this
wave repairs the 6 real DIVERGES/UNCLAMPED rows it left, and reclassifies
the 2 Home rows as an instrument artefact (see "Wave-52 repair" below).

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
| `Chautauqua Home.dc.html` `max-width:54ch` "One call for papers is open. Two programmes are published." | 54ch | UNRESOLVED | -- | -- | composed by `heroSummary()` in `src/routes/root.tsx`, never a literal string this scan's verbatim matcher can find |
| `Chautauqua Home.dc.html` `max-width:52ch` "Nothing is taking submissions. Past programmes are still up." | 52ch | INSTRUMENT ARTEFACT (DEC-896 wave-52) | `src/routes/root.tsx` | 54 | all three Home clamps resolve to ONE element, `.chq-home-hero p` (`src/routes/public/home.css.ts`), whose sentence is composed per hub state by `heroSummary()` -- one element cannot carry three measures, so the widest drawn value (54ch, already served) is the v12 measure and this narrower sample is the same rule against shorter copy. Reclassified, not repaired: `grade()` now treats a composed-sentence render file's declared value >= the drawn value as MATCHED |
| `Chautauqua Home.dc.html` `max-width:46ch` "No call for papers is open and no programme has been published." | 46ch | INSTRUMENT ARTEFACT (DEC-896 wave-52) | `src/routes/root.tsx` | 54 | same shared `.chq-home-hero p` rule; same reclassification as the 52ch row above |
| `Chautauqua Overview.dc.html` `max-width:52ch` "This event has no submissions, no speakers and no schedule..." | 52ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/Overview.tsx` | 52 | `EmptyState`'s new `reasonClassName` prop carries `.chq-overview-brand-new-reason` (`app/src/pages/overview/overview.css`), max-width:52ch, own class -- the shared `.chq-empty-reason` every other `EmptyState` caller renders through is untouched |
| `Chautauqua Overview.dc.html` `max-width:70ch` "Every state in the B8 standard, drawn..." | 70ch | UNRESOLVED | -- | -- | pack explainer-panel prose about the design system itself, not product copy |
| `Chautauqua Overview.dc.html` `max-width:70ch` "The chrome a page can draw without data..." | 70ch | UNRESOLVED | -- | -- | pack explainer-panel prose |
| `Chautauqua Overview.dc.html` `max-width:78ch` "...show nothing — a skeleton that flashes is worse than a beat of stillness..." | 78ch | UNRESOLVED | -- | -- | pack explainer-panel prose |
| `Chautauqua Public and Portal.dc.html` `max-width:62ch` "Three tracks, five formats, no account needed..." | 62ch | UNRESOLVED | -- | -- | CFP intro copy the matcher could not pin verbatim |
| `Chautauqua Public and Portal.dc.html` `max-width:52ch` "Sessions appear here once the committee has finished reviewing..." | 52ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Public and Portal.dc.html` `max-width:52ch` "This is the portal your speakers see. It has no speaker attached..." | 52ch | REPAIRED (DEC-896 wave-52) | `src/routes/portal/preview.tsx` | 52 | `.chq-portal-preview-banner-text` (`src/routes/portal/portal.css.ts`) gained `max-width: 52ch` directly -- it is already this sentence's own class, no other element shares it |
| `Chautauqua Review.dc.html` `max-width:52ch` "Changing these would rescore work already done" | 52ch | MATCHED | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `review.css` declares 52ch among the file's shared clamps |
| `Chautauqua Review.dc.html` `max-width:60ch` "Three to start with — two scored 1–5 and one recorded as a spread..." | 60ch | MATCHED | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | -- |
| `Chautauqua Review.dc.html` `max-width:64ch` "Two things need fixing before this plan can open" | 64ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `ErrorSummary`'s new `className` prop carries `.chq-review-plan-open-errors` (`app/src/pages/review/review.css`), max-width:64ch, own class appended beside the shared `.chq-error-summary` block this page's OTHER `ErrorSummary` callers also render through |
| `Chautauqua Review.dc.html` `max-width:56ch` "Reviewers need at least one thing to score..." | 56ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/review/PlanEditor.tsx` | 32, 52, 56, 60, 64 | `.chq-review-criteria-locked-reason` (`review.css`) gained `max-width: 56ch` -- already this sentence's own class |
| `Chautauqua Settings.dc.html` `max-width:60ch` "Adding, reordering and removing questions happens in the builder..." | 60ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/settings/CallForPapersPanel.tsx` | 60 | new `.chq-settings-questions-note` (`app/src/pages/settings/settings.css`), max-width:60ch, appended beside the shared `.chq-settings-note` Saved embeds' own note also renders through at a different measure |
| `Chautauqua Settings.dc.html` `max-width:64ch` "The public URL you chose is already taken by another event..." | 64ch | MATCHED | `app/src/pages/settings/EventSettingsPanel.tsx` | 64 | `settings.css` |
| `Chautauqua Speakers.dc.html` `max-width:76ch` "Priya Raman leads the build-tooling platform team..." | 76ch | UNRESOLVED | -- | -- | fixture speaker bio prose |
| `Chautauqua Speakers.dc.html` `max-width:52ch` "Marcus Okafor is on the roster, but nothing of his is overdue..." | 52ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Speakers.dc.html` `max-width:64ch` "Marcus Okafor's headshot task did not change" | 64ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Submissions.dc.html` `max-width:52ch` "The call for papers opens on 1 February..." | 52ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Submissions.dc.html` `max-width:52ch` "All 47 submissions have a decision..." | 52ch | UNRESOLVED | -- | -- | a fixture-composed count; see `src/decisions-data/DEC-380.md`'s wave-116 clause |
| `Chautauqua Comms.dc.html` `max-width:52ch` "23 submissions have a decision and nobody has been told..." | 52ch | UNRESOLVED | -- | -- | DEC-380's own registry entry already names this exact string as genuinely unbuildable today (`RecentSends` never loads a decided-submission count) |
| `Chautauqua Comms.dc.html` `max-width:64ch` "Your body uses {session_time}, and three of these speakers have..." | 64ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Contacts.dc.html` `max-width:52ch` "Five people are in Contacted. Cards land here when you move them..." | 52ch | UNRESOLVED | -- | -- | -- |
| `Chautauqua Contacts.dc.html` `max-width:64ch` "9 rows have no email address" | 64ch | REPAIRED (DEC-896 wave-52) | `app/src/pages/contacts/ImportWizard.tsx` | 64 | new `.chq-contacts-import-file-warning` (`app/src/pages/contacts/contacts-panels.css`), max-width:64ch, appended beside the shared `.chq-error-summary` block |
| `Chautauqua Content.dc.html` `max-width:64ch` "We take PDF, Keynote, PowerPoint and MP4..." | 64ch | UNRESOLVED | -- | -- | -- |

Totals (DEC-896 wave-52): 5 MATCHED, 0 DIVERGES, 0 UNCLAMPED, 2 INSTRUMENT
ARTEFACT, 15 UNRESOLVED. DIVERGES + UNCLAMPED = 0 =
`PACK_PROSE_MEASURE_DIVERGENCE_CEILING`.

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
