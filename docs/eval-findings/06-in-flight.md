## IN FLIGHT — owned by a branch, do not re-file

Ref-measured at THIS task's own runtime against HEAD `87cee8b9` (46 refs
total; `git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` + `npx tsx scripts/ref-state.ts` + `git merge-base
--is-ancestor <ref> HEAD` run individually for every ref). Wave 45's
seven-item defect ledger and wave-30-through-47's named branches are gone
from this section — folded into TIER 0 above (all seven items CLOSED, all
owning branches merged). **Only a discharge status this lane itself
verified moved this wave; every branch below is named by sha and scope,
not re-adjudicated (DEC-358 w50 boundary).**

### Wave 48 — non-landed lanes

- `task-w48-b` (`2c3c4210`) — "DEC-069 gate slot 2/5 J1-J12 walkthrough @
  243b3094 (FAIL producer)".
- `task-w48-d` (`edea9219`) — "SPEC §6-9 static audit @ 243b3094".
- `task-w48-e` (`6b03b916`) — SIBLING rebase of this same file, older
  boundary (`243b3094`); do not hand-merge both, whichever lands first
  the other re-derives from the landed tree.
- `task-w48-g` (`bc04eb75`) — "DEC-069 gate slot 5/5 triage-closure @
  243b3094 (0245)".

All four committed, none an ancestor of HEAD.

### Wave 49 — all eight lanes committed, none landed (plan facts only, no verdict carried)

`task-w49-a` (`22aeb2fc`, likely fixes the item-2 clock test above),
`task-w49-b` (`e2929273`, CFP field-edit 409 on sibling-rule invalidation,
DEC-505), `task-w49-c` (`9d870db7`, gate repair: build admin SPA before
server-boot), `task-w49-d` (`db1dbc49`, public agenda feed reports a row
ceiling not a count), `task-w49-e` (`1ec6b285`, closes standing
DEC-099/DEC-068 items, pre-allocated seq `0250`), `task-w49-h` (`0aaf596e`,
CFP/public-submit integrity adjudication, seq `0251`) — named, not
independently re-read. `task-w49-f` (`b280d310`) and `task-w49-g`
(`73c2a306`) each claim to discharge one UNOWNED wave-41 falsifiability
remainder (see batch-A/batch-B entries above) — **OWNED, not verified by
this lane**; this task did not re-run either branch's checks, so the
remainder lists stay UNFALSIFIABLE-but-claimed, not CLOSED, until a
landing or an independent re-verification says so.

`0230` (task-w45-a, review-integrity) and `0231` (task-w45-b,
comms-integrity) filed **zero** CONFIRMED-DEFECT rows each (four J4 claims
NOT-CONFIRMED with one named verification gap for review-integrity; four
J5 claims NOT-CONFIRMED/DELIBERATE-BY-DESIGN for comms-integrity) — do not
re-file either as owed a wave-47 lane; they closed clean. `0237`
(task-w45-g, slot-claim instrument repair) fixed two DEC-069
slot-claim-classifier defects directly (no product code) and is MERGED;
not re-filed here.

### Wave 50 — this wave's own siblings (boundary text: a/b/c/d/e gates, f/g/h adjudications)

`task-w50-a` (`94cff3c8`, frozen-gate build+test+bundle), `task-w50-b`
(`c69591cc`, frozen-gate walkthrough — FAIL producer, day-label test
defect, consistent with item 2 above), `task-w50-c` (sha diverged past
worktree-creation value — a live sibling still committing, perf-smoke
three-run receipt), `task-w50-d` (`7bbd7b6d`, spec-audit SPEC §6-9),
`task-w50-f` (`dd95ef4c`, J3 submissions-triage adjudication, docs-only),
`task-w50-g` (`65e491eb`, J12 data-out adjudication, docs-only) — all
committed, none an ancestor of HEAD. `task-w50-e`/`task-w50-h` — tip
equals HEAD exactly (zero commits at this reading), RUNNING per DEC-069
wave-37, scope triage-closure per the slot roster. `task-w50-i` — this
task itself. None of these nine's counts, verdicts or RESULT/OPEN ITEMS
lines are restated or predicted here — named by branch, sha and one-line
scope only, per this task's own boundary.

### Other live refs (not wave 47-50)

- **`task-w17-i`** (`7b78d8b6`) — STILL UNMERGED, unchanged across many
  waves, but its NAMED SCOPE ("Sign-in page names the event and its open
  CFP", DEC-716) is CLOSED-SUPERSEDED — see the DISMISSED review-lens/
  instrument alarms entry above (`loadSingleEventContext` landed via a
  different lane). Do not resurrect the branch or re-file its scope.
- `manual-qa`, `task-custodian-w68-4`, `task-w68-d`, `task-w71-c/d/e` —
  ancestors of HEAD (folded into history; stale live refs, not owned
  scope).
- `mail-rich-shape-fallback`, `task-w68-b/c/e`, `task-w71-a`,
  `task-w72-a`-`j` — NOT ancestors, genuinely unmerged, but belong to
  waves numbered ahead of wave 50 (68/71/72), a different/later campaign.
  Flagged, not triaged.

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

Re-globbed again this wave: `ls
docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` — file EXISTS
(unchanged from the wave-35 correction). Not independently re-read for
content this task (DOCS ONLY rebase); next TIER-1 touch should read it
rather than trust this note.

