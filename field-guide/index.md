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
  manifests desync -- enumerate; conditional visibility is a FIXED POINT;
  hand-copied vocabularies drift -- IMPORT them; uniqueIndex is a
  CONTRACT; negation skips NULLs.
- FINDINGS w1-14 (DEC-570..686, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour isn't track identity -- NAME it;
  blank CSV cell is ABSENT DATA; seed has ONE clock; imported row keeps
  THEIR id via `external_ref`; drawer is a RECORD; anonymity is a
  RATCHET; merge takes a SET; confirmation is a DIALOG not
  window.confirm; items+total from ONE where clause; raw id leaks --
  render LABELS; worklist row carries its action; guard citing routes
  it doesn't guard is desynced -- enumerate; cacheability DEFAULT + "own
  header wins"; every send ends in ONE reporter; union makes items AND
  total lie -- second scope is a TAB; capped ANONYMOUS list counts only
  what it shows; export = same where clause everywhere; chromeless
  surface CLOSED both ways; builder's options IMPORTED via one named
  boundary module; import not exempt from closed vocabularies --
  validate in PLANNER; imported row RECORDED (visible=false); server
  rule the UI never states is a trap; rule's VALUE typed by TRIGGER's
  kind; merge var toggle never populated is ABSENT; public list is list
  + rail, never in /embed; irreversible action is a PAGE at its own
  URL; paged read only touches the page.
- FINDINGS w15 (DEC-687..696, compacted): `.toString()`-embedded fns carry
  NO closure -- proved by EXECUTING the emitted script. Tier class
  ALWAYS wins. Hub gives a row ONE action. Settings is read-only SUMMARY
  + drill-in; embed builder reached FROM Public pages. Worklist row
  names the LATEST artefact, two actions only. Test vs docs/design
  conflict: THE TEST is wrong. Scope param on send AND preview,
  identically. Thrown render is DESIGNED, never blank. Prose via ONE
  escape-FIRST Markdown renderer.
- FINDINGS w16 (DEC-697..705): a response you did NOT construct may have
  IMMUTABLE headers -- decorate through ONE clone-on-failure helper,
  proved on a frozen-header response, scan-locked. Grid row's cells are
  POSITIONAL: absent fact -> EMPTY cell; dropped column re-declares the
  template. Waitlisted is a HOLD: sixth status, never public/decided,
  "under review" -- new enum member joins every NEGATIVE predicate,
  re-read them all. Badge is a live claim: refetch on nav + after every
  mutating call, from the ONE api module. Warn-never-block covers the
  KEYBOARD path -- occupied slot offers placement, NAMES the clash, N
  never "a pair". Seeded prose never says it's seed data. Ranked row
  names human and track; export carries table's columns/order. Bulk
  label states scope it SENDS; strip's columns hold still, weight
  marks nearest. Merge preview is the merge fn's OWN output, per field.
