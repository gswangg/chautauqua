## 2026-08-10 task-w12-d — spec-audit @ 3b7ed3d

Full detail: docs/verification-log/task-w12-d-spec-audit.md

DEC-069 spec-audit gate (static sweep, no server). Step 1 sha
re-derivation per DEC-114: expected `3543f09` per DEC-116 did NOT hold
once re-walked mechanically against the actual first-parent chain.
`e9ec7e0` ("scribe wave 11") is a 0-diff no-op against `3543f09` on
every non-bookkeeping path (confirmed: `git diff 3543f09 e9ec7e0 --
scripts/walkthrough/speaker.ts` is empty; `src/decisions.ts` only
gains pure string-constant appends). `3b7ed3d` ("merge task-w11-a") is
NOT a no-op: its first-parent diff against `e9ec7e0` touches
`scripts/walkthrough/speaker.ts` with substantive additions (Hotel
GET-only distinct-from-Flight handling, the DEC-108 A/B/C
invite-visibility probe block) not present at `3543f09`/`e9ec7e0` — so
per DEC-114's mechanical test it IS code-bearing, matching the
independent derivations already logged by task-w11-b (build+test) and
task-w11-c (walkthrough), both anchored at `3b7ed3d`. Everything after
`3b7ed3d` on the first-parent chain up through the current tip
(`15a422a` scribe wave 12, `546cbcc` merge task-w11-e, `e309b59` merge
task-w11-b, `2b4a5b9` merge task-w11-c) is confirmed non-code-bearing:
`git diff 3b7ed3d 2b4a5b9 -- . ':!docs/verification-log.md'
':!decisions' ':!field-guide'` returns only `src/decisions.ts` (pure
string-constant appends), and `git diff 3b7ed3d 546cbcc --
scripts/walkthrough/speaker.ts` is empty (546cbcc's merge re-lands
content already present since 3b7ed3d, an empty re-merge on that
path). Newest code-bearing sha for wave-12 gates: `3b7ed3d` ("merge
task-w11-a"). This is a genuine, mechanically-derived deviation from
DEC-116's stated expectation, not a defect — DEC-116's premise (that
`3543f09` alone already satisfied DEC-112 without task-w11-a landing)
turned out not to hold once task-w11-a actually merged; the resulting
speaker.ts content is additive test coverage only (no product-code
behavior change), consistent with build+test/walkthrough already
passing at this sha.

