## 2026-08-10 task-w5-c — walkthrough @ 64ec7de

Full detail: docs/verification-log/task-w5-c-walkthrough-3.md

Wave-6 exit-gate battery (DEC-165/166), walkthrough lane, log-only (no
code changes). Fresh worktree of `main` at port 8801.

OPEN ITEMS: (1) `scripts/walkthrough/speaker.ts`'s "find my own general
task" check is incompatible with `scripts/seed.ts`'s deterministic
mod-3 completion formula for the walkthrough's fixed `contactIdx 0`
speaker — either the seed formula or the check needs to change so at
least one `general`-kind task is left pending for that speaker; (2)
`scripts/walkthrough/public.ts`'s speaker-name extractor regex does
not match the live `/speakers` page markup (name wrapped in a nested
`<a>` inside `<strong>`) and needs updating to tolerate the anchor.
Both are walkthrough-harness/seed defects, not product-route defects —
manual `curl` spot-checks of the underlying pages/data showed correct
behavior in both cases. No code changes made in this log-only lane.

RESULT: FAIL — 2 of 6 areas (speaker, public) each hit exactly 1 FAIL
line (0 PLANNER: lines anywhere); producer, review, data, scale are
clean PASS. Both failures are traced to walkthrough-script/seed
mismatches (see OPEN ITEMS), not product-code defects.

