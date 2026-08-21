# Meta-fidelity probe round 3 — 2026-08-20 (~18:45), main @ f7432267, server :8891

Four parallel probes: Content cluster, Wave-A docks, Wave-B small surfaces, regression smoke over the six DONE clusters. Detail reports: probe3-content.md, probe3-docks.md, probe3-waveb.md, probe3-regression.md (this dir); evidence in probe3-shots/ and probe3-waveb-evidence/.

## Verdicts

- **Content: DONE.** Round-2's worst finding (inert sticky dock) fixed via `order:1` on `.chq-content-worklist > .chq-bulkbar` in the phone block (content.css:1950) — sticky pin proven at scroll extremes, buttons 48px and unobstructed, real bulk-approve click round-tripped (and reverted). Files + Session-deliverable docks same pattern, all pass. Content file links tap-floor also fixed (44px). Desktop unchanged.
- **Wave-A docks: 4/5.** CFP wizard (round-1 critical re-verified: step 1 submits), portal profile, portal session, portal task form (live-verified, not just unit test) all PASS. **Contacts Pipeline dock: MISSING** — no bottom band exists at all in PipelineBoard.tsx; tab-bar suppression symptom exactly as round-2 predicted. Page not broken (inline primary action reachable) but frame not met. → RED SET.
- **Wave-B: CLOSED.** Tap-floor tokens (Settings/Comms/Contacts all ≥44), /login gaps (14px, focus ring clear), Settings back/title order ×6 (+1 no-edit-view by design), Comms drill-head suppression, CFP column (358px budget, gutter cancelled). 0px document overflow on 21 routes; desktop spot-checks unchanged.
- **Regression smoke: Speakers REGRESSED; other five clusters STILL-DONE.**
  1. `app/src/pages/speakers/speakers.css` — `.chq-speaker-detail-grid` (`minmax(0,1fr) 320px`) has NO phone collapse; at 390 the main column starves to 4px, section labels wrap one character per line. High-traffic path (roster → Open profile).
  2. `app/src/pages/speakers/task-view.css:290-295` — phone override declares `grid-template-columns: 26px 1fr` for 5-cell task-drill rows; auto-placement zigzags answer/status text into the 26px checkbox column. Both tabs of /admin/speakers/tasks/:id affected.
  - Both desktop-1280-clean and zero-document-overflow → invisible to overflow-only ratchets. → RED SET.

## Red set for Cut-3

1. Speakers detail grid phone collapse (fix at bell, meta lane)
2. Speakers task-drill row column count (fix at bell, meta lane)
3. Contacts Pipeline dock — build using the established dock mechanism (engine, post-cut wave)
   CLOSED (wave 149, DEC-967 superseding the old no-dock DEVIATIONS entry):
   app/src/pages/contacts/PipelineBoard.tsx `<div className="chq-phone-dock" data-chq-phone-dock>`,
   with a companion comment naming the frame's dock band as replacing the
   head's own "Add to the pipeline" action at phone width.

## Notes

- Overview deadline stat-strip inner scroller is intentional (peek-next-card) — not a defect.
- Round-2's Wave-B tap-floor bullet mixed clusters; only the Content-tagged item was in Content scope (now fixed). Other clusters' tap floors verified separately in the Wave-B probe.
- 44×44 exact-minimum on Pipeline "Move ›" control — passes with zero margin; watch if the token changes.
