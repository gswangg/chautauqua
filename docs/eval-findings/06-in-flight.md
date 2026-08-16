## IN FLIGHT — owned by a branch, do not re-file

Re-derived wave 57 (`task-w57-e`), at THIS task's own runtime, against
`main`/HEAD `50c3fcc4d63239784fdd237f7340a3f648934e31`. The wave-48
through wave-51 census this section previously carried is ENTIRELY
LANDED HISTORY — a 26-branch merge train at wave 53 merged all of
wave-48/49/50/51's lanes (see the wave-53 field-guide entry), and this
task independently reconfirmed every one of those refs is now an
ancestor of `main`. DELETING that stale census rather than annotating
it (DEC-358 w57 mandate: "prefer a shorter, true document to a longer,
hedged one").

Method: `git for-each-ref --format='%(refname:short) %(objectname:short)'
refs/heads` against every local ref, plus `git merge-base --is-ancestor
<ref> main` run individually per ref (never a glob, never
`.git/packed-refs`).

### Live and unmerged this wave (current campaign)

- `task-w56-a` (`72ecc759`) — DEC-941 delete-confirm scan fix + three
  ConfirmDialog guards. OWNS GATE-9 row 1.
- `task-w56-d` (`0259ef82`) — DEC-603 Comms History tab (column heads,
  filter chips, right-flushed search). OWNS GATE-9 row 5.
- `task-w56-e` (`b581dd8a`) — DEC-124 save `err.fields` walk + DEC-989
  ProgressPanel measure + widened page-measure scan. OWNS GATE-9 row 4
  (plan-editor 400 messages + progress measure half).
- `task-w57-b` (`2304bbd6` at last reading, may have advanced) —
  scorecard grid gap 36px -> 60px (DEC-939). OWNS GATE-9 row 4
  (scorecard rail gutter half).
- `task-w57-c` (diverging past `50c3fcc4` as of this reading — still
  actively committing) — DEC-422 text caps crossed into client controls.
  Scope only, not independently re-read this task.
- `task-w57-a`, `task-w57-d` — both read as ancestors of `main` at this
  runtime (their content already landed via a merge-train commit); left
  named here only because their worktrees are still live, not because
  they carry open scope.

### Other live refs, not this campaign's queue (flagged, not triaged)

- `task-w17-i` (`7b78d8b6`) — STILL UNMERGED, but its named scope
  (DEC-716, sign-in names the event and its open CFP) is
  CLOSED-SUPERSEDED — see `docs/eval-findings/04-tier0-dismissed.md`'s
  DISMISSED review-lens entry (`loadSingleEventContext` landed via a
  different lane). Do not resurrect the branch or re-file its scope.
- `mail-rich-shape-fallback`, `task-w68-b`, `task-w68-c`, `task-w68-e`,
  `task-w71-a`, `task-w72-a` through `-j` — NOT ancestors of `main`, but
  belong to a different, later-numbered campaign sharing this repo's
  branch namespace (that campaign reached wave 72). Not this campaign's
  work; do not pull scope from these branches.
- `manual-qa`, `task-custodian-w68-4`, `task-w68-d`, `task-w71-c`,
  `task-w71-d`, `task-w71-e` — ancestors of `main` already (stale live
  refs from that other campaign, folded into history).

### TIER-1 pointer — `task-w27-g` owns fidelity-recheck verdicts, cite as OWNED

Re-globbed this wave: `docs/verification-log/
task-w27-g-fidelity-recheck-ceda66f2.md` exists. Not independently
re-read for content this task (out of scope) — next TIER-1 touch should
read it rather than trust this note.
