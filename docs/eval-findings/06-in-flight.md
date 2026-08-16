## IN FLIGHT — owned by a branch, do not re-file

Rewritten wave 72 (`task-w72-p`), at THIS task's own runtime, against
`main`/HEAD `b2fe1367e4b81b5adb9343da7e352a89d847d658`. The prior body of
this file was pinned to `50c3fcc4` (wave 57) and listed `task-w56-a`,
`task-w56-d`, `task-w56-e`, `task-w57-b`, `task-w57-c` as live/unmerged —
all five are now ancestors of `main` (landed via later merge trains), and
the file's own "OWNS GATE-9 row 1" claim on `task-w56-a` would have sent
a future planner chasing an already-closed scope. DELETING that stale
census rather than annotating it, per this file's own header rule
(DEC-358: "prefer a shorter, true document to a longer, hedged one").

Method (per DEC-358 wave-72 mandate): enumerate `.git/refs/heads/*` as
loose refs only — **never** `.git/packed-refs`, which in this repo is a
live trap carrying `task-w71-a/-c/-d/-e` and `task-w72-a` through
`task-w72-j` from an interleaved earlier campaign (confirmed present via
`grep` against `.git/packed-refs` for this note only, not trusted for
census content). For each loose ref, `git merge-base --is-ancestor <ref>
main` was run individually (no glob).

### Loose refs at this runtime

Ancestors of `main` (merged, closed, do not re-file):
- `manual-qa`
- `task-w70-f` — DEC-613 wave-70 amendment, TaskKind vocabulary (also
  named below as this campaign's off-limits set by branch name; merged
  but still off-limits by name per this wave's mandate)
- `task-w71-b` — DEC-370, overview worklist conflicts see the event's breaks
- `task-w71-f` — DEC-456 wave-71 amendment, `findAccountUserId` delegates
  to `findAccountUserIds`
- `task-w71-g` — Speaker record org-wide Logistics section
- `task-w71-h` — DEC-615 wave 71, one ConflictKind vocabulary
- `task-w71-j` — docs: wave-71 mandate receipts
  (`docs/eval-findings/13-wave71-receipts.md` — already landed on `main`
  at this runtime; the wave-72 task brief that assigned this file's
  numbering assumed it was still in flight — it is not, see
  `14-wave72-receipts.md` for the full note)
- `task-w72-m`, `task-w72-n` — both equal to `main`'s current tip
  (`b2fe1367`); no independent content, artifacts of worktree creation.

NOT ancestors of `main` (live, unmerged, at this runtime):
- `task-w70-g` (`35a491b8`) — "Wave 70 mandate hygiene: receipts file +
  DEC-083 blast-radius paragraphs". LIVE. Off-limits by branch name per
  this wave's mandate.
- `task-w71-i` (`e25a3633`) — "Settings panels: clear page-level error
  banners on reload (DEC-856 w71)". LIVE. Off-limits by branch name per
  this wave's mandate (one of the six wave-71 scopes).
- `task-w72-k` (`3fa50bdf`) — "Document DEC-083's instance-wide pubcache
  purge blast radius". LIVE, this campaign, not yet triaged into
  off-limits by any downstream mandate as of this reading.
- `task-w72-l` (`4eec746c`) — "DEC-856: clear page-level error banners on
  the next successful read". LIVE, this campaign.
- `task-w72-o` (`e142ab9c`) — "DEC-155 wave-72: ledger the straight-line
  serial-write class the loop scan cannot see". LIVE, this campaign.
- `task-w72-p` (this branch) — in progress, writing this file.

### This campaign's off-limits set, by branch name (per DEC-358/DEC-069 w72 mandate)

- `task-w70-f` — TaskKind vocabulary (merged; name still fenced)
- `task-w70-g` — wave-70 receipts
- `task-w71-b` — overview break-aware conflicts + required `scheduleSummary` arg
- `task-w71-f` — `findAccountUserId` ordered query
- `task-w71-g` — speaker `customFieldsJson` / Logistics projection
- `task-w71-h` — conflict-kind boundary module
- `task-w71-i` — three settings panels' error clear + settings ledger
- `task-w71-j` — wave-71 receipts

All eight are also, independently, already ancestors of `main` except
`task-w70-g` and `task-w71-i`, which remain genuinely live. Fencing by
branch name (not by merge state) is the mandate's own instruction —
follow it even where the ref has already landed, since the scope named
by the branch may still be assumed "owned" by a planner reading only the
branch list.

### Packed-refs trap (noted, not trusted)

`.git/packed-refs` in this repo additionally lists `task-w71-a`,
`task-w71-c`, `task-w71-d`, `task-w71-e`, `mail-rich-shape-fallback`,
`task-w17-i`, `task-custodian-w68-4`, `task-w68-b`, `task-w68-c`,
`task-w68-d`, `task-w68-e`, and `task-w72-a` through `task-w72-j` — all
from an interleaved earlier campaign sharing this repo's branch
namespace. Per this wave's method restriction these were **not** read
for content or ancestor-status and carry no claims here. Do not treat
their absence from the "loose refs" section above as "merged" or
"deleted" — they are simply out of scope for this census. A future wave
rebuilding this file should re-derive from loose refs at its own
runtime, same as this one did, and should not copy this paragraph's
branch list forward as if it were current.

### TIER-1 pointer — re-globbed this wave

`docs/verification-log/task-w27-g-fidelity-recheck-ceda66f2.md` still
exists on disk at this runtime. Not independently re-read for content
this task (out of scope); the next TIER-1 touch should read it rather
than trust this note.
