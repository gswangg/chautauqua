## 2026-08-12 task-w13-g — rubric coverage audit, all 7 docs/eval-rubric/*.yaml files (evidence lane, log-only)

Full detail: docs/verification-log/task-w13-g-rubric-coverage-stage1.md

No prior wave of this campaign had audited `docs/eval-rubric/*.yaml`. Tabled
all 116 `- id:` rows (20 scenario + 96 rubric-criterion) across the 7 area
files against current HEAD, independently re-grepped/re-Read (not copied
from a prior campaign's `task-w11-h-c3-rubric-coverage.md`, used only as a
starting file-location index since its frozen SHA is an ancestor of this
worktree's HEAD). Per-area COVERED/total: CFP 16/16, ABS 13/14 (+1 WAIVED
ABS-14 per DEC-272), SPK 16/16, CNT 14/14, AIA 8/8, EMB 14/16 (+2
PARTIAL-meets-minimum: EMB-03 track-only facets, EMB-15 no branding/color
option — both meet each id's own stated minimum pass bar, not counted
OPEN), CRM 12/12. All 20 scenario rows COVERED (scenario), deferred to the
walkthrough battery. Zero rubric-criterion rows are NOT-COVERED; zero
stage-1 gaps found (a NOT-COVERED item is only a gap if SPEC.md
independently requires it — none did). No rubric-only feature proposed.

RESULT: PASS — OPEN ITEMS: 0.

