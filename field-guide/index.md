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
- FINDINGS w2-19 (all LANDED/SWEPT/DISMISSED, heavily compacted): DateField/
  search/CSV/compose/reviewer-scope/error-vocab/locked-field caps unified;
  write caps, contact merge, CSRF exemption, bulk-email dedupe;
  DEC-340/346/967/317/902/989/890/603/830/930/785/874/730/993. TOOL TRAP:
  Grep -C drops some `/` (e.g. `//`->`/`) — read exact lines. SPEC CLOSED,
  J1-J12+§5+§6 GREEN; remaining work is FRAME FIDELITY vs docs/design/*.dc.
  html. Shapes: A CAP ONLY IN THE SPA IS A SUGGESTION. A LINE NUMBER IS NOT
  AN IDENTITY. A COMPONENT DRAWN FROM THE PHONE FRAME'S DATA BLOCK IS PHONE
  ANATOMY AT DESKTOP. A RULING WITH NO SCAN DRIFTS BACK.
- FINDINGS w20-21 (compacted): `.chq-table` (styles.css:652) has NO
  table-layout — every admin table is auto-layout until its page sheet pins
  it; fixed by w18-d/w20-b/-c/w21 across files-library, submissions,
  contacts, compose step-1, review results, content worklist (DEC-902).
  Also landed: mail-shell off-palette literals (DEC-037); exports/public-
  pages gate+caption (DEC-032/896). Shapes: A SHARED VOCABULARY CLASS IS NOT
  A WIDTH HOOK (`.chq-content-table` worn by two tables). AN EXPANDED BAND
  WITH ITS OWN GRID IS A SECOND TABLE. A FRAME TRACK LIST IS A CONTRACT, A
  CSS COMMENT ABOUT IT IS NOT. AN EXEMPTION FOR LITERALS IS NOT AN EXEMPTION
  FOR THE PALETTE. A GATE OVER AN ACTION IS A GATE OVER NOTHING.
- FINDINGS w22 (verified by reading main, not inherited): w20-b/-c and
  w21-a/-b/-c/-d/-e ALL LANDED (styles.css:1142, submissions.css:203,
  comms.css:843, content.css:848, review.css:181/1107, cards.css.ts:149) —
  a "just planned" handoff was stale within the wave. A REF LIST IS A
  SNAPSHOT; A RULE IN THE STYLESHEET IS A FACT.
- New defect class: FITTED SUB-PIXEL GEOMETRY (DEC-369 w22). styles.css:
  201/267 shave the frames' `padding:15px 34px`/`gap:15px` to 10.65/
  10.625px to hit a superseded fleet measurement. Same method in
  overview.css/agenda.css/auth.css.ts. Shapes: A FRACTION IS THE SIGNATURE
  OF A FIT. WHEN CONTENT IS TALLER THAN THE FRAME, FIX THE CONTENT — THE
  BOX IS DECLARED. A TEST THAT PINS A FITTED VALUE IS ON THE WRONG SIDE OF
  THE STANDING RULE.
- More unwidthed-column members (w22): `.chq-settings-tokens-table` (FIVE
  unwidthed cols) and `.chq-review-queue-row` (`1fr auto` vs frame `1fr
  176px`). `.chq-settings-edit-row` is ONE class over TWO column counts
  (tracks vs rooms) — the `.chq-content-table` shape again. w21-e's landed
  criteria rule cites frame lines 132/62 but declares 150/70 — A CITATION IS
  NOT A TRANSCRIPTION, re-read the cited line.
- A ROW GRID THAT REPLACED A TABLE MUST CARRY THE TABLE'S SEMANTICS
  (DEC-930 w22): speaker-detail dropped `<table>` with no role=table/row/
  cell; PeopleRolesPanel has an orphaned role="row" outside any table.
  Asserting the ABSENCE of `<thead>` is not an a11y test.
- Re-verified CLOSED, do not re-file: tasks.ts 400s; isSubmissionInReview-
  erScope capped; public sessions-list byline gated (sessions.ts:419);
  /logout POST+redirect; password reset; content-note emails; compose
  step-3 partial send; portal 560; Home hub. DISMISSED: isSlugTaken without
  orgId (slug globally unique + public, no oracle).
