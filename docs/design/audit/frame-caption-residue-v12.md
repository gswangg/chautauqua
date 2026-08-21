# Frame caption/consequence ledger residue (task v12m-w21-c, wave-146, DEC-380/DEC-989)

> A row recorded here is a claim about the tree, not a permanent record. It
> is re-derived against current code before it is scheduled, and once a row
> stops reproducing (a build lands, a schema gains the column, a test's pin
> changes) it should be re-graded and moved into `test/frame-caption-ledger/
> exclusions.ts` as COMPOSED/FIXTURE/SUPERSEDED, or simply dropped from the
> table below and `FRAME_CAPTION_UNMATCHED_CEILING`
> (`test/frame-caption-ledger/ceiling.ts`) lowered in the same commit
> (DEC-976).

`test/frame-caption-ledger.scan.test.ts`'s own population/match/exclusion
machinery found main red twice over on this ledger: `FRAME_CAPTION_UNMATCHED_
CEILING = 101` against a tree that (forcing the ceiling to `-1` and reading
the printed offender list back) actually measures **20**. The 101 was
v12m-w18-b's own pre-integration figure; every wave-18 lane's dispositions
are additive and all landed on main, so the live count had simply never been
re-measured against the integrated tree.

Of those twenty rows, five are now excluded in `exclusions.ts` (1 COMPOSED,
3 FIXTURE, 1 SUPERSEDED — see that file's `v12m-w21-c` history entry for the
citations). The remaining **fifteen** stay in the graded population as
genuine, out-of-scope gaps. Each row below names the exact blocker; building
any of them is a real feature addition (a schema column, a merge field's
consuming UI, a composing expression joining two live values, or a
disagreement with an existing pinned test) and out of this caption-residue
task's narrow scope.

| Frame | Line | Drawn text | Named blocker |
|---|---|---|---|
| Chautauqua Comms.dc.html | 757 | "Comms · Compose · step 3" | The whole "Compose · send blocked" 1600px exhibit is unbuilt — `app/src/pages/comms/ComposeWizard.tsx` has no step-breadcrumb header render site of any kind (grepped for a step-index heading pattern; none exists), so this line's own referent is missing, not just its wording. |
| Chautauqua Comms.dc.html | 769 | "Your body uses {session_time}, and three of these speakers have no slot yet. They would receive the literal text "{session_time}"." | `session_time` **is now a real merge field** — DEC-660's wave-142 amendment landed it in `MERGE_FIELDS`/`MERGE_FIELD_SAMPLES`/`COMPOSE_MERGE_FIELDS`, and `src/routes/comms/compose-core.ts` resolves it per-recipient from the same schedule read the Slot column uses (`sessionTime`, set to `null` for an unscheduled recipient). What is still missing is the compose-time **warning banner** that names `{session_time}` usage against unscheduled recipients — DEC-660's own text calls this "a follow-on once the field exists"; `ComposeWizard.tsx` has no such banner (the nearest analogue, the `{feedback}`-needs-a-plan reveal, is a different mechanism for a different merge field). |
| Chautauqua Overview.dc.html | 164 | "3 more unplaced · all need 120 minutes" | `app/src/pages/Overview.tsx`'s own `waitingDaysLabel` comment records the gap directly: "never dropped like the unplaced row's duration (**which the server never sends** — see AgendaWorkSection.tsx)". No duration field reaches the unplaced-row payload. |
| Chautauqua Public and Portal.dc.html | 444 | "Talk, 30 min · Platform &amp; Infra · accepted 14 Mar" | The portal home's `SessionCard` (`src/routes/portal/index.tsx`) composes only `metaParts = [trackName, acceptedAt-derived]` — no format/duration clause. The richer "REF · format · track" line does exist, but on the separate submission-detail page, not this card. |
| Chautauqua Public and Portal.dc.html | 445 | "Slides v3 · with the organisers" | The same `SessionCard`'s deliverable line renders `{deliverable.filename} · uploaded {date}` only — no review-status clause ("with the organisers") exists anywhere in that component. |
| Chautauqua Public and Portal.dc.html | 620 | "Talk, 30 min · set by the organisers" | `src/server/repo/portal-edit.ts`'s `EditableSubmissionData` carries no duration field, and `src/routes/portal/edit.tsx` has no read-only "Session length" row to render one. |
| Chautauqua Public and Portal.dc.html | 847 | "Evaluating Agents runs 10:00–12:00, over both Taming 40-Minute CI and Your AI Pair Programmer." | `src/routes/public/agenda-itinerary-script.tsx` composes only `item.title + ' overlaps ' + otherTitle + '.'` — a single simpler per-pair sentence, never the frame's richer clause naming the time range and "both" talks at once. |
| Chautauqua Public and Portal.dc.html | 1080 | "Talk, 30 min · Platform &amp; Infra · intermediate" | The CFP confirmation card's `meta` composes track-then-format only (`class="chq-cfp-confirm-card-meta"` in `src/routes/public/submit-views.tsx`), and `test/cfp-confirmation-email-honesty.test.ts` pins that exact order/content (`Main Track · Talk (45 min)`) — reordering to format-then-track or adding the frame's third audience-level clause risks breaking that pin. |
| Chautauqua Public and Portal.dc.html | 1130 | "Lightning talk, 10 min · Developer Experience" | Same `chq-cfp-confirm-card-meta` slot and same pinned-order conflict as :1080 above. |
| Chautauqua Public and Portal.dc.html | 1153 | "Panel, 45 min · AI Engineering" | Same `chq-cfp-confirm-card-meta` slot and same pinned-order conflict as :1080/:1130 above. |
| Chautauqua Public and Portal.dc.html | 1405 | "Talk, 30 min · set by the organisers" | Same gap as :620 above — no duration field on `EditableSubmissionData`, this is the desktop rendering of the identical edit-page slot. |
| Chautauqua Review.dc.html | 598 | "AI Engineering · closes 30 Aug · 2 reviews per talk" | `app/src/pages/review/PlanEditor.tsx` has no composing site joining a track name, an absolute close date and the reviews-per-talk count into one subtitle — Opens/Closes/Reviews-per-talk are three separate editable form fields, never a summary line. |
| Chautauqua Settings.dc.html | 1422 | "Downloaded 18 times by 12 speakers" | `src/db/schema/content.ts`'s `resource` table has no download-count column and no read-tracking endpoint anywhere in the repo (`grep -rn download.count` outside this doc: zero hits) — nothing computes this number. |
| Chautauqua Settings.dc.html | 1515 | "Step 2 of 3 · what we found" | `app/src/pages/settings/SessionboardImportPanel.tsx` is a full panel, not a `ModalFrame`-based dialog, so it has no title/subtitle header slot to carry this sentence at all — its own step state renders only via a `<ol className="chq-steps">` chip list (no combined "Step N of 3 · phase label" caption anywhere in the component). |
| Chautauqua Speakers.dc.html | 499 | "3 speakers · nothing has been sent yet" | `app/src/pages/speakers/RemindPreviewModal.tsx`'s modal subtitle composes only `countOf(count, 'recipient')` (e.g. "3 recipients") from the live draft count — real data, but it never states the "nothing has been sent yet" clause (this is a preview, before any send); no such phrasing exists anywhere in the component. Flagged as the narrowest reading of a genuine gap, not a near-miss word swap. |

