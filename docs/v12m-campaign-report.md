# v12m campaign — consolidated report (2026-08-22)

The v12 design-pack campaign (speakers redesign + phone views for every screen
at 390px, desktop preserved) ran 2026-08-19 → 2026-08-22 as a swarm engine in
the chq runner with meta-orchestrated fidelity probes and four cut/deploy
cycles. Prod (chautauqua.cc) now serves `cut4-live` = `684018ff9`.

## Outcomes

- **Phone campaign complete.** All 13 clusters frame-complete at 390: four
  probe rounds took the surface from mostly-FAIL with two criticals
  (unsubmittable phone CFP; blank admin agenda) to a final full-surface sweep
  with ZERO regressions and zero horizontal overflow on every route probed.
  All five Wave-A docks live-verified; Wave-B small surfaces closed.
- **Desktop preserved** — byte-identical spot-checks at every probe round;
  DEC-385 single-direction responsive (max-width-only terminal phone blocks).
- **Eval trajectory** (local kms harness, sonnet-5 agent / opus-5 judge):
  93.5 (submission) → 93.8 (Cut-1) → 94.9 (Cut-2) → **96.5 (Cut-3, best)** →
  91.1 (Cut-4 — diagnosed as judge drift, not regression; see
  docs/mobile-campaign.md Cut-4 triage). Run-to-run judge variance measured
  at ±3–5 points; treat single runs accordingly.
- **All judged real defects fixed** across cut cycles (score-floor trio,
  five Cut-2 judge items, Cut-3's comms dedup + import disclosure closures);
  remaining filed item: the pre-existing itinerary Remove persistence race
  (public /schedule), in the mandate for the engine.
- **Scale**: ~35 external waves (~160 internal), ~500 agents on the final
  leg alone, 1,570 commits deployed since the Cut-2 baseline; suite grew to
  20,551 tests, green at the deployed tip.

## Deploys (all code+assets only; prod D1 never touched)

| Tag | Commit | Eval | When |
|---|---|---|---|
| release-submitted | — | 93.5 | Aug 17 |
| cut1-live | ff4a9c2d | 93.8 | Aug 20 |
| cut2-live | aaa6e184 | 94.9 | Aug 20 |
| cut3-live | 991e7e37* | 96.5 | Aug 21 |
| cut4-live | 684018ff | 91.1 (drift) | Aug 22 |

*cut3-live was composed in the deploy clone (eval'd candidate + date-column
ruling); the commit exists there, not on main.

## Judge status

Both official judge visits (Aug 18, Aug 19 — incl. swyx kms-0070 accounts)
predate every cut: the official 2026-08-18-stage2-full score reflects the
submission build. No visit since; a prod-activity monitor is armed.

## Key probe reports

docs/probes/metafid-phoneA/B + desktop (round 1, 08-19) · metafid-round2
(08-20) · metafid-round3 (08-20) · metafid-round4 (08-22, closing sweep).
Campaign law + triage history: docs/mobile-campaign.md; design rulings:
docs/design/DESIGN-RULINGS.md.
