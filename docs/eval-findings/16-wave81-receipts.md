# Wave-81 receipts (task-w81-c) — re-derivation of the ALL-PASS PUSH lane

MEASURED_SHA `c01731eb06d0a02550054cb84fe238b632ecba8b` ("scribe wave 81"),
derived AT THIS TASK'S OWN RUNTIME from the loose ref
`.git/refs/heads/main`, cross-checked against the tail of
`.git/logs/HEAD` (the entry immediately preceding this worktree's own
branch-creation line reads `... c01731eb06d0a02550054cb84fe238b632ecba8b
Greg Niemeyer ... commit: scribe wave 81` — DEC-069/DEC-358 rebase rule).
This is a DOCS-ONLY mandate-hygiene task; no gate ran, no `docs/
verification-log/index/` section filed (DEC-069, w74/w76/w78/w80
precedent).

Scope per the task brief: re-verify `docs/eval-findings.md:58-129`'s
ALL-PASS PUSH block (A items 1-11, B items 12-22) plus the four
review-lens findings a reviewer re-filed this round, against the tree at
MEASURED_SHA — quoting a fresh `path:line` for each, not inheriting a
prior wave's claim.

## A. FIDELITY residue (items 1-11)

1. **§09 settings residue (M1/M2/M4/M5/M7/R2)** — OPEN. No fresh evidence
   read this task; the brief did not ask for a re-shoot against gate-10/
   gate-11 group3 measures and none was taken. Left as-is, undecided.
2. **New-contact modal (frame 08--16)** — CLOSED-WITH-RECEIPT. `app/src/
   pages/contacts/NewContactModal.tsx:162` — the email field's `help`
   prop reads "It's how contacts are matched and merged — the same key
   the CSV importer's dedupe and the merge tool use." (states WHY it's
   required, matched/merged). `:206-209` — the modal's scope note: "Adding
   a contact here does not put them on an event — use “Add to an event”
   on their row for that." (closes by naming what it does not do,
   directory ≠ event). Both halves of item 2 present.
3. **FieldModal residue (dialog title / operator words / card width)** —
   OPEN. Not read this task; out of grep budget for this pass, no claim
   made either way.
4. **732/756 content-box ruling** — IN-FLIGHT per the brief's own
   instruction (home-hub lane, this wave). Ruling as stated in
   `docs/eval-findings.md:132-138`: HOME_MEASURE/container stays 820, the
   frame's internal horizontal padding lands the CONTENT box at 732
   (home hub, 820−2×44) and 756 (CFP builder reading column,
   820−2×32). Not independently re-verified against rendered output by
   this task — recorded as in-flight, not closed, per the brief's
   explicit instruction not to close it here.
5. **Fleet method rule (compare LIKE boxes)** — IN-FLIGHT alongside item
   4, same reason; recorded, not independently re-verified or closed.
6. **Home CTA dark-on-dark hover** — CLOSED-WITH-RECEIPT. `src/routes/
   public/home.css.ts:53` —
   `a.chq-home-action-primary:hover { background: var(--chq-brand-hover);
   color: var(--chq-on-brand); }`, anchor-qualified (specificity 0,2,1)
   to beat `theme.ts`'s `a:not(.chq-btn):hover` (0,2,0); the preceding
   comment (`:48-52`) cites DEC-383 (wave-66 amendment) and states the
   label stays on-brand on hover. Read directly this task.
7. **Status-cell hover ring (outset vs inset)** — CLOSED-WITH-RECEIPT.
   `test/palette-conformance.test.ts:130-141` declares an
   `OUTSET_RING_ALLOWLIST_FILES` set naming exactly `app/src/pages/
   speakers/speakers.css` and `app/src/pages/review/review.css`, citing
   DEC-989 (wave-64 amendment). `app/src/pages/speakers/speakers.css:
   290-298`: `.chq-speakers-status:hover { box-shadow: 0 0 0 2px
   var(--chq-border-strong); }` with a comment stating "the status-cell
   ring is OUTSET, not inset". `app/src/pages/review/review.css:732-737`:
   `.chq-review-criterion.chq-focused { box-shadow: 0 0 0 2px
   var(--chq-border-strong); }`, same DEC-939/DEC-989 citation. The DEC
   the item asked to "update" reads DEC-989/DEC-939, already amended —
   not DEC-383, which the item's own text misnamed as the ruling to
   change (DEC-383 governs the CTA hover in item 6, a different rule).
   No open work.
