# Frame caption/consequence ledger residue (task v12m-w4-aq, wave-148, DEC-032/DEC-976)

> A row recorded here is a claim about the tree, not a permanent record. It
> is re-derived against current code before it is scheduled, and once a row
> stops reproducing (a build lands, a schema gains the column, a test's pin
> changes) it should be re-graded and moved into `test/frame-caption-ledger/
> exclusions.ts` as COMPOSED/FIXTURE/SUPERSEDED/UNBACKED, or simply dropped
> from the table below and `FRAME_CAPTION_UNMATCHED_CEILING`
> (`test/frame-caption-ledger/ceiling.ts`) lowered in the same commit
> (DEC-976).
>
> **This table supersedes the wave-146 version of this document in full** —
> every row below was re-grepped against the tree rather than inherited from
> the older table (DEC-976). The counts in the next paragraph are the
> PRE-MERGE figures they were taken as. The merge train has since re-derived the INTEGRATED figure, and
> `FRAME_CAPTION_UNMATCHED_CEILING` (`test/frame-caption-ledger/ceiling.ts`)
> now reads `0`: read the count below as history and the ceiling as the live
> number (DEC-976, DEC-989). Three rows are re-graded **CLOSED** in place
> below, per this document's own rule above — the builds that closed them
> landed in the same batch.

