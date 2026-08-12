# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a
hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification
  hooks, §2 principles). docs/ precedence: clarifications.md overrides
  all; decisions/DEC-*.md binding, src/decisions.ts compile-checked
  (never hand-edit). House invariants: fail loudly; status changes
  never auto-email; authz every route, server-side visibility.
- STAGE1 (DEC-002..365, COMPLETE): pure-core src/{auth,domain,forms,
  mail,lib} import nothing node:/cf; 004 hash 'pbkdf2$v1$100000$salt$
  hash'; 012/013 route files export Hono sub-apps, errors
  {error:{code,message,fields?}}; bulk ops set-based/CLOSED, LOG-ONLY.
- REDESIGN w1-10 (DEC-366..419, FUNCTION FROZEN): tokens frozen, NO
  RED/shadows/new deps; styles.css+theme.ts=ONE lane; ONE dialog
  contract, phone @700px, 44px controls; D1 binds PRIMITIVES (epoch-ms
  NUMBER); 2px olive focus ring; dates via event-time.ts OWNING
  EVENT's tz never toISOString; ONE parseBoundedText, 400 never 500;
  public lists LIMIT+COUNT(DISTINCT).
- STAGE1-CLOSE w11-20 (DEC-420..470, compacted): 426 WCAG AA THIRD; 433
  public ?page= TWO bounds; 434 ONE isDevMode(env); 438/447/448 ledger
  names its sha, FAIL-unowned vs PENDING-OWNED, closing wave = ONE
  source lane + ledger behind it, PASS is evidence about ITS OWN sha
  only; 452/453 fix waves cut NO ledger, never grade MEASURED from code
  presence; 454/456/467 ONE email rule everywhere, account lookup is
  findAccountUserId(contactId OR email) NEVER email alone; 457 KV keys
  never carry raw input; 459 universal rows graded from ENUMERATION
  never sample; 460/466 pagination hand lists went SHORT twice,
  criterion now MECHANICAL; 461 ONE shape `page?:{limit,offset}`+
  count*+`id asc`; 465 ONE listPerPage(raw), five clampPerPage copies
  deleted; 468 a cap the UI can't see LIES, render `total`; w20 only
  task-w20-c actually merged (see 472).
- STAGE1-CLOSE w21-22 (DEC-471..480, compacted): 472 A BRANCH IS NOT A
  LANDING; grade every row from file:line at the sha or `git
  merge-base --is-ancestor`, never a DEC doc or this guide;
  unmerged-but-owned = NOT PASS -- w20/w21 guide narrated 465..469 as
  done when only task-w20-c merged. 473 enumeration = re-runnable
  ARTIFACT, not prose. w22 re-read post-472 and found ALL five w20
  merges ARE ancestors of bf56ba7 after all -- distrust narration,
  INCLUDING this guide, always. 475 a rule's fieldId is
  re-keyed like the field's id or the rule is silently dead. 476 slot
  minutes day-bounded at isValidSlotInput. 477 MAX_PUBLIC_ROWS =
  MAX_PUBLIC_PAGE x PER_PAGE, MEASURED not asserted. 478 ONE import
  cap. 479 merge owes 456's user-email cascade. 480 hand-enumerated
  populations go stale in two waves -- "every list endpoint" now
  graded by an executable enumeration test.
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
