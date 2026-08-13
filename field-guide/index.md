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
  the UI can't see LIES, render `total`; atomic SQL beats
  read-then-write; hand-listed manifests desync -- enumerate;
  conditional visibility is a FIXED POINT; hand-copied vocabularies
  drift -- IMPORT them; uniqueIndex is a CONTRACT; negation skips NULLs.
- FINDINGS w1-17 (DEC-570..716, compacted): full suites SERIALIZED; real
  <button> not `div draggable`; colour isn't identity -- NAME it; blank
  CSV cell is ABSENT DATA; imported row keeps THEIR id; anonymity is a
  RATCHET; merge takes a SET; confirmation is a DIALOG; raw id leaks --
  render LABELS; cacheability DEFAULT + "own header wins"; send ends in
  ONE reporter; irreversible action is a PAGE; tier class ALWAYS wins;
  hub gives a row ONE action; settings SUMMARY + drill-in; grid cells
  POSITIONAL, absent -> EMPTY; badge refetches on nav+mutation; person
  named by CONTACT via batched account->contact; tab selection is URL
  state; directory is TABLE + RAIL.
- FINDINGS w18 (DEC-717..726, compacted): a column with side effects has
  ONE writer; validators refuse what the store can't carry (Infinity ->
  `null`), assert per KIND. Sandboxed child's origin IS "null" --
  identity is source window + nonce. Asking for changes is a MESSAGE;
  status route stays mailer-free. One deliverable at a time: a chip
  scopes versions AND thread. Review renders criterion LABELS + plan's
  weighted score. Null-room column: "No room yet" only when armed.
  Periodic push INCREMENTAL from a watermark, backs off on 429. Labels
  are customFields, one keyed format (supersedes DEC-712).
- FINDINGS w19 (DEC-727..735, compacted): tiers are a PREDICATE over the
  tree -- caps bind in config, not env. Settings SUMMARY + drill-in via
  URL. Portal shows EVERY submission a speaker owns. Three states, ONE
  control family. Publish is the WINDOW, not a flag. A preview names
  each recipient's blocker. An action that can't apply is ABSENT, not
  disabled. Duplicate group carries the fields its merge screen shows.
  A class describes ONE layout behaviour. Desktop first, phone @media.
- FINDINGS w20 (DEC-736..743): a recorded decision with no code is a LIE --
  grep the ROUTE before re-tasking. Anonymised hides the SPEAKER from
  the REVIEWER; the organiser is never told "Anonymous". Arrow, CSV
  link and rendered rows are ONE fact -- drop superseded responses,
  clear rows on a failed refetch. A ranked row states ONE score; detail
  lives behind the disclosure. Labels are customFields minus the
  reserved prose key, formatted once server-side. The seed must satisfy
  every read it enables (task carries answers; batch carries
  recipients) -- assert by enumeration. Asking for changes is a SEND,
  in a module the mailer-free invariant does not bind. A clash renders
  at full size: inner scroll hides the evidence. Detail decides the
  SUBMISSION; content is decided on the content screen.
