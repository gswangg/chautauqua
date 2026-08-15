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
  search/CSV/compose/reviewer-scope/error-vocab/locked-field caps unified to
  src/domain; write caps, contact merge keepId, CSRF exemption, bulk-email
  dedupe; DEC-340/346/967/317/902/989/890/603. DEC-119 w18: no worker lane
  boots a server, merge train's full-suite+build is the measurement. Branch
  names REUSED across generations. w69: SWARM REBOOTED at gate-7. Shapes: A
  CAP ONLY IN THE SPA IS A SUGGESTION. A LINE NUMBER IS NOT AN IDENTITY. TWO
  UNWIDTHED COLUMNS MEANS THE LAST ONE EATS THE MEASURE.
- TOOL TRAP: Grep -C drops some `/` chars (e.g. `//` -> `/`). Read exact
  lines before filing a defect. SPEC CLOSED, J1-J12+§5+§6 GREEN (w16-e);
  remaining work is FRAME FIDELITY vs docs/design/*.dc.html.
- FINDINGS w19 (main 4522f480): DEC-830 participation menu 420px 3-band;
  DEC-930 speaker-detail 1fr/320px grid; DEC-785 saved-embed ONE boxed
  readout; DEC-874 reviewer hub desktop 4-col grid; DEC-730 task-column
  fixed 230px; DEC-993 select caret own element. Shapes: A COMPONENT DRAWN
  FROM THE PHONE FRAME'S DATA BLOCK IS PHONE ANATOMY AT DESKTOP. A RULING
  WITH NO SCAN DRIFTS BACK.
- FINDINGS w20 (IN FLIGHT is a snapshot, never a fact — refs move mid-plan).
  Landed as amendments: src/mail/shell.ts OFF-PALETTE literals, not exempt
  (DEC-037); .chq-submissions-table/.chq-contacts-table zero-width tables
  (DEC-902 w20); ExportsPanel gate-over-nothing, public-pages missing
  caption (DEC-032/896). Re-verified CLOSED, do not re-file: eventId scope,
  tasks.ts 400s, compose step-2/default, sessionboard pairKey, auth/email
  sweeps, B7/A15/A22/A26/double-booking/embed-200/self-hosted-fonts BUILT.
  Shapes: AN EXEMPTION FOR LITERALS IS NOT AN EXEMPTION FOR THE PALETTE. A
  TABLE WITH NO WIDTHS STILL HAS ONE COLUMN THAT EATS THE REST. A GATE OVER
  AN ACTION IS A GATE OVER NOTHING.
- FINDINGS w21 (main 7cf384fb "scribe wave 20"; w18-a..h + w19-a/-b/-c/-e ALL
  MERGED — the w20 note's "eleven unmerged branches" is stale). IN FLIGHT, no
  re-file: w19-d (reviewer hub 4-col), w20-a (mail shell), w20-b/-c
  (submissions/contacts tables), w20-d (exports/public-pages; ref==main,
  owned anyway). Re-verified CLOSED, do not re-file: isSubmissionInReview-
  erScope capped (w18-b); focus-ring/no-red/hex-literal guards cover
  app/src/pages/**.css and src/routes/**.css.ts (src/mail is w20-a's); B10
  lines, A9/A10/A18/A19/A20/B5/B7, agenda highlight, compose step-4, content
  status-band bleed all BUILT.
- The wave-20 defect class has more members than w20 counted: `.chq-table`
  (styles.css:652) declares NO table-layout, so EVERY admin table is
  auto-layout until its page sheet pins it. Only files-library (w18-d) and
  w20-b/-c's two are pinned. w21 pins compose step-1, review results and the
  content worklist (DEC-902 w21). Shapes: A SHARED VOCABULARY CLASS IS NOT A
  WIDTH HOOK (`.chq-content-table` is worn by BOTH content tables — hang
  widths off a table-specific class or you restyle the neighbour). AN
  EXPANDED BAND WITH ITS OWN GRID IS A SECOND TABLE (DEC-751 w21). A FRAME
  TRACK LIST IS A CONTRACT, A CSS COMMENT ABOUT IT IS NOT (review.css's
  criteria comment explains a drag column it then sizes `auto`).
