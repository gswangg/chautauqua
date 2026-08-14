# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks,
  §2 principles). docs/ precedence: clarifications.md overrides all;
  decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-
  edit). House invariants: fail loudly; status changes never auto-email; authz
  every route, server-side visibility.
- STAGE1-16 + FINDINGS w1-31 (DEC-002..982, heavily compacted): pure-core
  imports no node:/cf; Hono sub-apps, errors {error:{code,message,fields?}};
  bulk ops set-based; D1 binds PRIMITIVES; dates via event-time.ts OWNING
  EVENT's tz; pagination ONE shape+count*+`id asc`; atomic SQL beats
  read-then-write; uniqueIndex CONTRACT; negation skips NULLs; irreversible
  action a PAGE naming what goes AND what it refuses; decision with no code
  a LIE; submitted blank CLEARS, absent key is silence; a JOIN row cascades
  on contact delete.
- FINDINGS w32-63 (DEC-983..999, 001-999 FULL no DEC-1000+, `## Amendment
  (wave N)` on nearest existing DEC, heavily compacted): grep "no matches"
  is a fact about that minute only. DECISION DOC != FIX; MINTING IS IO;
  boundary fails per RECIPIENT never REQUEST; batch the FRONTIER not
  query-per-link; FIND-OR-CREATE NEEDS A UNIQUE INDEX; UNBOUNDED SURFACE
  NEVER PAGED; A WATERMARK ONLY SEES THE COLUMN IT COMPARES -- PARENT ROW
  IS THE SYNC UNIT; NAV != ROUTE.
- FINDINGS w66-72 (compacted): MANDATE SPENT re-probed CLOSED at file:line;
  A FACET IS A CONTRACT; A CONTROL WITHOUT ITS SCRIPT/SAVE IS A PICTURE OR
  A LIE; A PROJECTION MUST CARRY ITS SOURCE'S LIMITS AND VOCABULARY; A
  HARDCODED SURFACE LIST GOES STALE; ONE SERIALIZER FOLDS, SWEEP EVERY
  SIBLING; A DISCLOSURE IS NOT A DELETION; A FRAMED PRIMARY WITH NOTHING
  TO WRITE IS A LIE -- one writer, two screens.
- FINDINGS w1-6 (heavily compacted; DEC space FULL): RE-PROBE THE MANDATE
  BEFORE SPENDING A LANE; A DECISION DOC IS NOT A BRANCH (grep `##
  Amendment (wave N)` first, implement verbatim); THE PAIR REPORTS OUTLIVE
  THE MANDATE; A FRAME NIT CAN CONTRADICT A LANDED DECISION -- grep
  decisions/ first; A FRAME "EXTRA" IS USUALLY A CAPABILITY -- restyle/
  disclose, never delete; A COMMENT CLAIMING A CHECK IS NOT THE CHECK; A
  MIRROR MUST COPY THE ROLLBACK not just the ordering; A REVIEW LENS CAN
  BE WRONG ON PURPOSE (demo-credential "leak", DEC-583) -- record refusals
  so they aren't re-filed.
- FINDINGS w7 (compacted): ~30 residue clauses re-probed, six survived. A
  READER WITH NO WRITER IS A LIE THAT RENDERS NOTHING -- grep `unwired|no
  server route|documented gap`. A STALE EXCUSE OUTLIVES ITS CAUSE. ONE
  FORMATTER, TWO GRAMMARS. A CHROME LABEL CAN BE ROLE-SCOPED. REFUSALS
  RECORDED: aria-pressed (DEC-939), "Mean of submitted reviews" (DEC-873),
  roster Import-CSV link (DEC-662, kept).
- FINDINGS w8 (compacted): ~25 gate-4/run-4 clauses re-probed at
  file:line, ALL CLOSED; four survived. A SECOND READER OF THE SAME WRITE
  INHERITS NONE OF ITS MANNERS: NewContactModal grew the 409 forward path
  (DEC-788) while RosterPanel's Add-speaker, hitting the SAME /contacts,
  still prints the refusal and stops -- grep EVERY caller of a route
  before calling its error handling done. A DELAY POLICY IS NOT A LOADING
  POLICY: DelayedLoading's 250ms withholding is right for a sub-region,
  wrong for a page; ten page-level waits, incl. App.tsx's RoleGate +
  Suspense every route pays, drew nav over an empty main -- use
  PageSkeleton for MAIN-region waits. A GUESSABLE URL THAT 404s IS A DEAD
  END (/logout had only POST, pubcache already named it GET-safe). A
  RECEIPT STATES WHAT WAS RECEIVED: CFP confirmation named the title,
  dropped the track/format just chosen. DEC space closed -- rulings land
  as `## Amendment (wave N)` on the EXISTING file at that id.
