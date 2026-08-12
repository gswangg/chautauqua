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
  dialog contract, phone @700px; D1 binds PRIMITIVES (epoch-ms
  NUMBER); dates via event-time.ts OWNING EVENT's tz never toISOString;
  public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-20 (DEC-420..470, compacted): ledger names its sha,
  FAIL-unowned vs PENDING-OWNED, PASS is evidence about ITS OWN sha
  only; ONE email rule everywhere via findAccountUserId(contactId OR
  email) NEVER email alone; universal rows graded from ENUMERATION
  never sample; pagination ONE shape `page?:{limit,offset}`+count*+
  `id asc`, ONE listPerPage(raw); a cap the UI can't see LIES, render
  `total`.
- STAGE1-CLOSE w21-22 (DEC-471..480, compacted): A BRANCH IS NOT A
  LANDING -- grade every row from file:line at the sha or `git
  merge-base --is-ancestor`, never a DEC doc or this guide (w20/w21
  guide narrated merges that weren't in); enumeration = re-runnable
  ARTIFACT not prose; a rule's fieldId re-keyed like the field's id or
  silently dead; MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE x PER_PAGE,
  MEASURED not asserted; ONE import cap; "every list endpoint" graded
  by an executable enumeration test.
- STAGE1-CLOSE w23 (DEC-481..487): w22 planned 5 source lanes; at w23's
  read of main only 476 is in and 479 is HALF in -- merge.ts:50-74
  DOCUMENTS an email cascade that :202-203 never performs. 481: a doc
  comment inside src/ is narration too; re-grade every open DEC from
  file:line at wave start, never from the last brief or from a comment
  above the code. 482 the 3 clamp copies collapse onto clampPerPage
  (50), NOT listPerPage (200) -- the SPA omits perPage and does its
  own offset math. 483 the enumeration scans the CLAMP EXPRESSION, not
  the existence of a page-size const, so a sibling lane's correct code
  never red-flags it. 484 the JSON feed owes the same paging truth as
  its HTML twin. 485 the import cap IS the write-burst bound; writes
  are O(rows) -- never grade the import O(rows/90). 486/487 ONE
  projection for form fields (id + rule.fieldId in one expression),
  ONE home for public page constants (MAX_PUBLIC_ROWS derived). w23 =
  5 fix lanes + 1 measured lane, NO ledger (452/470); w24 owns ledger.
- STAGE1-CLOSE w24 (DEC-488..492): w23's premise inverted TWICE inside one
  planning pass -- 484 and 487 landed while this plan was being written, so
  two planned lanes were dropped mid-read. Re-read the file, not the grep
  you ran ten minutes ago. 488 the LAST w21-f FAIL-unowned closes: a form's
  fields get MAX_FORM_FIELDS=200 (also the reorder write/echo bound) and the
  enumeration ALLOWLIST ENTRY IS DELETED -- an allowlist rationale nothing
  enforces is narration (481) wearing a test's clothes. 489/490 a knob the
  URL advertises and the query ignores is a lie: ONE surface->knob table,
  honored by the HTML and the .json twin alike, offered by the builder only
  where true. 491 a bound stated in the wrong unit is not a bound -- the
  import comment said 1 statement/row, reality was up to 4; per-row cost is
  now COUNTED by a test. 492 two implementations of one invariant means one
  of them is wrong: the atomic `col + 1` won, the read-then-write bump died,
  auto-schedule's unbounded 2N-statement loop went set-based and capped.
  w24 = 5 fix lanes, NO ledger (452/470); w25 owns the closing ledger.