**SUPERSEDED historical snapshot (kept per this document's own rule at the
top — a row is re-graded in place, never deleted).** At the time this
paragraph was written, `test/frame-caption-ledger.scan.test.ts`'s own
population/match/exclusion machinery, forced to `-1` on that branch,
measured **14** unmatched captions — one fewer than the inherited **15**
ceiling, because that task disposed Chautauqua Settings.dc.html:1422
("Downloaded 18 times by 12 speakers") into the new UNBACKED exclusion table
(`exclusions.ts`, DEC-032; see `DEVIATIONS.md` §6 and
`app/src/pages/settings/ResourcesPanel.tsx`'s header comment -- that panel since deleted by multi-portal decision 74), and recorded
the other 14 rows as "the same class of genuine, out-of-scope gap." That
claim is now FALSE (DEC-069 wave-19 clause (a)): all 14 table rows below —
the 3 already CLOSED at merge time plus the 11 this wave re-verdicts CLOSED
— are built. `FRAME_CAPTION_UNMATCHED_CEILING` already reads `0` in
`test/frame-caption-ledger/ceiling.ts` (re-seeded by an earlier merge train),
so the live scan already agrees with this: nothing here contradicts the
current ceiling, only this document's own prose had not caught up to it.

**Correction to the inherited table, itself now superseded (field-guide
finding, wave-148 task; kept for history, see the wave-19 row below for the
current verdict):** Overview.dc.html:164's blocker was recorded as "no
duration field reaches the unplaced-row payload." That was already false by
wave-148 — `DescribedUnplaced` (`src/server/repo/agenda/types.ts`) has
carried `durationMin` since DEC-895. The wave-148 correction re-recorded the
blocker as `unplacedDetailRows`' `LIMIT ROW_CAP` starving the client of
duration DATA for rows past the cap. That in turn is now also closed — see
the wave-19 row below: DEC-895's own wave-148 amendment added a dedicated
remainder query (`unplacedRemainderCount` in `src/server/repo/overview.ts`)
that fetches exactly that data for the rows past the cap, so this whole
paragraph's blocker no longer reproduces either.

**Wave-19 re-verdict (DEC-069 wave-19 clause (a)):** every one of the eleven
rows below was re-grepped against the tree this wave and every single one is
now CLOSED — the row's recorded blocker no longer reproduces; the build that
closed it landed in an earlier wave (mostly wave-148/wave-150) and the row
was simply never re-verified against it. Only the two rows already marked
CLOSED before this wave (Portal :444/:445, :847) needed no work. Citations
below use the drift-proof bare-path shape (`test/citation-form-drift.scan.test.ts`):
a bare path immediately followed by a backtick-quoted literal that must
resolve verbatim anywhere in the cited file, never a `path:line` pin.

| Frame | Line | Drawn text | Named blocker (re-verified this branch) |
|---|---|---|---|
| Chautauqua Comms.dc.html | 757 | "Comms · Compose · step 3" | **CLOSED (re-verified wave-19).** The recorded blocker no longer reproduces: the wizard now portals a step-breadcrumb header, app/src/pages/comms/ComposeWizard.tsx`<p className="chq-comms-wizard-breadcrumb">Comms · Compose · step {currentIndex + 1}</p>`, into the header slot — not "no render site of any kind" as recorded. |
| Chautauqua Comms.dc.html | 769 | "Your body uses {session_time}, and three of these speakers have no slot yet. They would receive the literal text "{session_time}"." | **CLOSED (re-verified wave-19).** The recorded "zero hits" no longer holds: app/src/pages/comms/ComposeWizard.tsx`SLOT_DEPENDENT_MERGE_FIELDS` (DEC-660 wave-148, the file's own comment at this line names frame :769 directly) drives `usedSlotDependentFields`, rendered as the exact pre-emptive advisory banner this row said was missing. |
| Chautauqua Overview.dc.html | 164 | "3 more unplaced · all need 120 minutes" | **CLOSED (re-verified wave-19).** The prior "Corrected this task" note above (DEC-936, `unplacedDetailRows`' `LIMIT ROW_CAP`) is itself now stale: src/server/repo/overview.ts`unplacedRemainderCount` (DEC-895 wave-148 amendment, the file's own comment names frame :164 by the "unplaced REMAINDER" phrase) is a dedicated remainder query that fetches session_format/duration answers for every row past the cap, not just the visible ones — the client no longer has to speak for rows it cannot see. |
| Chautauqua Public and Portal.dc.html | 444 | "Talk, 30 min · Platform &amp; Infra · accepted 14 Mar" | **CLOSED (DEC-908, wave-150).** The recorded blocker no longer reproduces: the portal home's `SessionCard` now composes the frame's format-first meta order, src/routes/portal/index.tsx`const formatLabel =` deriving the clause through the one `sessionFormatLabel` vocabulary and placing it ahead of track-name and the accepted-at clause — never a second '(N min)' parser, and omitted rather than fabricated when the stored answer carries no parseable duration (DEC-895). |
| Chautauqua Public and Portal.dc.html | 445 | "Slides v3 · with the organisers" | **CLOSED (DEC-908, wave-150).** The recorded blocker no longer reproduces: the same card's deliverable line now carries the version + review-status clause the frame draws, src/routes/portal/index.tsx`v{deliverableVersionOrThrow(deliverable)} · with the organisers`, built from the SAME vocabulary the submission detail page already established — and failing loudly rather than defaulting when the stored version is null (DEC-818). |
| Chautauqua Public and Portal.dc.html | 620 | "Talk, 30 min · set by the organisers" | **CLOSED (re-verified wave-19).** The recorded "zero hits" no longer holds: src/routes/portal/edit.tsx`Session length` renders a read-only section label row (`<div class="chq-section-label">Session length</div>`) between the format and audience-level rows, exactly as the frame draws — this file's own comment at that line cites frame :620/:1405 by name. |
| Chautauqua Public and Portal.dc.html | 847 | "Evaluating Agents runs 10:00–12:00, over both Taming 40-Minute CI and Your AI Pair Programmer." | **CLOSED (DEC-555, wave-148 amendment).** The recorded blocker no longer reproduces: the overlaps panel now emits one sentence per COVERING session, naming its own clock range and every title it covers — src/routes/public/agenda-itinerary-script.tsx`item.title + ' runs '` composes exactly the frame's richer clause. The simpler per-pair sentence survives only for a saved item that carries no range at all. |
| Chautauqua Public and Portal.dc.html | 1080 | "Talk, 30 min · Platform &amp; Infra · intermediate" | **CLOSED (DEC-908, wave-148 amendment; re-verified wave-19).** The recorded "track-then-format only" pin no longer holds: src/routes/public/submit-views.tsx`chq-cfp-confirm-card-meta` now composes format, track AND the frame's third audience-level clause in frame order, and `test/cfp-confirmation-email-honesty.test.ts`'s own `describe("CFP confirmation card states format, track and audience level in frame order (DEC-908 wave-148 amendment)"` pins `Talk, 45 min · Main Track · intermediate` — the very order/content this row said risked breaking a pin now IS the pinned behaviour. |
| Chautauqua Public and Portal.dc.html | 1130 | "Lightning talk, 10 min · Developer Experience" | **CLOSED (DEC-908, wave-148 amendment; re-verified wave-19).** Same `chq-cfp-confirm-card-meta` slot as :1080 above, now closed the same way — format/track/audience-level in frame order, pinned by the same test. |
| Chautauqua Public and Portal.dc.html | 1153 | "Panel, 45 min · AI Engineering" | **CLOSED (DEC-908, wave-148 amendment; re-verified wave-19).** Same `chq-cfp-confirm-card-meta` slot as :1080/:1130 above, closed the same way. |
| Chautauqua Public and Portal.dc.html | 1405 | "Talk, 30 min · set by the organisers" | **CLOSED (re-verified wave-19).** Same fix as :620 above — this is the desktop rendering of the identical edit-page "Session length" row, src/routes/portal/edit.tsx`Session length`, which now renders. |
| Chautauqua Review.dc.html | 598 | "AI Engineering · closes 30 Aug · 2 reviews per talk" | **CLOSED (DEC-709 wave-148 amendment; re-verified wave-19).** The recorded "zero hits" no longer holds: app/src/pages/review/PlanEditor.tsx`planHeadSubtitle` composes tracks/closes-date/reviews-per-talk into exactly this " · "-joined subtitle, dropping any clause whose input is null — the file's own comment at this function cites frame :598 by name. |
| Chautauqua Settings.dc.html | 1515 | "Step 2 of 3 · what we found" | **CLOSED (re-verified wave-19).** The recorded "no title/subtitle header slot" no longer holds: app/src/pages/settings/SessionboardImportPanel.tsx`chq-settings-section-caption` now renders a combined `Step ${step} of 3 · ${...}` caption directly under the panel head, matching the frame's clause verbatim in shape. |
| Chautauqua Speakers.dc.html | 499 | "3 speakers · nothing has been sent yet" | **CLOSED (re-verified wave-19).** The recorded "no such clause exists anywhere" no longer holds: app/src/pages/speakers/RemindPreviewModal.tsx`nothing has been sent yet` is rendered verbatim as the modal subtitle whenever `skipped === 0`, alongside the live `countOf(count, 'speaker')` count. |

## Disposed this task (see `test/frame-caption-ledger/exclusions.ts`'s `UNBACKED_EXCLUSIONS` for the full citation)

- **UNBACKED** — Chautauqua Settings.dc.html:1422 ("Downloaded 18 times by
  12 speakers"): `resource` (`src/db/schema/content.ts`) has no
  download-count column and no read-tracking endpoint exists anywhere in
  the repo (`grep -rn download.count`/`downloadCount` outside this doc:
  zero non-test hits) — a declared knob with no reader
  (DEC-851/DEC-988). Recorded as a deliberate non-build in
  `DEVIATIONS.md` §6 and `app/src/pages/settings/ResourcesPanel.tsx`'s (since deleted by multi-portal decision 74)
  header comment above the delete-confirm dialog (DEC-032, task w4-aq).

`FRAME_CAPTION_UNMATCHED_CEILING` re-seeded from the inherited **15** to
this branch's measured **14** in `test/frame-caption-ledger/ceiling.ts`,
same commit. The merge train re-measures against the integrated tree once
this lane and its siblings land — the true post-merge figure may differ
(most likely lower, if sibling lanes dispose more of the 14 rows above).
