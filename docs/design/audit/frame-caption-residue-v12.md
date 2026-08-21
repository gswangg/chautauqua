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
> the older table. It was first measured on branch `v12m-w4-aq` (DEC-976),
> forked from main at `766c2f92`; both `v12m-w4-aq` and the prior
> `v12m-w21-c` (DEC-976, wave-146) version have since landed on `main`.
> The counts in the next paragraph are the PRE-MERGE figures they were taken
> as. The merge train has since re-derived the INTEGRATED figure, and
> `FRAME_CAPTION_UNMATCHED_CEILING` (`test/frame-caption-ledger/ceiling.ts`)
> now reads `0`: read the count below as history and the ceiling as the live
> number (DEC-976, DEC-989). Three rows are re-graded **CLOSED** in place
> below, per this document's own rule above — the builds that closed them
> landed in the same batch.

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
| Chautauqua Public and Portal.dc.html | 444 | "Talk, 30 min · Platform &amp; Infra · accepted 14 Mar" | **CLOSED (DEC-908, wave-150).** The recorded blocker no longer reproduces: the portal home's `SessionCard` now composes the frame's format-first meta order, src/routes/portal/index.tsx`const formatLabel =` deriving the clause through the one `sessionFormatLabel` vocabulary and placing it ahead of track-name and the accepted-at clause — never a second '(N min)' parser, and omitted rather than fabricated when the stored answer carries no parseable duration (DEC-895). |
| Chautauqua Public and Portal.dc.html | 445 | "Slides v3 · with the organisers" | **CLOSED (DEC-908, wave-150).** The recorded blocker no longer reproduces: the same card's deliverable line now carries the version + review-status clause the frame draws, src/routes/portal/index.tsx`v{deliverableVersionOrThrow(deliverable)} · with the organisers`, built from the SAME vocabulary the submission detail page already established — and failing loudly rather than defaulting when the stored version is null (DEC-818). |
| Chautauqua Public and Portal.dc.html | 620 | "Talk, 30 min · set by the organisers" | Re-verified: grepped `src/server/repo/portal-edit.ts` and `src/routes/portal/edit.tsx` for `durationMin`/"Session length" — zero hits. `EditableSubmissionData` carries no duration field, and there is no read-only "Session length" row to render one. |
| Chautauqua Public and Portal.dc.html | 847 | "Evaluating Agents runs 10:00–12:00, over both Taming 40-Minute CI and Your AI Pair Programmer." | **CLOSED (DEC-555, wave-148 amendment).** The recorded blocker no longer reproduces: the overlaps panel now emits one sentence per COVERING session, naming its own clock range and every title it covers — src/routes/public/agenda-itinerary-script.tsx`item.title + ' runs '` composes exactly the frame's richer clause. The simpler per-pair sentence survives only for a saved item that carries no range at all. |
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
