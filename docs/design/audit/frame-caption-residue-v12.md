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
> **This table was measured on branch `v12m-w4-aq` (DEC-976), forked from
> main at `766c2f92` (DEC-976).** It superseded the prior `v12m-w21-c`
> (DEC-976, wave-146) version of this document in full — every row below
> was re-grepped against the current tree at measurement time, not
> inherited. Both `v12m-w4-aq` and `v12m-w21-c` (DEC-976) have since
> landed on `main`, so this is now a settled per-lane measurement receipt,
> not a claim about a branch still to land; the merge train's post-merge
> INTEGRATED figure, derived after this branch and its eight sibling
> wave-148 lanes landed, is a separate, later measurement.

`test/frame-caption-ledger.scan.test.ts`'s own population/match/exclusion
machinery, forced to `-1` on this branch, measures **14** unmatched captions
— one fewer than the inherited **15** ceiling, because this task disposed
Chautauqua Settings.dc.html:1422 ("Downloaded 18 times by 12 speakers") into
the new UNBACKED exclusion table (`exclusions.ts`, DEC-032; see
`DEVIATIONS.md` §6 and `app/src/pages/settings/ResourcesPanel.tsx`'s header
comment). This lane owns no other row — the 14 remaining below are the same
class of genuine, out-of-scope gap the prior wave's custodian left in the
graded population, each re-verified rather than re-typed from the old table.

