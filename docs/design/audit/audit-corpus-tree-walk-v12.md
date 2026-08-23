# Audit-corpus tree walk (DEC-967 wave-43, task w43-a)

Two citation enumerators over `docs/design/audit/` were single-level
`readdirSync` calls, invisible to anything under a subdirectory:
`test/decision-doc-citation.scan.test.ts`'s `auditDocFiles` and
`test/citation-form-drift/population.ts`'s `mdFilesIn`. Three sibling
instruments over the same corpus already recursed
(`test/open-divergence-ledger.scan.test.ts`, whose `AUDIT_FILE_FLOOR` IS the
recursive count; `test/audit-gap-row-staleness.scan.test.ts`, `recursive:
true`; `test/decision-path-references.scan.test.ts`,
`listMarkdownFilesRecursive`) — DEC-613's "second copy of a vocabulary"
shape, live: two enumerators disagreed with three siblings about what the
corpus IS.

`docs/design/audit/settings-v12/` is the one real subdirectory today (three
files, 244 lines): `w3-landing-drills.md`, `w10-frame-verdicts.md`,
`w3f-cfp-public-portal.md`.

## The fix

`test/citation-form-drift/population.ts`'s `mdFilesIn` now walks its
directory recursively and returns repo-relative paths (POSIX separators,
e.g. `settings-v12/w10-frame-verdicts.md`), matching its `namePattern`
against each file's own basename (never the full relative path), so a
directory-scoped pattern like `/^DEC-\d+\.md$/` still only matches files
literally named that way wherever they live. `test/decision-doc-citation.
scan.test.ts`'s `auditDocFiles` is retired outright in favor of importing
and calling this one shared helper (DEC-613: one implementation, not a
second, narrower copy) — its own `AUDIT_DOC_NAMES` and `AUDIT_ENTRIES`
derivations are otherwise unchanged.

Each instrument now also carries a non-vacuity tripwire asserting the
enumerated population contains `settings-v12/w10-frame-verdicts.md` — a
file only a recursive walk can reach — so a future regression to a flat
listing fails loudly instead of silently shrinking the population again.

`mdFilesIn` is also the helper `decisionsDataDir` and `probesDir` already
call inside `buildPopulationClasses`; both were re-verified to carry no
matching subdirectories today (`src/decisions-data/DEC-976/` holds only
`wave-*.md` files, which the `/^DEC-\d+\.md$/` name pattern does not match
regardless of depth; `docs/probes/` has no subdirectories), so recursing
those two changed nothing measurable.

## Re-measurement (forced to -1, offender list read back)

| Ratchet | Before | After | Note |
| --- | --- | --- | --- |
| `UNRESOLVED_CITATION_CEILING` (src/decisions-data/DEC-*.md, TIER2 gating) | 0 (ceiling) / 3 (measured, red) | 0 | Pre-existing drift in `DEC-967.md` itself, unrelated to the recursion: a stale deviations-ledger scan-test coordinate (that file has since shrunk to 400 lines via a custodian split) and a false receipt-quote pairing where the wave-43 ruling paragraph's own illustrative citation list, three bare path-plus-line examples written back to back each in its own backtick span, read each entry's neighbour as its receipt quote. Both repaired in the same commit — the stale coordinate converted to the drift-proof bare-path shape, quoting a stable literal instead of a line number; the illustrative list de-adjacented (backticks dropped from the three examples) so it no longer misreads as three chained citation-plus-quote pairs. |
| `WIDENED_UNRESOLVED_CITATION_CEILING` (widened population incl. audit/*, TIER2 gating) | 0 (ceiling) / 56 (measured, red) | 56 (unchanged) | Pre-existing, entirely unrelated to `settings-v12/` — none of the 56 offenders are in the newly-visible files (`tap-floor-exempt-premise-v12.md`, `inline-prose-exemption-v12.md`, `public-390-request-verdicts-v12.md`, `phone-hidden-container-v12.md`, `audit-handoff-staleness-v12.md`, `decision-path-references` desktop-eyebrow row). Verified red identically before this task's own edits (isolated via a clean-tree re-run against unmodified `HEAD`). Out of this task's scope — flagged, not repaired; a ~107-offender drain across five unrelated audit docs is not a 10-15 minute geometry/tree-walk slice. |
| `LINE_KEYED_CITATION_CEILING` (citation-form) | 0 (ceiling) / 51 (measured, red) | 51 (unchanged) | Same disposition as above: pre-existing, verified red identically before this task's edits, no offender from `settings-v12/`. |
| `DECISIONS_REGISTRY_CITATION_CEILING` (decisions/DEC-*.md) | 1228 | 1227 | Not part of the audit-dir recursion (decisions/ is a separate, already-flat population unaffected by this task's walk change). Re-measured because this task's own wave-43 amendment lands new prose in `decisions/DEC-967.md`; one unrelated row healed elsewhere in the tree, and the new amendment's own citation into the population module (drift-proof bare-path shape, quoting the shared helper's own name) resolves cleanly and adds no new offender. |
| `BACKTICK_PARITY_CEILING` | 4 | 4 (unchanged) | Population is `src/decisions-data/` and `decisions/` only, not `docs/design/audit/`; unaffected by the recursion fix. Re-verified still 4 (the same four pre-existing files) after this task's edits. |

## Six line-keyed citations named in this task's own filing

The task description named six illustrative offenders inside the three
`settings-v12/*.md` files: a bare App.tsx coordinate, two `Chautauqua
Settings.dc.html` frame coordinates, and two `app/src/pages/settings/
settings.css` coordinates. Measured against the actual tree: none of these
trip either citation ratchet as written. The two frame coordinates never
match `CITATION_RE`/`BARE_PATH_RE` at all — `.dc.html` is not in the
extension alternation (`tsx|css|ts|md`), the documented structural
carve-out for frame citations. The App.tsx and settings.css mentions in
`w3-landing-drills.md` and `w3f-cfp-public-portal.md` are either bare
mentions with no immediately-following backtick receipt quote (no
DIRECTION-2 check applies, and DIRECTION-1 resolves cleanly — both files
and both lines exist) or citations whose nearby quote sits outside the
25-character gap window this scan's `quoteAfter` enforces. Re-measured by
running the two owned scans against the tree with the recursion landed:
zero new offenders from `settings-v12/*.md` in either
`WIDENED_UNRESOLVED_CITATION_CEILING` or `LINE_KEYED_CITATION_CEILING`.
