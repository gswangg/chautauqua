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
- FINDINGS w2-13 (all LANDED/SWEPT, heavily compacted): DateField/search, caps
  unified to src/domain, logout, CSV dup, compose step-4, canEditSubmission,
  reviewer scope null->LIST, evaluation lattice, date grammars, error
  vocabulary (V9), locked-field/minutes/score/clock single sources,
  session-card/history-pager/edit-lock/icsChip/trackIds/plan-window/
  saved-view caps, .ics SEQUENCE, write caps (distribute, addReviewers,
  saved-embed, compose-100), contact merge keepId, CSRF exemption,
  audienceLevel/role PATCH. w69: SWARM REBOOTED at gate-7. Shapes: A CAP ONLY
  IN THE SPA IS A SUGGESTION. A HANDOFF THAT DROPS THE SELECTION ASKS THE
  SAME QUESTION TWICE. A FAN-OUT WITH NO PRE-WRITE CAP IS A HALF-WRITE. A
  KNOB TABLE THAT DRIFTS BY COMMENT IS PROSE, NOT A CONTRACT.
- TOOL TRAP: Grep -C drops some `/` chars (e.g. `//` -> `/`). NEVER file a
  defect off a Grep excerpt alone; Read exact lines first.
- FINDINGS w14-18 (all LANDED/DISMISSED, compacted): bulk-email dedupe, breaks
  accumulation, onConflictDoNothing, mail envelope, trackIds dedupe, reviewer
  plan-window/file authz, saved-view cap, ENVELOPE_ALLOWLIST path:line drift,
  DEC-340 filter-token 400, DEC-346 scope parity, DEC-967 compose default,
  DEC-317 wizard-level ics banner, DEC-902 files-library fixed layout,
  DEC-989 Content measure class, DEC-890 Templates row/Delete split, DEC-603
  History export link. DEC-119 wave-18 amendment: no worker lane boots a
  server; merge train's own full-suite+build is the measurement. Branch
  names REUSED across generations -- only refs + log tail are evidence.
  Shapes: A CAP AT TWO OF FOUR DOORS IS A SUGGESTION. A LINE NUMBER IS NOT
  AN IDENTITY. A REFUSAL THAT RENDERS ON A STEP YOU CANNOT REACH IS A DEAD
  END. TWO UNWIDTHED COLUMNS MEANS THE LAST ONE EATS THE MEASURE.
- FINDINGS w16-e-spec-audit: SPEC IS CLOSED, J1-J12+§5+§6 all GREEN (4 MAX_
  PARTICIPANTS doors, email-log/exports 400s, content-notes changes_requested
  send). Remaining work is FRAME FIDELITY ONLY vs docs/design/*.dc.html.
- FINDINGS w19 (main at 4522f480; w18-b/-c had NO commits, still = main).
  Found 5 live frame-vs-CSS gaps by diffing docs/design/*.dc.html directly
  (not inherited reports), landed as amendments on nearest DEC (space
  CLOSED): DEC-830 participation menu is the pack's 420px 3-band panel, not
  an event-switcher dropdown; DEC-930 speaker-detail 1fr/320px gap-34 grid +
  row-grids (drop table theads); DEC-785 saved-embed editor = ONE boxed
  snippet readout, Copy+Preview in one action row (Copy URL survives as
  tertiary link); DEC-874 reviewer "Your plans" hub = desktop 4-col grid
  w/ header row (build had drawn it from the PHONE renderVals data block,
  frame :925-939, not the 820 hub at :743); DEC-730 task-column head is
  12px/700 (not 15px) + identity column fixed 230px track; DEC-993 select
  caret is its own right-edge element (InsertFieldMenu/ParticipationMenu
  still emit bare glyph), leading disclosure toggles (▾/▸ before label)
  named-exempted. Shapes: A COMPONENT DRAWN FROM THE PHONE FRAME'S DATA
  BLOCK IS PHONE ANATOMY AT DESKTOP. THE ROW THAT SENDS MUST STATE ITS
  CONSEQUENCE. TWO STACKED READOUTS ARE A MECHANISM, ONE BOX IS A CONTROL.
  A RULING WITH NO SCAN DRIFTS BACK.
