# DEC-976 amendment: wave 24

Extracted verbatim from src/decisions-data/DEC-976.md (contention decomposition,
custodian task custodian-src_decisions_data_DEC_976_md) — no wording changed.
Referenced from the parent file's "## Amendment (wave 24)" section.

## Amendment (wave 24)

Task w24-c repaired all three named breakages, comments-only (desktop CSS declarations untouched, DEC-380 frozen):

1. `app/src/pages/overview/overview.css` — the `:79-87` citation now cites the single line the scan resolves (`:79`, whose literal it quotes: `grid-template-columns:1fr 1.15fr auto; gap:20px; align-items:baseline`); the `:220-224` citation, which a wrapped comment line was truncating to `:220-` before the scan's digit-blob match, now cites `:220` alone with its literal (`display:flex; align-items:baseline; justify-content:space-between; gap:10px`) quoted immediately after, and the original `220-224` range is kept as prose for the human reader.
2. `src/routes/portal/index.tsx:69` — reordered so the frame's own literal, `` `Two things to do` ``, is the FIRST backtick run after the `:420` citation; the `spellCount`/`capitalizeFirst` prose now follows the quote instead of sitting between the citation and it.
3. test/portal-desktop-frame-verdicts.test.ts:370, test/portal-desktop-frame-verdicts.test.ts:427, and app/src/pages/Submissions.desktop-frame-verdicts.render.test.tsx:302 (written as a plain list, never backtick-adjacent, so no coordinate can be misread as its neighbour's receipt quote) — each citation was reordered or its explanatory prose relocated so the receipting `verbatimLine(...)`/`expect(...)` call now lands within `EXPECT_PROXIMITY_LINES` (6) source lines beneath the citation, without duplicating or re-pointing any existing assertion. No test assertion was added, weakened, or moved out of order relative to the DOM/response it checks.

`DESKTOP_UNRECEIPTED_CLAIM_CEILING` and the two frame-citation-presence/truth checks all pass at their existing (unmoved) values; `npx vitest run app/src/frame-citation.scan.test.ts` is green (23/23).
