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
- STAGE1-CLOSE w11-17 (DEC-420..453, compacted): 426 WCAG AA THIRD;
  433 public ?page= TWO bounds; 434 ONE isDevMode(env); 438 ledger
  names its sha, FAIL-unowned vs PENDING-OWNED; 447 LEDGER TRAP:
  closing wave = ONE source-changing lane, ledger behind it; 448 a
  PASS ledger is evidence about ITS OWN sha only; 453 never grade a
  MEASURED budget row from code presence; 452 fix waves cut NO ledger.
- STAGE1-CLOSE w18-20 (DEC-454..470, compacted): CALL-SITE PRESENCE !=
  coverage. 454 ONE email rule at EVERY contact.email write/lookup;
  456 account lookup is findAccountUserId(contactId OR email) NEVER
  email alone; 457 KV keys never carry raw input; 459 universal-
  quantifier rows graded from an ENUMERATION never a sample; 460/466
  pagination hand lists went SHORT twice, criterion now MECHANICAL;
  461 ONE shape `page?:{limit,offset}`+count*+`id asc`; 465 ONE
  listPerPage(raw), five clampPerPage copies deleted; 467 user.email
  obeys 454 too; 468 a cap the UI can't see LIES, render `total`; w20
  only task-w20-c actually merged (see 472).
- STAGE1-CLOSE w21 (DEC-471..474, compacted): w20 planned 5 lanes, ONLY
  task-w20-c reached main -- yet decisions/+guide narrated 465..469 as
  done. 472: A BRANCH IS NOT A LANDING; grade every row from file:line
  at the sha or `git merge-base --is-ancestor`, never a DEC doc or this
  guide; unmerged-but-owned = NOT PASS. 471: re-running 466's own
  criterion found 2 more bare-`{items}` sites. 473: enumeration =
  re-runnable ARTIFACT, not prose. 474: w21 = 1 source lane + 4
  evidence lanes + ledger last.
- STAGE1-CLOSE w22 (DEC-475..480): w21's OWN build lane re-read the tree
  and found the w20/w21 guide entry FALSE -- all five w20 merges ARE
  ancestors of bf56ba7 (listPerPage exists, pipeline uses it, PipelineBoard
  renders `total`, files/comments ship envelopes; 293 files/2669 tests
  green). DEC-472's method is what caught the guide, so keep the method and
  distrust the narration -- INCLUDING these lines. w22 = FIX wave, 5 source
  lanes, NO ledger (452/470); w23 owns the ledger. 475 a rule's fieldId is
  re-keyed exactly like the field's id or the rule is silently dead (locked
  triggers, J1/CFP-03). 476 slot minutes are day-bounded at
  isValidSlotInput, the ONE slot write, sharing MINUTES_PER_DAY with
  AUTO_SCHEDULE_BOUNDS. 477 MAX_PUBLIC_ROWS = MAX_PUBLIC_PAGE x PER_PAGE and
  must clear SPEC's 800 speakers; hasMore tests the ROW bound too; MEASURED
  not asserted (453). 478 ONE import cap (10k vs 2k made the 400 a lie).
  479 merge owes 456's user-email cascade, same invariant, other door.
  480 hand-enumerated populations go stale in two waves (466 happened to
  465): "every list endpoint" is now graded by an executable enumeration
  test, never prose -- this discharges 473.
