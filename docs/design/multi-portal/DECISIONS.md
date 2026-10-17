# Multi-portal: build decisions

Every place the build corrects the mock, fills a gap it left open, or makes a call it didn't. The mock is `Chautauqua Portals.dc.html` in this folder; the brief is `docs/design/briefs/multi-portal-brief.md`.

| # | Area | Decision | Why |
| --- | --- | --- | --- |
| 1 | Design files | The Portals frame lives in `docs/design/multi-portal/`, not beside the v12 frames. | The v12 campaign's pack-audit scans enumerate `docs/design/*.dc.html` and pin exact populations. This pack is verified by its own browser probe instead. |
