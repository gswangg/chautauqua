# Eval evidence

Official self-run of swyx's `killmysaas-evals` kit (sbek), **stock configuration:
70-turn budget, all 20 scenarios, unmodified kit**, agent `claude-sonnet-5`,
judge `claude-opus-5`.

## Final run — 2026-08-17T00-28 (the locked release build, tag `g13-lock`)

**93.5% over 93.2% of rubric weight judged.** Artifacts in `final-run/`:
`report.json` (machine-readable, per-item verdicts), `report.html`,
`manual-checklist.md` (22 items the harness left for manual verification),
and the full `run.log`.

Per-area: abstract-management 100 @ 96.4 · public-widgets 97.1 @ 100 ·
speaker-management 96.7 @ 90.9 · ai-agenda 94.4 @ 100 · speaker-crm 88.9 @ 94.7 ·
call-for-papers 87.9 @ 76.3 (two scenarios hit the 70-turn cap; the unreached
items are excluded from coverage, not scored) · content-management 83.9 @ 100.

## Method notes, honestly

- **Turn budget matters.** Scores from extended-turn runs (100-150 turns) are
  not comparable to stock 70-turn runs: extra turns raise coverage and score.
  We publish the stock number.
- **Not re-rolled.** One final run on the locked build; the score is that run's,
  not a best-of-N. An earlier same-night attempt crashed mid-run from local
  server overload (our machine, not the app) and was discarded before judging
  completed — noted here so the run count is transparent.
- **Score trend across the build campaign** (same stock config): 82.2 → 86.4 →
  87.9 → 89.0 → 90.3 → 93.8 (interim, 2026-08-16) → 93.5 final. The 93.8→93.5
  delta is within observed run-to-run variance (turn-cap luck alone moves
  areas by several points).
- **Known harness caveat (community-reported):** the CNT area's scenario design
  binds the speaker persona's session to the seeded event while the organizer
  scenario creates a new event, making several content-management handoffs
  (CNT-05/07/13/14) impossible to demonstrate as scripted. Our
  content-management 83.9 includes losses of this class.
- Remaining-gap taxonomy lives in `docs/eval-findings.md` (turn-cap tail,
  eval self-contamination markers, deliberate scope decisions incl. one
  rubric item we forfeit on the SaaS owner's own guidance).
