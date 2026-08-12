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
- FINDINGS w1-11 (DEC-570..669, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour alone isn't track identity -- NAME
  it; blank CSV cell is ABSENT DATA; seed has ONE clock; imported row
  keeps THEIR id via namespaced `external_ref`; a drawer is a RECORD;
  anonymity is a RATCHET; merge takes a SET; confirmation is a DIALOG
  not window.confirm; items+total from ONE where clause; join identity
  is the PAIR its uniqueIndex names; raw id leaks -- render LABELS; a
  worklist row carries its action; "in scope?" ends in ONE rule; a
  guard citing routes it doesn't guard is desynced -- enumerate.
  Cacheability is a DEFAULT (no-store) + "own header wins". Import is
  PLANNED before applied. Every send ends in ONE reporter. A union
  makes items AND total lie -- a second scope is a second TAB.
- FINDINGS w12-14 (DEC-670..686, compacted): a capped ANONYMOUS list
  counts only what it shows; export = same where clause everywhere; a
  chromeless surface is CLOSED both ways; a builder's options are the
  server's vocabulary IMPORTED via one named boundary module; a
  worklist whose regions are one nav away is a report. Import is not
  exempt from closed vocabularies -- validate in the PLANNER; an
  imported row is RECORDED (visible=false). A server rule the UI never
  states is a trap: locked/weighted state renders its reason. ONE
  reporter is the only one; loading is DELAYED (~250ms); `total` is
  count(*) never `rows.length`. A rule's VALUE is typed by its
  TRIGGER's kind, proven by a parity test over ONE case table. A merge
  var the toggle never populated is ABSENT, never a polite sentence. A
  public list page is list + rail, rail never renders inside /embed.
  An irreversible action is a PAGE at its own URL, not a modal. A
  dialog's form is ONE FormRow inside ModalFrame. A paged read touches
  only the page -- aggregates key to page rows, paging in SQL.
- FINDINGS w15 (DEC-687..696): `.toString()`-embedded fns carry NO
  closure -- free identifiers travel beside them, proved by EXECUTING
  the emitted script, never by testing the TS. Tier class ALWAYS wins:
  no element selector inside a tier rule; .chq-btn anchor is a button
  (no underline). A hub gives a row ONE action, own calendar grammar.
  Settings is read-only SUMMARY + drill-in over seven sections; embed
  builder reached FROM Public pages. A worklist row names the LATEST
  artefact, two actions only. Test vs docs/design conflict: THE TEST
  is wrong. A scope param goes on send AND preview, identically. A
  thrown render is a DESIGNED error state, never blank. Prose renders
  via ONE escape-FIRST Markdown renderer, closed allow-list.
