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
  never sample; pagination ONE shape `page?:{limit,offset}`+count*+`id asc`;
  a cap the UI can't see LIES, render `total`; atomic SQL beats
  read-then-write; event-clock strings carry their event's tz; hand-listed
  manifests desync -- enumerate in a test; date-only field is a DAY
  LABEL; conditional visibility is a FIXED POINT; offset-paged ORDER BY
  ends in a unique column; hand-copied vocabularies drift -- IMPORT
  them; a helper with zero src callers tests NOTHING; a uniqueIndex is a
  CONTRACT -- sweep every SELECT-then-INSERT; a cron has no request --
  own origin entry point that THROWS; a `position`/`order` column
  nobody sets on create is dead -- assign max+1 INSIDE the insert; a
  nullable column inside a NEGATED set predicate (NOT IN / !=) silently
  skips NULL rows; two functions claiming "the same semantics" END in
  the same helper; a completion count taken OUTSIDE the assigned set can
  exceed its denominator.
- FINDINGS ROUND w1 (DEC-570..580, compacted): full suites SERIALIZED via
  scripts/with-test-lock.sh, workers run TARGETED tests only. A `div
  draggable` is invisible to the a11y tree -- use a real <button>. A card
  with `height:100%` and no `overflow` bleeds into the next row. Colour
  alone may not carry track identity -- NAME it in type. A fan-out with
  no count is a cap the UI can't see: preview/queue END in one predicate
  builder. A comment thread belongs to the version CHAIN, not a file
  row. An upload that navigates DISCARDS the form; a blank CSV cell is
  ABSENT DATA, never delete. `flex:1; min-height:0; overflow-y:auto`
  beats guessed bottom padding under a fixed bar. A drill-in must
  resolve its own subject; a fidelity report is an OBSERVATION, not spec.
- FINDINGS ROUND w2 (DEC-581..590): verify before you trust -- w2 was
  planned against a tree where w1 had NOT landed; read main. GET / is an
  ANONYMOUS hub: signed-in visitors redirect by role, and what a
  stranger may read is a PURE predicate (src/lib/home-hub.ts), never a
  WHERE clause -- would you mind a competitor reading it? Credentials
  copied by hand drift -- IMPORT them, assert against the fixture; a
  password renders only when those exact seeded accounts exist. SSR
  can't know the viewport, so a phone layout is a SECOND markup switched
  with display:none (visibility/opacity leave it in the a11y tree) --
  duplicated inputs sharing a value must MIRROR each other or unchecking
  silently fails. One shared stylesheet per layer: THEME_CSS owns bare
  control selectors for every SSR surface (DEC-585) as app/src/styles.css
  does for the SPA (DEC-577); a surface module styles .chq-* only. A
  picker between a person and their work is an administrative noun -- a
  reviewer lands on the queue. A ratio whose numerator/denominator count
  different KINDS of thing is a sentence that cannot be true. A branch
  comparing against a copied-wrong vocabulary never fires and prints the
  raw enum -- import the label from whoever owns the vocabulary.
