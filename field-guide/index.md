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
  CSV cell is ABSENT DATA; anonymity is a RATCHET; merge takes a SET; raw
  id leaks -- render LABELS; cacheability DEFAULT + "own header wins";
  irreversible action is a PAGE; hub gives a row ONE action; grid cells
  POSITIONAL; person named by CONTACT; tab selection is URL state; a
  column with side effects has ONE writer; validators refuse what the
  store can't carry; sandboxed child's origin IS "null"; labels are
  customFields; tiers are a PREDICATE over the tree; portal shows EVERY
  submission a speaker owns; publish is the WINDOW, not a flag; a
  recorded decision with no code is a LIE; anonymised hides the SPEAKER
  from the REVIEWER, never the organiser; the seed must satisfy every
  read it enables -- assert by enumeration.
- FINDINGS w21-22 (DEC-744..762, compacted): an envelope's KEYS are fixed
  by its route, not whether the branch had anything to say. A seeded
  reviewer is a NAMED person (user.contact_id). ONE measure token. Chrome
  fidelity never deletes a capability. A task with no assignee is not a
  state we offer -- creation always expands. Merge shows EVERY differing
  field. A roster and the set an action expands over are ONE predicate.
  Every control in a creation dialog must reach the store; a selector the
  POST body drops is decoration. Contact identity is (org, lower(email)).
  An author is a PERSON, never "Unknown". Delete is refused with counts;
  merge is the answer for a contact carrying history. Rows grow, not
  scroll. Position ("N of 47") re-derives from the URL, never router
  state.
- FINDINGS w1(this run, DEC-763..771): the mandate file was ~2 probes
  stale AGAIN -- grep the route before re-tasking; a finding is a
  hypothesis until the tree agrees. A disclosure and the count beside it
  are ONE predicate. An export href must carry the sort the table shows.
  Fix fabricated data with honesty about what the action does, not a
  second concept the model lacks -- `participant` is the ONLY
  contact-to-event link. Identity is an id you already hold, never an
  email you re-derive; a duplicate contact makes speaker double-booking
  INVISIBLE. Failure is a STATUS not an absence -- an attempt that
  leaves no row is the one the audit needed. A count on a settings row
  is a promise about a visitor's query: produce it with that query.
  Public grid rows must grow like the admin grid's. A session cannot
  clash with itself; while armed the CELL owns the click, not the card
  over it. A control whose effect dies on reload is decoration.
