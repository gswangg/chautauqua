// Frame caption/consequence ledger -- RATCHET module (DEC-976 wave-133;
// split from test/frame-caption-ledger.scan.test.ts by the
// contention-custodian decomposition, no behaviour change).
//
// FRAME_CAPTION_UNMATCHED_CEILING is scripts/exit-predicate.ts's own
// campaign constant (CAMPAIGN_CONSTANT_NAMES/TIER2_CEILING_NAMES): that
// script scans `git ls-files -- test app/src scripts` for a literal
// `export const FRAME_CAPTION_UNMATCHED_CEILING = <int>;` line, so this
// declaration must remain the ONLY file in that tree carrying that exact
// literal form (a re-export elsewhere is a different syntax shape and does
// not match its regex). Isolated into its own file because every worker
// re-measuring the ratchet touches only this constant and its history
// comment, not the population/exclusion/match machinery above it.

// -- Ratchet -------------------------------------------------------------
// Three lanes measured this ratchet independently against the same
// 233-caption / 13-frame-file population (>= 20 chars, no digit, no `@`, not
// text-transform:uppercase), each excluding a DIFFERENT slice:
//   - v12m-w10-dd: +17 FIXTURE rows                          -> 54 unmatched
//   - v12m-w10-cc: +&apos;/&rsquo;/&lsquo; in ENTITY_MAP (retiring the
//     BreaksPanel/EmbedsPanel `day&apos;s`/`embed&apos;s` false offenders),
//     +10 EXPLAINER, +5 EXEMPLAR ARTICLE                     -> 53 unmatched
//   - v12m-w10-ee: +11 COMPOSED (a fourth named class)       -> 59 unmatched
// All four exclusion tables and the widened ENTITY_MAP are live here and
// CAPTIONS_AFTER_EXCLUSION subtracts every one of them, so the megabatch
// figure is the UNION's -- at or below the lowest single-lane measurement.
// Re-measured against this tree. May only be RAISED as a merge-train act if a
// future predicate widening surfaces more real divergences, and should be
// LOWERED as sibling lanes close real caption/consequence gaps.
// Merge-train act (thunderdome megabatch): measured at 24 against the
// integrated tree -- the union of all four exclusion tables plus the widened
// ENTITY_MAP subtracts far more than any single lane could see from its own
// base (54/53/59). A LOWERING from main's 70, as the ratchet requires.
// Merge-train act (thunderdome medic, post-megabatch): the 24 above was
// still 2 above what the integrated tree actually measures -- 22. The
// two-sided ratchet caught the gap, as designed; lowered to the measured
// figure so the ceiling cannot license stagnation.
//   - v12m-w10-gg: +12 COMPOSED (reader-facing clusters: Contacts, Public
//     and Portal, Review) and one BUILD (Contacts.dc.html:834's DEC-597
//     exclusion instead of an unmatched row is folded into the same
//     COMPOSED count; the frame's genuinely-absent per-pair reason at
//     Contacts.dc.html:159 and the "check spam" line at Public and
//     Portal.dc.html:1084 -- ruled buildable by DEC-380 rather than
//     BLESSED/DEFERRED, see this commit's body -- both exit the residue by
//     being built, not by an exclusion-table entry) -> 10 unmatched.
// Thunderdome megabatch reconciliation: main's medic had measured 22 against
// a tree WITHOUT v12m-w10-gg's 12 COMPOSED exclusions and 2 built captions;
// w10-gg measured 10 against a tree without the medic's other lanes. The
// integrated figure is re-measured below by this file's own two-sided
// ratchet, which prints the exact count on either breach.
//   - v12m-w13-gg (DEC-967 sighting #16): the corpus predicate itself was
//     wrong -- enumerateSourceFiles admitted src/decisions-data/**, so a
//     DEC_NNN ruling QUOTING a caption counted as the app rendering it. That
//     repair (isDecisionRegistryFile, live above) un-launders ~11 rows and
//     RAISES the count; w13-gg measured 32 from its own base. A raise here is
//     legitimate under the ratchet's own terms: it is a predicate WIDENING
//     surfacing real divergences that were previously hidden, not a
//     regression in coverage.
// v12m-w14-bb (task w14-bb): the 22 above was a CORPUS-BLIND figure -- this
// ledger's private enumerateSourceFiles skipped `.test.` paths but never
// excluded the decision registry (src/decisions-data/**, src/decisions.ts),
// so eleven captions read BUILT only because a DEC_NNN string constant or a
// DEC-NNN.md amendment quotes them verbatim (DEC-967/DEC-613 wave-138).
// Repaired by importing test/frame-source-corpus.ts's isDecisionRegistryFile
// predicate into this ledger's own enumerator (sharing the PREDICATE, not
// the enumerator -- this ledger's corpus still reaches .md, which that
// module's own isSourceFile does not). Forcing the ceiling to -1 against the
// repaired corpus measured 33 unmatched; two rows were then disposed of by
// this same task -- "If it hasn't arrived, check spam." (DEC-380 wave-137)
// built verbatim in src/routes/public/submit-views.tsx on the
// emailDelivered branch, and the co-presenter caption
// (Chautauqua Submissions.dc.html:298) moved into the new SUPERSEDED
// exclusion class (DEC-380 wave-139, correcting wave-137's own contrary
// ruling on that one row). Re-measured against the repaired corpus with both
// dispositions applied: 31. A RAISE from 22 -- corpus repairs move unmatched
// in the fix-me direction ONLY, never hide a real offender (DEC-976
// wave-138: a corpus repair re-seeds in the repairing commit and that is a
// repair, not a raise).
// RATCHET: FRAME_CAPTION_UNMATCHED_CEILING=31
// Thunderdome megabatch: 31 is w14-bb's figure, measured WITHOUT w10-gg's 12
// COMPOSED exclusions, which are also in this batch and push the count down
// again. The integrated figure is whatever the two-sided ratchet below prints
// on breach; it is re-seeded to that measurement, never guessed.
// Thunderdome megabatch re-measurement on the integrated tree: 17. Lower
// than w14-bb's 31 because w10-gg's 12 COMPOSED exclusions and w12-ff's
// builds are also in this batch; higher than w10-gg's 10 because the
// decision-registry corpus repair un-laundered rows both lanes had hidden.
export const FRAME_CAPTION_UNMATCHED_CEILING = 17;
