# Eval findings — PRODUCTION round (live chautauqua.cc, 2026-08-11)

Source: three CC-native browser-eval agents driving the LIVE production deployment
(https://chautauqua.cc). This is the authoritative post-deploy pass. Most of the prior
consolidated findings are CONFIRMED FIXED in production (see "Verified fixed" below);
what remains are the items here.

## SWARM ROUND MANDATE

Resume from HEAD (which already includes two direct hotfixes — ratify them, Section A) and
fix the items below, priority order. Code-bearing → DEC-069 reopens; re-run all gates
(build, tests, render-sweep, walkthrough, perf) before re-declaring. The render-sweep gate
did its job (no blank-screen crashes in production) — keep extending it.

1. Ratify Section A (two already-deployed hotfixes) + add regression tests.
2. Fix the Section B P1s (review flow + CRM merge) — review is a core weight-20 area.
3. Fix Section C P2s by rubric weight (content deliverables dashboard is weight-3).
4. Section D P3s if time allows.

## Verified FIXED in production (no action; add/confirm regression coverage)
- Public widgets: session cards show date/time/room; keyword search (title+speaker);
  speaker & gallery detail pages; agenda day-nav; itinerary `.ics` now carries real
  VEVENTs; cross-surface consistency (EMB-01/02/05/07/11/13/16 all pass).
- Review: per-round scorecards exist; free-text criterion type exists; anonymization
  hides speaker identity server-side; reviewer queue now POPULATES (prior empty-queue P1
  fixed). (ABS-01/03/07 pass.)
- Speaker: portal bio+headshot round-trip to organizer AND public (SPK-08); task
  completion persists with the enriched seed (SPK-09); roster/filters/matrix (SPK-01/05/12).
- Content: upload against a task (CNT-02); content-approval gates the public sessions page
  (CNT-12). Agenda: builder/conflicts/auto-schedule (AIA-01/04/05/08). CRM: directory,
  custom fields, CSV import, segments-reopen-correctly (prior lossy-rule bug fixed),
  sourcing pipeline kanban (CRM-01/04/05/09/07).
- Admin SPA reachable in a real browser; all render-sweep routes green.

## A. Already fixed directly + deployed (RATIFY + regression test)
- **Production login 500 — PBKDF2 600k > workerd's 100k cap.** ITERATIONS now 100_000
  (runtime max); seeds regenerated; DEC-004 amended. Add a test asserting ITERATIONS <=
  100000 (and ideally a deployed-smoke that login succeeds).
- **Public CFP submit 500 on confirmation-email failure.** The confirmation send is now
  best-effort (try/catch + log; row already persisted; email attempt logged with status
  'error'). Add a test: submit flow returns the confirmation page even when the mailer
  throws. NOTE: apply the same best-effort treatment deliberately to OTHER mailer call
  sites where a send failure should not abort the primary action — the cron reminder
  loop (`runDueReminders`) especially (one bad recipient must not abort the whole tick);
  BUT keep organizer-triggered sends (decision notifications, bulk email) surfacing a
  clear error to the organizer who clicked send (not a 500 — a structured error).

## B. P1 — bugs that break a core flow

- **Reviewer assignment always fails "User not found."** On every plan (new + seed), every
  reviewer, every scope (one-submission / all-plan), Assign shows "User not found" and the
  assignment list is unchanged — while "Create reviewer account" for the same email says
  the user already exists. Almost certainly a contact-id vs user-id lookup mismatch in the
  assignment path. Blocks ABS-05 (organizer cannot assign submissions to reviewers).
  Where: reviewer-assignment section of /admin/review/plans/*.
- **Reviewer queue links all point to /submissions/undefined.** The queue populates
  correctly, but every item's link href is `/submissions/undefined` (renders "Submission
  not found"), and "Submit and advance" advances to the same — so a reviewer cannot open
  any scorecard from their queue (only hand-typed URLs work). A missing/mis-keyed id field
  in the queue row model. Where: /admin/review/plans/:id reviewer "Your queue".
- **CRM duplicate merge is a silent no-op.** Detection now surfaces the seeded pairs with a
  keep-record dialog (that half is fixed), but confirming Merge does nothing — dialog stays
  open, no error/toast, both records persist after reload. Reproduced on both pairs.
  Where: /admin/contacts > Duplicates. (CRM is extra-credit, but this is a clean broken
  action.)

## C. P2 — real gaps aligned with rubric

- **Content deliverables dashboard doesn't reflect real uploads (CNT-07, weight-3).** A
  speaker's task upload appears only as a paperclip in the speakers matrix; the Content >
  Files tab shows only seed rows (not today's uploads), and the worklist Presentation/
  Poster/Handout counts stay 0 0 0 while the Files tab lists files — the two Content views
  disagree. Wire the deliverables dashboard/worklist to the real task-upload file rows.
- **No file version history (CNT-04).** Re-upload silently mints a new /files/<id> and
  replaces the link; no v1/v2 listing anywhere; the Files "Versions" column only shows a
  count on seed data and rows aren't clickable. Implement a per-file history view fed by
  the real version chain.
- **No file comment threads (CNT-05).** Absent from the UI in both roles.
- **Submissions table: track shown as a count, no format column (CFP-06).** The table shows
  Tracks "1" (count) not the track name, and has no Format column; the Columns toggle group
  is unlabeled checkboxes that do nothing. Track/format are correct only on the detail page.
- **Review results table: dropdown-criterion column always "—", and not sortable
  (ABS-10).** The dropdown answer is silently folded into the numeric Average (a 4/5/
  "Just right" review produced Average 4.33), so the aggregate is misleading and the
  per-option distribution is invisible; and result columns have no sort controls.

## D. P3 / polish

- Public CFP "Save draft" gives no visible confirmation (form just re-renders).
- Duplicate-merge aside: deleting the actively-applied CRM segment flashes a transient
  "Internal server error" banner (list refetch references the deleted segment id).
- Headshot upload in /portal/profile gives no success feedback and no current-headshot
  preview; a no-op submit is indistinguishable from success.
- Completed file-request tasks collapse to plain text: the speaker can't see/download/
  replace their own uploaded file without an organizer flipping the task back to Pending.
- Content > Files intermittently rendered "No deliverable files yet" then showed rows ~10
  min later (stale/racy load).
- Reviewer queue shows "( rating(s) so far)" with the count value missing.
- Add-criterion clicks made before changing Rounds are discarded on the per-round
  re-render; several admin inputs (plan fields, submissions Columns toggles) are unlabeled
  (a11y + automation hazard).
- First organizer login click occasionally no-ops (needs a second click ~3s later) — slow
  auth round-trip.

## Note: production is otherwise strong
Public pages < 1s; admin SPA settles ~1.5–2s; auto-schedule ~2s; no crashes/timeouts/blank
screens anywhere. The CFP front door, login, content approval gating, agenda, public
surfaces, speaker portal round-trip, and email/.ics all work on real infrastructure.
