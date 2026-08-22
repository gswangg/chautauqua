# DEC-976 amendment: wave 27

Extracted verbatim from src/decisions-data/DEC-976.md (contention decomposition,
custodian task custodian-src_decisions_data_DEC_976_md) — no wording changed.
Referenced from the parent file's "## Amendment (wave 27)" section.

## Amendment (wave 27)

Four ledgers grade the words the pack draws, and the pack's uppercase micro-labels fall between all four. `test/frame-caption-ledger.scan.test.ts` excludes `text-transform:uppercase` by its own stated grammar (an eyebrow/label chip, not prose). `test/frame-control-label.scan.test.ts` and `test/desktop-control-label.scan.test.ts` key on control SHAPES (docked-footer regions, `<a min-height:44px>`, painted spans carrying min-height+border-radius+face) — a bare eyebrow span has none. The two field-label ledgers now in flight both require an input-shaped box (`border:1px solid #BAB6A6`) after the caption. 609 uppercase eyebrow spans exist in `docs/design/*.dc.html`; the ones with no input box after them — section eyebrows, table column heads, status micro-labels — are graded by no instrument at all, the same silence that let the Organiser divergence sit unmeasured. RULED: the drawn-eyebrow population is defined by construction as DISJOINT from all four existing ledgers — an uppercase-transform span inside a frame extent whose following markup carries no input-shaped box — so it can never duplicate a sibling ledger's rows; it is built for the PHONE (width:390) frame extents first, using the same derived `isPhone` split every ledger already uses, and it MEASURES and RATCHETS only, moving no product byte, with both ceilings seeded at their measured values and registered OUT_OF_CAMPAIGN_SCOPE. The desktop half is named as the next population, not smuggled into this one.
