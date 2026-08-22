# DEC-976 amendment: wave 32

Extracted verbatim from src/decisions-data/DEC-976.md (contention decomposition,
custodian task custodian-src_decisions_data_DEC_976_md) — no wording changed.
Referenced from the parent file's "## Amendment (wave 32)" section.

## Amendment (wave 32): a DEC_NNN registry constant is a mutable string, never the target of a text assertion

app/src/decision-constant-pin.scan.test.ts is red on two `expect(DEC_393).toMatch(...)` assertions in test/tap-floor-exempt-premise.scan.test.ts. The scan's own message states the reason and it is exactly DEC-967's standing lesson in constant form: the DEC_NNN entries in src/decisions.ts are overwritten wave over wave by the scribe, so a pin against one asserts nothing durable — it asserts whatever the last scribe run happened to leave there. RULED: assert the durable decision document instead, cited by DIRECTORY (src/decisions-data/DEC-393.md, or decisions/DEC-393.md — never the bare id, since two directories can collide on one DEC-NNN.md), matching the ruling sentence itself. The compile-checked `void DEC_393;` dependency marker idiom stays legal; only text/regex assertions against the constant are forbidden.
