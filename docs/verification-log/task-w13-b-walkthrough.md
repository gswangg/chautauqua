# task-w13-b — walkthrough @ 3b7ed3d

Full detail for the `## 2026-08-10 task-w13-b — walkthrough @ 3b7ed3d`
section of `docs/verification-log.md`. Supersedes the round-0 stray
content previously at this path (which named `0ee30dd`, a namesake sha
from an earlier, now-obsolete branch point — ignored per this task's
brief).

## 1. Sha re-derivation (DEC-091/DEC-114)

Fresh worktree of `main` at tip `a6eb789` ("scribe wave 13"). Walked
first-parent history and classified each commit's
`git diff --name-only <sha>^ <sha>` (first parent for merges) against
the DEC-114 bookkeeping set (`docs/verification-log.md`,
`docs/verification-log/**`, `docs/eval-findings.md`, `field-guide/**`,
`decisions/**`, pure string-constant appends to `src/decisions.ts`):

| sha | subject | files outside bookkeeping set | code-bearing? |
|---|---|---|---|
| 9a441aa | merge task-w12-d | none (docs/verification-log.md only) | no |
| 2aad317 | merge task-w12-c | none | no |
| f723430 | merge task-w12-b | none | no |
| 3d5d34f | merge task-w11-d | none | no |
| 3cfa744 | merge task-w12-a | none | no |
| 2b4a5b9 | merge task-w11-c | none | no |
| e309b59 | merge task-w11-b | none | no |
| 546cbcc | merge task-w11-e | none | no |
| 15a422a | scribe wave 12 | decisions/DEC-116.md, decisions/DEC-117.md, field-guide/index.md, src/decisions.ts (verified: two pure `export const DEC_116 = "..."` / `DEC_117 = "..."` string appends, no other src/decisions.ts change) | no |
| **3b7ed3d** | **merge task-w11-a** | **scripts/walkthrough/speaker.ts** | **yes** |

`git log -1 --format='%H %s' 3b7ed3d` -> full sha
`3b7ed3d3ed94d42bd157a26b42a94db9354f6290 merge task-w11-a`.

Result: newest code-bearing sha = `3b7ed3d`, matching the DEC-118
expectation.

## 2. Existing walkthrough PASS search

`grep -n "walkthrough @ 3b7ed3d" docs/verification-log.md` found two
sections, both ending `RESULT: PASS`:

- `## 2026-08-10 task-w11-c — walkthrough @ 3b7ed3d` (docs/verification-log.md:1468)
  — full six-area run (`producer -> review -> speaker -> public -> data
  -> scale`, all PASS, wrangler dev on port 8821), with explicit
  DEC-108 and DEC-111 runtime-proof excerpts.
- `## 2026-08-10 task-w12-b — walkthrough @ 3b7ed3d` (docs/verification-log.md:1702)
  — a re-confirmation at the same sha, `RESULT: PASS`.

Per DEC-069 (verify-or-run, DEC-103) and DEC-077 (code-frozen, log-only
lane), this task performs a spot-check and appends a confirm section
rather than re-running the full gate (no `npm ci`/`npm run build`/
`db:migrate`/`seed`/`wrangler dev`/`npm run walkthrough` was invoked by
this task; no port was opened, so none needed releasing).

## 3. Spot-check performed

The current worktree is a fresh checkout of `main` at `a6eb789`, whose
tree on every path outside the bookkeeping set is unchanged since
`3b7ed3d` (confirmed by the table in section 1 above — every commit
between `3b7ed3d` and `a6eb789` is bookkeeping-only). So checking the
current tree is equivalent to checking the tree at `3b7ed3d`.

DEC-111 probes in `scripts/walkthrough/speaker.ts`:

- Hotel GET-only probe, confirmed present: the check titled `"GET
  /portal/tasks/:assignmentId/form for 'Hotel stay requirement form'
  returns 200 (DEC-111: real formId self-healed at task creation, not
  a 400 'not a form task') — GET only, task is left Pending"` sits at
  lines ~554-561, immediately preceded by the `hotelFormAssignmentId`
  lookup at ~540-552 (matches the brief's cited ~541-561 range).
- Flight full backing-form fill: `await
  completeSelfHealedFormTask("Flight reimbursement form", "Do you need
  flight reimbursement?");` at line ~566 (matches the brief's cited
  ~566).
- Ad hoc form-task CFP-attach probe: immediately follows at ~570+,
  labeled in a comment as "task w10-a addition, retargeted at an ad hoc
  task by task w10-e".

DEC-108/DEC-112 invite-visibility probes:

- `scripts/walkthrough/speaker.ts`: `grep -n "DEC-108\|DEC-112"` shows
  the accept+approve A/B/C fixture flow starting at line 792 (comment:
  "DEC-108 public visibility gate (task w11-a, DEC-112/113): accept +
  approve"), with the scoped assertions "speaker1's name appears in
  A's public session card but not B's or C's (DEC-108 invite_status
  gate)" at line 890 and "speaker1's block on /e/<slug>/speakers lists
  A's title but not B's or C's (DEC-108 invite_status gate)" at line
  909.
- `scripts/walkthrough/public.ts`: `grep -n "DEC-108\|invite-visibility"`
  shows the independent server-side gate block starting at line 621
  (comment: "DEC-108/DEC-112: public/embed visibility must additionally
  require..."), the named assertion "J10 DEC-108 invite-visibility
  gate: accepted invitee shown, pending and declined invitees absent"
  at line 658, and leak-detection asserts for pending (line 750) and
  declined (line 754) invitees.

All locations match the line ranges logged by task-w11-c and confirmed
again by task-w12-d's spec-audit at the same sha; no drift found. Per
DEC-118, the split-file probe layout (invite-visibility split across
`public.ts` and `speaker.ts`, form-task self-heal in `speaker.ts`) is
authoritative and is not flagged as a defect.

## 4. Conclusion

No FAIL, no discrepancy found. Confirm-only section appended to
`docs/verification-log.md` citing `3b7ed3d`.

RESULT: PASS