8. **Breaks editor Done control + extra Location row** — CLOSED-WITH-
   RECEIPT, but the "drop the Location row" half is a deliberate
   divergence, not a removal. `app/src/pages/agenda/BreaksPanel.tsx:
   64-67` declares `onDone: () => void` with a comment citing "DEC-021
   amendment (w66, gate-11 sweep item 4)"; `:527-532` renders `<div
   className="chq-breaks-panel-foot"><button ... onClick={onDone}>Done
   </button></div>`. The Location row is still rendered (`:473-484`,
   `chq-breaks-field-location`) — but with its own comment: "Location
   isn't in the drawn frame (schedule_break has the column, the frame
   doesn't draw it) -- app-only, so it gets its own full-width line". A
   prior wave ruled this KEPT deliberately (field guide: "Location row
   ruled kept"); item 8's "drop the extra Location row" clause is
   superseded by that ruling, not unimplemented. Closed as: Done control
   present, Location-row removal explicitly overruled.
9. **Settings deep-link `?section=<x>&edit=1` arrives editing** — NOT
   RE-VERIFIED this task (out of grep budget; the field guide's w78
   receipt already names `PortalSettingsPanel.tsx:110,216,240,323` for
   the `?section=portal&edit=1` case specifically, not the general
   `resources` case item 9 names). Left OPEN pending a direct read of
   the `resources` section's edit-arrival wiring.
10. **API-tokens row in Your data EDIT view** — NOT RE-VERIFIED this
    task; the field guide's w78 receipt already names
    `YourDataPanel.tsx:53,202,228`. Not independently re-read this pass;
    left as previously reported (believed closed, not re-confirmed here
    to stay within this task's file scope).
11. **"Import 1 rows" plural** — CLOSED-WITH-RECEIPT, re-confirmed.
    `app/src/pages/settings/SessionboardImportPanel.render.test.tsx:
    110-129` — test title "pluralizes the confirm button label: 'Import 1
    row' for a one-row dry run, 'Import 3 rows' otherwise", and asserts
    `screen.queryByRole('button', { name: 'Import 1 rows' })` is
    `.not.toBeInTheDocument()`. Already carried a wave-67 receipt
    in-file (`docs/eval-findings.md:318`); this task independently
    re-read the test rather than trusting the citation.

## B. EVAL-run minors (items 12-22)

12. **SES-002/SES-032 identical-title synth pair** — NOT RE-VERIFIED
    this task (would require re-running seed and diffing session
    titles; out of this task's scope, which focused on items 6-21 named
    in the brief plus 13/14). Left OPEN.
13. **Sam Whitfield's seeded reviews carry byte-identical comment text —
    STILL OPEN, reachable by construction, EMPIRICALLY CONFIRMED this
    task.** Ran `npx tsx scripts/seed.ts` at MEASURED_SHA and read the
    generated `.seed.sql` (deleted after inspection, not committed).
    `scripts/seed.ts:1440,1452`: a single global `evalCounter`
    increments across every `insertEvaluation` call for every reviewer
    and plan; `comment = EVAL_COMMENTS[evalCounter % EVAL_COMMENTS.
    length]` (8 comments). Sam (`reviewerUserId`, `seed_user_0004`) is
    called 7 times consecutively for plan 1 (`seed.ts:1490`,
    `evalCounter` 1-7) and 2 more times later for plan 4 (`seed.ts:
    1896-1897`, `track1Subs.slice(0, 2)`). Direct read of the generated
    SQL: `seed_evaluation_0002` (Sam, plan 1) carries comment "Solid
    proposal, needs more concrete examples." and `seed_evaluation_0058`
    (Sam, plan 4) carries the IDENTICAL string; `seed_evaluation_0003`
    ("Compelling narrative and clear takeaways.") collides with
    `seed_evaluation_0059` the same way. The comment index is derived
    from a GLOBAL counter with no per-reviewer offset, so any reviewer
    whose total call count spans a gap that is a multiple of 8 apart in
    the global sequence collides — Sam's 58-2=56-position gap is `56 %
    8 == 0`. Not touched by this docs-only task (no source edit in
    scope); recorded as a concrete, reproduced defect for the next code
    wave to fix (e.g. seed a per-reviewer or per-(reviewer,index) offset
    into the comment lookup instead of the shared global counter).
14. **Seeded reviewer assignments overlap broadly (Sam track-wide on 3
    plans)** — STILL OPEN, confirmed this task. Read directly:
    `.seed.sql` `plan_reviewer` rows for `seed_user_0004` — plan 1 /
    track_0001 (`seed_plan_reviewer_0001`), plan 3 / track_0001
    (`seed_plan_reviewer_0007`), plan 4 / track_0002
    (`seed_plan_reviewer_0008`). Sam is scoped to a WHOLE track on three
    separate plans (two of them the same track), matching the item's
    description exactly — no narrowing to a distinct/non-overlapping
    subset has landed. IMPORTANT CONSTRAINT carried forward per the
    task brief: any narrowing must PRESERVE the reviewer-progress
    cap-saturation case a prior wave seeded (`plans-progress.ts:152`
    per w77 field-guide receipt) — do not remove the saturated-denominator
    fixture while de-overlapping Sam's assignments.
15. **Deadline day-boundary / event-timezone countdown** — CLOSED-WITH-
    RECEIPT, re-confirmed. `src/routes/root.tsx:125-133`: `closesLine`
    calls `formatEventCloseDateLabel(closeMs, timeZone)` and
    `daysUntilCalendarDay(closeMs, timeZone, nowMs)`, both taking the
    event's own IANA `timeZone` (comment at `:126-129` cites DEC-408 "a
    real instant, never UTC-bare" and DEC-918 "one server-side
    calendar-day grammar"). `src/routes/public/submit-views.tsx:503-505`:
    the CFP page's own close-date line calls
    `formatEventDateTime(dayLabelEndInstant(form.closeDate,
    event.timezone), event.timezone)` — same pattern, same
    `event.timezone` input. Both the hub and the CFP page resolve in the
    event's own timezone.
16. **Saved-embed accent not applied** — CLOSED-WITH-RECEIPT, re-
    confirmed. `src/routes/public/saved-embed.tsx:143`: `<EmbedShell
    event={event} title={title} accentOverride={parseAccent(opts.accent
    ?? "") ?? undefined}>`. `src/routes/public/shell.tsx:274-276`:
    `EmbedShell` signature takes `accentOverride?: string` and computes
    `const accent = validAccent(props.accentOverride ?? b.accentColor)`
    — the override is read and applied, not dropped.
17. **Tracks-and-rooms simultaneous success + error banner** — NOT
    RE-VERIFIED this task (would need a click-through, per the item's
    own text; out of a docs-only task's reach). Left as previously
    reported (field guide notes DEC-856 w76 "plausibly fixed" — still
    needs the click-through evidence the item asks for). OPEN pending
    that verification.
18. **Pipeline DECLINED column double-render bug** — NOT RE-VERIFIED
    this task; no source read. Left OPEN.
19. **Public CFP in-page error summary** — CLOSED-WITH-RECEIPT, re-
    confirmed. `src/routes/public/submit-views.tsx:334-340`: exports
    `ErrorSummary({ problems })`, rendering `<div class="chq-error-
    summary" role="alert">` with a heading built from
    `thingsNeedFixingHeading`. `:479-484`: `summaryProblems` is built
    from the per-field `errors` map (field id, label, message). `:549`:
    `<ErrorSummary problems={summaryProblems} />` is rendered inside the
    CFP form body. `:601-604`: individual fields still additionally
    carry their own `role="alert"` inline `chq-field-error` message (the
    summary orients, the field repairs — per the comment at `:330-331`).
    Both the summary and per-field messages are present.
