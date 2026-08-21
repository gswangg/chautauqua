# Portal · Edit your session — 390 fidelity audit (w31-h)

Frames: docs/design/Chautauqua Public and Portal.dc.html:600-674 ("Portal ·
Edit your session") and :1304-1367 ("Portal · co-presenter rejected").
Both render from src/routes/portal/edit.tsx.

Verdicts below are `app.request()` verdicts (DEC-976 SSR clause), not a
text/CSS scan — real GET /portal/submissions/s1/edit and a real duplicate-
email POST /portal/submissions/s1/participants, asserted against the
response HTML by `test/portal-edit-390-frames.test.ts`.

## Verdict: MATCHES (no fix required to edit.tsx)

Both frames' full drawn-literal set already renders exactly as drawn, in
drawn order. Specifically verified:

- The 44px `‹ Your session` back link (:602) precedes the `Edit your
  session` H1 (:603), which precedes the close-date sub-line (:604, graded
  by SHAPE — the date itself is composed from `form.closeDate`/`timezone`
  via `dayLabelEndInstant`, never a fixed frame literal, per DEC-522).
- The `On this session · <n>` section rule (:624) is a live label + a real
  participant count, not the frame's sample digit.
- Participant rows (`{{ p.name }}` / `{{ p.role }}` / `{{ p.note }}`,
  :628-631) render by SHAPE from `getPortalParticipants`.
- The co-presenter add row's caption (:640) — "Adding them puts a row in
  the list above straight away. No email goes to them — tell them
  yourself, and your organiser decides when co-presenters appear on the
  public site." — is the app's own truthful sentence, asserted verbatim.
- DEC-029's structural guarantee holds: every co-presenter control
  (`cp-first-name`, `cp-last-name`, `cp-email`, `cp-role`) carries
  `form="chq-portal-edit-form"`, and the "Add co-presenter" button (:664)
  is a `formaction`/`formenctype` SECOND SUBMIT of that one form —
  `formaction="/portal/submissions/:id/participants"
  formenctype="multipart/form-data"` — never a second `<form>`. This is
  what makes in-progress title/abstract/track edits survive both a
  successful add and a refusal: verified directly by POSTing a live
  `field__first_name` edit alongside a duplicate-email co-presenter
  submission and finding that edit echoed back on the 400 re-render (see
  below), not discarded.
- The phone dock (:667-672) orders `Save changes` before `Cancel`, then
  the consequence note below the pair, inside `.chq-portal-edit-dock` (the
  fixed footer slot, not the in-flow `.chq-portal-actions-footer` copy —
  that ownership is portal.css.ts's, out of scope for this task, pinned
  read-only below).

### Co-presenter-rejected refusal state (:1304-1367)

POSTing a duplicate email produces the DEC-029 three-part refusal
disclosure at **400**, not a redirect:

1. The callout headed `Nobody was added` (:1313) whose body names WHO is
   already on the session and states everything typed is still below —
   `Priya Raman is already on this session. Everything you typed is still
   below.` (:1314) — the matched participant's own name
   (`ParticipantsSection`'s `duplicateMatch`), never a generic "This
   person".
2. The email field marked at its own left edge:
   `.chq-portal-copresenter-email-flagged` on `#cp-email` (the class
   portal.css.ts paints `border-left: 3px solid var(--chq-ink)` on — see
   the read-only pin below).
3. The field-level sentence beneath it — "This person is already a
   participant on this submission" — is the server's real
   `CO_PRESENTER_DUPLICATE_MESSAGE`, routed through the ordinary
   `errors.email` field-error slot, never a second synthesized string.

The edit-dock band (`Save changes` / `Cancel`, :1362-1363) is present
unchanged on the refusal re-render, same as the plain edit frame.

No code change was needed in src/routes/portal/edit.tsx — the file
already implements every literal and structural fact both frames draw.
`DEC_029` is imported and compile-checked (`void DEC_029;`,
src/routes/portal/edit.tsx:52) alongside the file's other six DEC
dependencies.

## Companion half: portal.css.ts terminal phone block (read-only pin)

Per this task's HARD BAN, portal.css.ts is not edited — pinned here by
source text only. The sheet has exactly one terminal
`@media (max-width: 700px)` block, opening at line 795 and closing at line
1216 (immediately followed by the sheet's `${ERROR_STATES_PHONE_CSS}`
splice on line 1217) — every phone-only rule this task's frames depend on
lives inside that one block, appended in place per DEC-385 append-only:

- `.chq-portal-copresenter-email-flagged { border-left: 3px solid
  var(--chq-ink); }` — the refusal frame's left-edge mark (part 2 above).
- `.chq-portal-copresenter-email-flagged { min-height: 44px; display:
  flex; align-items: center; padding: 0 12px; }` — the same class's DEC-393
  44px-floor pair (a second declaration block for the same selector,
  deliberately not merged with the border-left rule above so each
  citation's exact substring keeps resolving, per this sheet's own
  DEC-967 convention).
- `.chq-portal-copresenter-names { display: grid; grid-template-columns:
  1fr 1fr; gap: 10px; }` — :1335's two-up phone override.
- `.chq-portal-edit-dock { display: flex; flex-direction: column; gap:
  8px; flex: 1; }` and `.chq-portal-edit-dock-buttons { display: flex;
  gap: 8px; }` — the dock band both frames' :667-672/:1360-1365 draw.

## Unfixable findings

None. Both frames verify MATCHES end to end; no DIVERGES row is filed.
