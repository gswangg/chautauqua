# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never
  hand-edit). Invariants: fail loudly; status changes never auto-email;
  authz every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-33 (DEC-002..999, space FULL no DEC-1000+, rulings
  land as `## Amendment (wave N)` on nearest EXISTING DEC): pure-core no
  node:/cf; Hono sub-apps, errors {error:{code,message,fields?}}; bulk ops
  set-based; D1 PRIMITIVES; dates via event-time.ts; pagination ONE
  shape+count*+id asc; atomic SQL > read-then-write; uniqueIndex CONTRACT;
  MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; GUARD THAT NARROWS < NONE.
- FINDINGS w2-18 (all LANDED/SWEPT/DISMISSED, heavily compacted): DateField/
  search/CSV/compose/reviewer-scope/evaluation-lattice/date-grammar/error-
  vocab/locked-field caps unified to src/domain; write caps (distribute,
  addReviewers, saved-embed, compose-100); contact merge keepId; CSRF
  exemption; bulk-email dedupe; ENVELOPE_ALLOWLIST drift; DEC-340/346/967/317/
  902/989/890/603. DEC-119 wave-18: no worker lane boots a server; merge
  train's own full-suite+build is the measurement. Branch names REUSED across
  generations -- only refs + log tail are evidence. w69: SWARM REBOOTED at
  gate-7. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A HANDOFF THAT DROPS
  THE SELECTION ASKS THE SAME QUESTION TWICE. A KNOB TABLE THAT DRIFTS BY
  COMMENT IS PROSE, NOT A CONTRACT. A LINE NUMBER IS NOT AN IDENTITY. TWO
  UNWIDTHED COLUMNS MEANS THE LAST ONE EATS THE MEASURE.
- TOOL TRAP: Grep -C drops some `/` chars (e.g. `//` -> `/`). NEVER file a
  defect off a Grep excerpt alone; Read exact lines first.
- FINDINGS w16-e-spec-audit: SPEC IS CLOSED, J1-J12+§5+§6 all GREEN. Remaining
  work is FRAME FIDELITY ONLY vs docs/design/*.dc.html.
- FINDINGS w19 (main at 4522f480, space CLOSED, amendments on nearest DEC):
  DEC-830 participation menu = pack's 420px 3-band panel; DEC-930 speaker-
  detail 1fr/320px grid; DEC-785 saved-embed editor = ONE boxed readout;
  DEC-874 reviewer hub = desktop 4-col grid (not phone data block); DEC-730
  task-column head 12px/700 + fixed 230px track; DEC-993 select caret own
  element. Shapes: A COMPONENT DRAWN FROM THE PHONE FRAME'S DATA BLOCK IS
  PHONE ANATOMY AT DESKTOP. THE ROW THAT SENDS MUST STATE ITS CONSEQUENCE.
  TWO STACKED READOUTS ARE A MECHANISM, ONE BOX IS A CONTROL. A RULING WITH
  NO SCAN DRIFTS BACK.
- FINDINGS w20 (main MOVING mid-plan: task-w19-a gained a commit BETWEEN reads,
  content.css already held w18-d's fix while reflog still ended at "merge
  task-w18-c" — IN FLIGHT is a snapshot, never a fact). Owned, no re-file:
  w18-b/-d/-e/-f/-g/-h, w19-a/-b/-c/-d/-e. Diffed unowned frames, found FOUR
  live gaps landed as amendments: (1) src/mail/shell.ts:16-22 OFF-PALETTE
  literals — its "literals licensed" comment covers email clients not
  resolving var(), NOT arbitrary colours; palette-conformance.test.ts never
  scoped src/mail (DEC-037 w20). (2)+(3) .chq-submissions-table /
  .chq-contacts-table auto-layout with ZERO widths, same defect w18-d fixed
  for files library, frames give exact tracks (DEC-902 w20). (4) ExportsPanel
  gates downloads behind local "Change" (B10: exports are actions) and
  Public-pages section lacks the frame's consequence caption (DEC-032/896
  w20). CLOSED on re-verification, do not re-file: form-roles.ts eventId
  scope (DEC-592 dismissal), tasks.ts 400s (DEC-340), compose step-2
  (DEC-317), compose default=accepted alone (code right, name misleading),
  sessionboard pairKey.slice, password reset/logout/demo/email-sweep/B7/
  A15/A22/A26/speaker double-booking/embed-200/self-hosted-fonts all BUILT.
  Shapes: AN EXEMPTION FOR LITERALS IS NOT AN EXEMPTION FOR THE PALETTE. A
  TABLE WITH NO WIDTHS STILL HAS ONE COLUMN THAT EATS THE REST. A GATE OVER
  AN ACTION IS A GATE OVER NOTHING. A FRAME CHANNEL WITH NO PRODUCER IS DEAD
  CODE, NOT A GAP.