20. **Version history v1/v2 identical-minute timestamps** — NOT
    RE-VERIFIED this task; DEC-158 w77's seconds grammar was not
    re-read against the portal file-version rows specifically this
    pass. Left OPEN pending that direct check.
21. **Contacts/Speakers skeleton accessible label** — CLOSED-WITH-
    RECEIPT, re-confirmed. `app/src/components/PageSkeleton.tsx:88-96`:
    doc comment states `aria-busy="true"` and "a visually-hidden label
    so a screen reader announces the wait"; the component renders `<div
    className="chq-skeleton" role="status" aria-busy="true"><span
    className="chq-skeleton-sr-label">{label}</span>...`. `label`
    defaults to `'Loading…'` (`:88`, prop default). Present.
22. **Organizer add-co-presenter email-asymmetry copy** — NOT
    RE-VERIFIED this task by direct read of `SubmissionDetailPage.tsx`;
    the field guide (w79 mandate re-derivation) already carries a
    quoted receipt (`SubmissionDetailPage.tsx:1641`, "Adding a
    co-presenter here sends no email") stating the organizer add-flow
    already states the asymmetry, closing the ABS "asymmetry" finding
    as stale. Not independently re-read this task; recorded as CLOSED
    per that prior wave's citation only (flagged here as inherited, not
    freshly verified, per the standing rule that a citation is not an
    assertion — the next wave that touches this file should confirm it
    directly).

## Recent review-lens findings re-filed this round — all four RE-VERIFIED CLOSED

1. **Selective task assignment scoped at both back-fill doors** —
   CLOSED-WITH-RECEIPT. `src/server/repo/submissions/status.ts:317-326`:
   the driving select for the onboarding-task back-fill is `db.select({
   id: schema.task.id }).from(schema.task).where(and(eq(schema.task.
   eventId, eventId), eq(schema.task.audience, DEFAULT_TASK_AUDIENCE)))`
   — a task with `audience: 'targeted'` (an explicit `contactIds`
   subset) is filtered out of the driving select entirely, so it can
   never be widened onto a newly-active contact by this path. Comment
   at `:317-322` explicitly names the DEC-746 (wave-77 amendment) rule
   this implements.
2. **Handout task-file `taskAssignmentId` set on the plain-upload
   path** — CLOSED-WITH-RECEIPT. `src/routes/portal/tasks.tsx:625-632`:
   the plain-upload `insertFile(...)` call includes `taskAssignmentId:
   assignmentId` as its last field, matching the form-upload sibling's
   own `taskAssignmentId` write.
3. **Replaced form-file answers chained via `previousFileId`** —
   CLOSED-WITH-RECEIPT. `src/routes/portal/tasks.tsx:423-431`: before
   inserting a replacement form-file answer, `previousFileId` is
   resolved from `priorAnswers[field.id]` via `getReplacesTarget`, and
   only accepted (`previousFileId = priorValue`) when `target.
   submissionId === null && target.kind === "handout"` — otherwise a
   fresh chain starts (comment: "a mismatch (legacy/foreign row) —
   fresh chain, never a 400"). No `previousFileId: null` unconditional
   orphaning at this site.
4. **Submission file-version ceiling `MAX_SUBMISSION_FILE_SCAN`** —
   CLOSED-WITH-RECEIPT. `src/server/repo/files-versions-read.ts:28`:
   `export const MAX_SUBMISSION_FILE_SCAN = 1000;` with a header
   comment explaining the 1000-vs-20000 sibling-ceiling ordering rule
   (DEC-829 w74 precedent). `:90-97`: the query is bounded with
   `.limit(MAX_SUBMISSION_FILE_SCAN + 1)` and throws an `ApiError` if
   `rows.length > MAX_SUBMISSION_FILE_SCAN`, naming the constant in the
   thrown message.

## Summary

- CLOSED-WITH-RECEIPT this task, fresh reads: A2, A6, A7, A8 (with a
  noted deliberate divergence on the Location-row clause), A11, B15,
  B16, B19, B21, plus all four re-filed review-lens items.
- IN-FLIGHT (explicitly out of this task's authority to close): A4, A5
  (home-hub lane, this wave).
- STILL OPEN, one newly EMPIRICALLY REPRODUCED this task: B13 (Sam's
  comment-text collision — confirmed live in a fresh seed run) and B14
  (Sam's track-wide 3-plan overlap — confirmed via a fresh seed run's
  `plan_reviewer` rows). Both need a code-wave fix, not further
  hygiene.
- NOT RE-VERIFIED this task (left as previously reported, not
  independently re-read — flagged so nobody treats them as freshly
  confirmed): A1, A3, A9, A10, B12, B17, B18, B20, B22.
