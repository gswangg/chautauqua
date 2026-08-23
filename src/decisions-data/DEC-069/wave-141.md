## Amendment (wave 141): A report row lands with its fixture, and no verdict prints DONE without a suite-verified ancestor

`buildCampaignReport` now emits 25 rows (the `CODE_COMMENT_CITATION_CEILING` row landed) against a fixture asserting 24, and the `formatCampaignReport` invariant "no DONE anywhere when suiteVerifiedAtSha is null" — added in w14-aa precisely to stop the campaign printing DONE over a red tree — is red again. The exit predicate is the campaign's only exit gate; a stale fixture beside a failing honesty invariant is the costliest possible failure mode. RULED: a row added to the campaign report lands with its fixture entry in the SAME commit; the fixture asserts an explicit count, never a `.length` self-comparison (the bound must never BE the measurement); and the no-DONE-without-verified-ancestor invariant carries a fixture-driven negative control that proves the token is absent from every line, row labels included.


