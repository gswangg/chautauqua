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
- FINDINGS w2-19 (heavily compacted): DateField/search/CSV/compose/reviewer-
  scope/error-vocab/locked-field caps unified; write caps, contact merge,
  CSRF exemption, bulk-email dedupe; DEC-340/346/967/317/902/989/890/603/
  830/930/785/874/730/993. TOOL TRAP: Grep -C drops some `/`. SPEC CLOSED,
  J1-J12+§5+§6 GREEN. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A LINE
  NUMBER IS NOT AN IDENTITY. A COMPONENT DRAWN FROM THE PHONE FRAME'S DATA
  BLOCK IS PHONE ANATOMY AT DESKTOP. A RULING WITH NO SCAN DRIFTS BACK.
- FINDINGS w20-22 (compacted): `.chq-table` had no table-layout; fixed
  w18-d/w20-b/-c/w21 across files-library, submissions, contacts, compose
  step-1, review, content worklist (DEC-902); tokens/queue-row/edit-row
  added w22. Also: mail-shell literals (DEC-037); exports/public gate+
  caption (DEC-032/896); FITTED SUB-PIXEL GEOMETRY (DEC-369, fractional
  padding chasing a superseded fleet measurement); row grid replacing a
  table must keep table semantics (DEC-930). Shapes: A SHARED VOCABULARY
  CLASS IS NOT A WIDTH HOOK. A FRAME TRACK LIST IS A CONTRACT, A CSS
  COMMENT ABOUT IT IS NOT. A FRACTION IS THE SIGNATURE OF A FIT. A
  CITATION IS NOT A TRANSCRIPTION. A REF LIST IS A SNAPSHOT.
- FINDINGS w23 (read from main, not inherited): tree MOVED MID-PLAN —
  settings.css shifted 8 lines as w22-b merged; task-w22-f has NO ref. A
  REF LIST IS A SNAPSHOT even within one session; re-read the rule.
- Unwidthed-table family CLOSED at four remaining members (w23):
  `.chq-comms-templates-table`, `.chq-contacts-import-review-table`,
  `.chq-settings-exports-table`, `.chq-settings-sessionboard-mapping`.
  Full inventory 14 classes/16 sites; two idioms only (DEC-902 w23):
  fixed-layout + one remainder, or shared row-grid (`.chq-participants-
  table`). Exemptions are REASONS, not allowlists: data-driven column
  count (speakers matrix), phone reflow block.
- New defect class: A BLEED THAT CANCELS ONE PADDING BUT NOT THE CLAMP
  (DEC-989 w23). content.css:677 negates `--chq-pub-main-pad-x` while the
  1180 clamp sits on the page root, so the band stops (main-1180)/2 short.
  The frame draws chrome as a SIBLING of the measure container. Shape: FULL
  BLEED IS A POSITION, NOT A MARGIN — move the measure to a `-page-content`
  sibling; never vw/cqw, never an inner wrapper beside a clamped root.
- A CITATION MUST QUOTE (DEC-976 w23): `*.dc.html:<line>` refs now carry
  the cited literal in backticks, scanned against the frame file. Two
  comments asserted false facts about other files. A COMMENT ABOUT
  ANOTHER FILE IS A CLAIM WITH NO GUARD.
- Dead phone labels (DEC-937 w23): templates cells emit `data-label` no
  rule consumes; review.css:317's `td::before` unguarded. Always
  `td[data-label]::before`; action cells carry no label.
- Swept and CLOSED this wave, do not re-file: prefetch-on-hover, export row
  caps, cron fan-out, smart placement, public Cache-Control/SWR, headshot
  serve headers, mail shell 560, Insert-a-field dropdown, participants
  table tracks (`1fr 150px 210px auto`), distribute preview/apply parity,
  active-filter chips, upload-reject modal, write-failed banner, Delete
  plan footer, public agenda 88px/228px auto-fit.
