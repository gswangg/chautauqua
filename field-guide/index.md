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
  email rule via findAccountUserId; universal rows graded from ENUMERATION
  never sample; pagination ONE shape+count*+`id asc`; a cap the UI can't
  see LIES, render `total`; atomic SQL beats read-then-write; hand-listed
  manifests desync -- enumerate; conditional visibility is a FIXED
  POINT; hand-copied vocabularies drift -- IMPORT them; a uniqueIndex is
  a CONTRACT; negation skips NULLs.
- FINDINGS w1-9 (DEC-570..654, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; blank CSV cell is ABSENT DATA; seed has ONE clock; imported row
  keeps THEIR id via namespaced `external_ref`; a drawer is a RECORD;
  two readings END in one resolver; anonymity is a RATCHET; merge takes
  a SET; confirmation is a DIALOG not window.confirm; items+total from
  ONE where clause; a join row's identity is the PAIR its uniqueIndex
  names; raw id leaks -- render LABELS; a worklist row carries its action.
- FINDINGS w10-11 (DEC-655..669, compacted): a scope check skipping the
  plan's own filter grants what the queue hides -- "in scope?" ends in
  ONE rule; a guard citing routes it doesn't guard is a desynced
  manifest -- enumerate. Cacheability is a DEFAULT (no-store) plus "own
  header wins". A subset vocabulary encoding a server fact must test
  EQUALS those keys. Import is PLANNED before applied: dry run names
  REPLACEs+collisions. Every send ends in ONE reporter. A union makes
  items AND total lie -- a second scope is a second TAB.
- FINDINGS w12-13 (DEC-670..680, compacted): a capped ANONYMOUS list
  counts only what it shows; export = same where clause everywhere; a
  chromeless surface is CLOSED both ways (render + enumerate hrefs); a
  builder's options are the server's vocabulary IMPORTED via one named
  boundary module; a worklist whose regions are one nav away is a
  report. An import is not exempt from closed vocabularies -- validate
  in the PLANNER; an imported row is RECORDED (visible=false), never
  published. A server-enforced rule the UI never states is a trap:
  locked/weighted state renders its reason. ONE reporter means the
  only one -- scan-lock `failed[]`. Loading is DELAYED (~250ms); empty
  state never mid-load. `total` is count(*), never `rows.length`.
- FINDINGS w14 (DEC-681..686): a rule's VALUE is typed by its TRIGGER's
  kind -- string-vs-boolean/number equality hides the field forever,
  then the next save DELETES the answer; the browser toggler must
  compute the SAME fixed point as the server, proven by a parity test
  over ONE shared case table. A merge var the toggle never populated
  must be ABSENT (preflight names it), never a polite sentence;
  attached feedback is plan+round scoped like every evaluation read
  (DEC-087 has no comms exception). A public list page is list + rail,
  rail never renders inside /embed. An irreversible action is a PAGE
  at its own URL, not a modal; list search sits in the toolbar. A
  dialog's form is ONE FormRow inside ModalFrame. A paged read touches
  only the page -- aggregates key to page rows, paging in SQL, never
  a scan sliced in JS.