## Disposed this task (see `exclusions.ts` for the full citations)

- **COMPOSED** — Chautauqua Contacts.dc.html:321 ("20 people · drag between
  columns"): built, `app/src/pages/contacts/PipelineBoard.tsx` composes
  `{total} people{!isPhone && ' · drag between columns'}` — v12m-w19-a's
  desktop/phone conditional split the frame's one literal string across two
  JSX expressions, invisible to a plain-substring or digit-skeleton match.
- **FIXTURE** — Chautauqua Agenda.dc.html:194 ("DFC-033 · lightning talk, 10
  min"): the pack's own mock submission code, already excluded at the
  identical file:line:text by `test/phone-dock-ledger.scan.test.ts` — this
  disposition removes the two-ledger disagreement DEC-967 flagged.
- **FIXTURE** — Chautauqua Speakers.dc.html:235 ("Priya Raman · sent 2
  Apr") and :521 ("12–14 May 2027 · Moscone West, San Francisco"): both the
  pack's recurring invented "Priya Raman"/"DevFlow Conf 2027" mock
  identities used as modal-exhibit sample content; :521 is the identical
  text already excluded once at Chautauqua Comms.dc.html:713.
- **SUPERSEDED** — Chautauqua Settings.dc.html:1427 ("This cannot be undone.
  Speakers linking to it will get a 404."): `app/src/pages/settings/
  ResourcesPanel.tsx`'s delete-confirm dialog already fills this exact slot
  with a different, deliberate consequence sentence — "Speakers lose the
  download from their portal. "{title}" cannot be recovered." — naming the
  human consequence a speaker actually experiences rather than the HTTP
  status code the frame's words describe.

`FRAME_CAPTION_UNMATCHED_CEILING` re-seeded from the stale 101 to the
measured **15** in `test/frame-caption-ledger/ceiling.ts`, same commit.