**Correction to the inherited table (field-guide finding, this task):**
Overview.dc.html:164's blocker was recorded as "no duration field reaches
the unplaced-row payload." That is now false — `DescribedUnplaced`
(`src/server/repo/agenda/types.ts`) has carried `durationMin` since DEC-895,
and every unplaced row the client actually holds includes it. The real
blocker, confirmed by reading `src/server/repo/overview.ts`, is different:
`unplacedDetailRows` is a `LIMIT ROW_CAP` query (see that file's own "the
unplaced detail rows are their own LIMIT ROW_CAP query" comment, :327-329),
so `AgendaWorkSection.tsx`'s `extraUnplaced` count
(`payload.agendaWork.unplacedTotal - payload.agendaWork.unplaced.length`) is
computed from a total the client has a COUNT for but no DETAIL rows for —
the client never receives the duration of the rows past the cap at all.
Deriving "all need 120 minutes" from the visible capped rows would be
exactly DEC-936's "one row elected to speak for the rest" — not a smaller
version of the old gap, a different one. `Overview.tsx`'s own
`waitingDaysLabel` comment ("never dropped like the unplaced row's duration
— which the server never sends") is itself stale prose from before DEC-895
landed `durationMin`; it should be corrected by whichever lane next touches
that file, not by this one (out of this task's owned files).

| Frame | Line | Drawn text | Named blocker (re-verified this branch) |
|---|---|---|---|
| Chautauqua Comms.dc.html | 757 | "Comms · Compose · step 3" | Re-verified: the whole "Compose · send blocked" 1600px exhibit is unbuilt — `app/src/pages/comms/ComposeWizard.tsx` has no step-breadcrumb header render site of any kind (grepped for a step-index heading pattern; none exists), so this line's own referent is missing, not just its wording. |
| Chautauqua Comms.dc.html | 769 | "Your body uses {session_time}, and three of these speakers have no slot yet. They would receive the literal text "{session_time}"." | Re-verified: `session_time` is a real merge field (`src/mail/render.ts`'s `MERGE_FIELDS`/`MERGE_FIELD_SAMPLES`, DEC-660 wave-142) and `src/routes/comms/compose-core.ts:347-349` resolves it per-recipient from the same `icsScheduleMap` the compose table's Slot column uses, `null` for an unscheduled recipient. Still missing: the compose-time warning **banner** naming `{session_time}` usage against unscheduled recipients — grepped `app/src/pages/comms/ComposeWizard.tsx` for any `session_time`/banner reference naming it: zero hits; the nearest analogue (`{feedback}`-needs-a-plan reveal) is a different mechanism for a different merge field. |
| Chautauqua Overview.dc.html | 164 | "3 more unplaced · all need 120 minutes" | Corrected this task (see note above): not a missing `durationMin` field (DEC-895 landed it) — the blocker is `src/server/repo/overview.ts`'s `unplacedDetailRows` being a `LIMIT ROW_CAP` query, so the client holds a total COUNT but no duration DATA for any row past the cap. Composing "all need 120 minutes" from the visible rows would speak for rows the client cannot see (DEC-936). |
| Chautauqua Public and Portal.dc.html | 444 | "Talk, 30 min · Platform &amp; Infra · accepted 14 Mar" | Re-verified: the portal home's `SessionCard` (`src/routes/portal/index.tsx:257`) composes `metaParts` from a format label, track-name and an accepted-at-derived clause — no "REF ·" prefix. The richer "REF · format · track" line exists at :315 and :508, but on a different card / the separate submission-detail page, not this one. |
| Chautauqua Public and Portal.dc.html | 445 | "Slides v3 · with the organisers" | Re-verified: the same `SessionCard`'s deliverable line (`src/routes/portal/index.tsx:278`) now renders `{deliverable.filename} v{deliverableVersionOrThrow(deliverable)} · with the organisers` — the quote this row originally cited, `{deliverable.filename} · uploaded {date}`, no longer appears anywhere in the file. DEC-908's wave-150 amendment (see that line's own comment) added the version and review-status clause this row had flagged as missing, so the "no review-status clause" claim no longer holds; this row's gap no longer reproduces and should be re-graded/dropped by whichever lane next owns the ledger's population (out of this task's citation-only scope). |
| Chautauqua Public and Portal.dc.html | 620 | "Talk, 30 min · set by the organisers" | Re-verified: grepped `src/server/repo/portal-edit.ts` and `src/routes/portal/edit.tsx` for `durationMin`/"Session length" — zero hits. `EditableSubmissionData` carries no duration field, and there is no read-only "Session length" row to render one. |
| Chautauqua Public and Portal.dc.html | 847 | "Evaluating Agents runs 10:00–12:00, over both Taming 40-Minute CI and Your AI Pair Programmer." | Re-verified: `src/routes/public/agenda-itinerary-script.tsx:163` now composes a richer per-item sentence naming the time range and the joined titles it overlaps, `item.title + ' runs ' + __chqClock(item.startMin) + '–' + __chqClock(item.endMin) + ', over ' + joined + '.'` (DEC-555 wave-148 amendment, see that file's own comment above it) — used whenever the item carries a clock range. The simpler `item.title + ' overlaps ' + joined + '.'` (line 164, this row previously cited it with a stale `otherTitle` variable name at line 144) is the fallback for items with no range. This row's gap no longer reproduces for the ranged case and should be re-graded/dropped by whichever lane next owns the ledger's population (out of this task's citation-only scope). |
| Chautauqua Public and Portal.dc.html | 1080 | "Talk, 30 min · Platform &amp; Infra · intermediate" | Re-verified: the CFP confirmation card's `meta` (`class="chq-cfp-confirm-card-meta"`, `src/routes/public/submit-views.tsx:787`) composes track-then-format only, and `test/cfp-confirmation-email-honesty.test.ts:318` pins that exact order/content (`Main Track · Talk (45 min)`) — reordering to format-then-track or adding the frame's third audience-level clause risks breaking that pin. |
| Chautauqua Public and Portal.dc.html | 1130 | "Lightning talk, 10 min · Developer Experience" | Same `chq-cfp-confirm-card-meta` slot and same pinned-order conflict as :1080 above. |
| Chautauqua Public and Portal.dc.html | 1153 | "Panel, 45 min · AI Engineering" | Same `chq-cfp-confirm-card-meta` slot and same pinned-order conflict as :1080/:1130 above. |
| Chautauqua Public and Portal.dc.html | 1405 | "Talk, 30 min · set by the organisers" | Same gap as :620 above — no duration field on `EditableSubmissionData`; this is the desktop rendering of the identical edit-page slot. |
| Chautauqua Review.dc.html | 598 | "AI Engineering · closes 30 Aug · 2 reviews per talk" | Re-verified: grepped `app/src/pages/review/PlanEditor.tsx` for a track/close-date/reviews-per-talk composing site — zero hits. Opens/Closes/Reviews-per-talk render as three separate editable form fields, never joined into one subtitle. |
| Chautauqua Settings.dc.html | 1515 | "Step 2 of 3 · what we found" | Re-verified: `app/src/pages/settings/SessionboardImportPanel.tsx` is a full panel, not a `ModalFrame`-based dialog — it has no title/subtitle header slot to carry this sentence. Its own step state renders only via a `<ol className="chq-steps">` chip list (:249) — no combined "Step N of 3 · phase label" caption anywhere in the component. |
| Chautauqua Speakers.dc.html | 499 | "3 speakers · nothing has been sent yet" | Re-verified: `app/src/pages/speakers/RemindPreviewModal.tsx`'s modal subtitle composes only `countOf(count, 'recipient')` (e.g. "3 recipients") from the live draft count — real data, but no "nothing has been sent yet" clause exists anywhere in the component (this is a preview, before any send). Narrowest reading of a genuine gap, not a near-miss word swap. |

## Disposed this task (see `test/frame-caption-ledger/exclusions.ts`'s `UNBACKED_EXCLUSIONS` for the full citation)

- **UNBACKED** — Chautauqua Settings.dc.html:1422 ("Downloaded 18 times by
  12 speakers"): `resource` (`src/db/schema/content.ts`) has no
  download-count column and no read-tracking endpoint exists anywhere in
  the repo (`grep -rn download.count`/`downloadCount` outside this doc:
  zero non-test hits) — a declared knob with no reader
  (DEC-851/DEC-988). Recorded as a deliberate non-build in
  `DEVIATIONS.md` §6 and `app/src/pages/settings/ResourcesPanel.tsx`'s
  header comment above the delete-confirm dialog (DEC-032, task w4-aq).

`FRAME_CAPTION_UNMATCHED_CEILING` re-seeded from the inherited **15** to
this branch's measured **14** in `test/frame-caption-ledger/ceiling.ts`,
same commit. The merge train re-measures against the integrated tree once
this lane and its siblings land — the true post-merge figure may differ
(most likely lower, if sibling lanes dispose more of the 14 rows above).
