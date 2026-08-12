# MANDATE — stress test at AI Engineer scale (user-mandated 2026-08-12)

The customer behind this competition runs AI Engineer — thousands of attendees, hundreds
of sessions, a CFP that draws four figures of submissions. The demo seed (47 submissions,
318 contacts) proves nothing about that world. **Both the functionality and the design
must hold up at their scale.** Existing infra to build on: `scripts/perf-seed.ts` +
`npm run perf:smoke` (currently 2k rows), the walkthrough "scale" module, and
`gate:render-sweep`.

## Scale targets (one seeded profile, `perf-seed --profile=aie`)

- 2,500 submissions across 20 tracks (weighted statuses: ~10% accepted)
- 600 speakers / 6,000 contacts (with realistic duplicate clusters — 5% dupes)
- 280 accepted sessions over 4 days × 10 rooms; ≥12 deliberate conflicts
- 3 review plans × 15 reviewers; ≥5,000 review assignments
- 400 speaker tasks, ~15% overdue; files: 800 objects, mixed sizes to 40 MB
- Comms history: 50 sends, largest to 1,000 recipients (exercises the 100-batch chunking)

## Functional bars (all measured against the aie profile, local + one spot-check on prod)

- SPEC budgets hold: p95 reads <50ms, writes <100ms at this volume (perf:smoke extended
  to the hot list endpoints: submissions, contacts, duplicates, agenda, overview).
- `contacts/duplicates` grouping stays sub-second at 6,000 contacts (it is O(n) hashing —
  verify, don't assume).
- Bulk status over 500 selected submissions completes, chunked at 100, with the committed
  batches never visually rolling back (DEC-193).
- Auto-schedule over ~320 candidate sessions completes and reports per-item reasons
  (steal-mandate §1) without timeout.
- Reminders endpoint at 400 tasks respects the 100-contact cap and reports
  {sent, skipped, remaining} honestly.
- Overview repo queries stay capped (ROW_CAP) — the page must not fetch 2,500 rows.

## Design-at-scale bars (render-sweep + eyeball pass against the aie profile)

The mocks show 3–8 rows; production paginates at 25–50. At scale:

- Every list paginates; no unpaginated surface renders thousands of DOM rows (jank).
- Capped worklists (Overview sections) show the cap honestly: "N more · open the tab".
- The agenda grid at 10 rooms × 4 days stays legible and scrollable in its own container
  (design rule: wide content scrolls, the page never scrolls horizontally); the phone
  one-room view paginates rooms.
- Long real-world titles (120+ chars), long names, and 20 tracks don't break row grids,
  chips, or the nav (truncation per copy rules — counts and nouns, no mid-word overflow).
- Duplicates view groups render bounded (worst seeded cluster ≈ 8 contacts).
- Search/filter on the 2,500-row submissions table responds keystroke-fast (server-side
  query, not client filter over the full set).
- `gate:render-sweep` runs green against the aie profile — every route, both widths,
  zero console errors, no cell overflow assertions where the sweep can check them.

## Deliverable

A `stress` module in the walkthrough (or a `gate:scale` script) that seeds the aie
profile and asserts the functional bars, plus a screenshot set of the dense surfaces
(submissions, agenda, contacts, duplicates, overview) for the design eyeball pass.
Record results honestly in AUDIT.md — including anything that had to be capped or
degraded to hold the budgets.
