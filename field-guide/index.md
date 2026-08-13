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
  dates via event-time.ts OWNING EVENT's tz never toISOString.
- STAGE1-CLOSE w11-38 (DEC-420..569, compacted): ledger names its sha; ONE
  email rule via findAccountUserId; universal rows graded from
  ENUMERATION never sample; pagination ONE shape+count*+`id asc`; a cap
  the UI can't see LIES, render `total`; atomic SQL beats read-then-write;
  hand-listed manifests desync -- enumerate; conditional visibility is a
  FIXED POINT; hand-copied vocabularies drift -- IMPORT them; uniqueIndex
  is a CONTRACT; negation skips NULLs.
- FINDINGS w1-20 (DEC-570..743, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour isn't identity -- NAME it; blank
  CSV cell ABSENT DATA; anonymity a RATCHET; merge takes a SET; raw id
  leaks -- render LABELS; cacheability DEFAULT + "own header wins";
  irreversible action is a PAGE; hub gives a row ONE action; grid cells
  POSITIONAL; person named by CONTACT; tab selection URL state; column
  with side effects has ONE writer; sandboxed child's origin IS "null";
  tiers are a PREDICATE over the tree; publish is the WINDOW not a flag;
  a recorded decision with no code is a LIE; seed must satisfy every
  read it enables -- assert by enumeration.
- FINDINGS w21-23 (DEC-744..771, compacted): envelope KEYS fixed by
  route not branch content. Seeded reviewer NAMED (user.contact_id).
  ONE measure token. Chrome fidelity never deletes a capability. Task
  creation always expands (no unassigned state). Merge shows EVERY
  differing field; roster and expand-set are ONE predicate; contact
  identity is (org, lower(email)); author is a PERSON never "Unknown".
  Rows grow, not scroll. Position re-derives from URL, never router
  state. Grep the route before re-tasking -- mandate is a hypothesis
  until the tree agrees. `participant` is the ONLY contact-to-event
  link. Failure is a STATUS not an absence. While armed the CELL owns
  the click; a control whose effect dies on reload is decoration.
- FINDINGS w2 (DEC-772..781): the mandate file is a HYPOTHESIS -- five
  wave-2 candidates were already closed in the tree (DEC-732 preview slot
  tags, DEC-744 page measure, DEC-745 plan-editor shell, DEC-747 settings
  rail, DEC-755 create-format); grep the route before tasking, and never
  delete a capability a mock omits (the Anonymize toggle is J4, not
  chrome). A count and the list it labels must be ONE predicate over ONE
  set -- roster-scoped rows with an event-wide count is the same lie
  twice. A duration the scheduler ignores is a form answer the product
  collected and never read. A tab hides the upload that made the file;
  one list with a kind chip does not. An output format the rubric NAMES
  is a capability, not polish. A permanently disabled control is a
  promise the product doesn't keep: ship the route or drop the control.
  Punctuation asserts something on both sides of it. A speaker's own
  page reads dates in the EVENT's timezone.
