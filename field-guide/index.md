# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 012/013 route files export Hono
  sub-apps, errors {error:{code,message,fields?}}; bulk ops set-based.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, ONE
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms NUMBER);
  dates via event-time.ts OWNING EVENT's tz never toISOString; public
  lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-38 (DEC-420..569, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from ENUMERATION
  never sample; pagination ONE shape+count*+`id asc`; a cap the UI can't
  see LIES, render `total`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- enumerate in a test; conditional visibility is a
  FIXED POINT; hand-copied vocabularies drift -- IMPORT them; a
  uniqueIndex is a CONTRACT; a `position` column nobody sets is dead --
  assign max+1 INSIDE the insert; a negated predicate skips NULLs; "same
  semantics" claims END in the same helper.
- FINDINGS w1-6 (DEC-570..630, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; fan-out with no count is a hidden cap; blank CSV cell is ABSENT
  DATA; SSR phone layout is a SECOND markup via display:none; seed has
  ONE clock -- SEED_NOW; a file id in a URL is never proof of ownership
  -- walk it to root; an imported row keeps THEIR id -- one namespaced
  `external_ref` per owner scope; dry/real run are ONE planner, counts
  PLANNED never sampled; a drawer is a RECORD: facts, history, action
  bar; an audit is enumerated by a test or it drifts; two readings END in
  one resolver, withheld cell '(anonymized)' never blank; anonymity is a
  RATCHET, never revocable; cache purge is a closed two-list (/e/*,
  /embed/*); merge takes a SET; a phone selector's rule is display:none
  or absent.
- FINDINGS w7-8 (DEC-631..647, compacted): a confirmation is a DIALOG,
  not window.confirm. A row showing a decision must CARRY it. A filter
  applied AFTER the page window lies twice -- items+total from ONE where
  clause. /api/v1 gets the envelope, a human gets a page. Framing is a
  closed two-list -- /embed/* frames, else DENIES. API refs enumerate
  from app.routes or drift; re-grep before concluding something's
  missing. A join row's identity is the PAIR its uniqueIndex names. An
  imported speaker carries the DEC-258 attribution SNAPSHOT or renders
  nameless. A claim of ABSENCE is testable; understating an audit is as
  wrong as overstating. A type FLOOR can't see a 600 that should be 700.
  Scale is a profile at BOTH ends of the pipe; seeded lateness is demo
  COPY matching the mock. A closed two-list is closed in BOTH directions.
- FINDINGS w9 (DEC-648..654): a disclosure you OPEN to learn which view
  you're in is state the screen refuses to show -- tabs visible, ACTIVE
  from live filters never a click. An export is the same WHERE clause as
  the list beside it or the file lies -- one exported condition builder
  for both readers. A raw id in the UI is a handle leaking -- a condition
  renders LABELS. A dialog is a frame: title, Close, primary FIRST, mock
  placeholder in every free-text control -- scanned, not remembered. A
  worklist row carries the action, not a link to it: "Place at 11:30"
  from the SAME placer, never an invented time. Two upload vocabularies
  had diverged (8 MB vs 25 MB for .md) -- delete the mirror, import the
  pure core. A scale bar is a timed check exiting non-zero.
