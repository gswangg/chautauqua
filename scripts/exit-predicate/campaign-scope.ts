// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate.ts (custodian decomposition,
// contention-hotspot split -- NO behavior change; see that file's header
// for the module's overall shape). Pure data: the three lists that
// classify every `*_CEILING`/`*_FLOOR` ratchet constant declared anywhere
// in the tree as graded-and-gating (CAMPAIGN_CONSTANT_NAMES /
// TIER2_CEILING_NAMES) or deliberately excused
// (OUT_OF_CAMPAIGN_SCOPE), consumed by scripts/exit-predicate/campaign.ts's
// grading functions.
//
// wave-44 (task custodian-scripts_exit_predicate_campaign_scope_ts):
// this file itself was a merge-conflict hotspot four times over -- every
// wave that appended a new CAMPAIGN_CONSTANT_NAMES entry, a new
// TIER2_CEILING_NAMES entry and a new OUT_OF_CAMPAIGN_SCOPE entry in the
// same commit collided with every OTHER wave doing the same, because all
// three lists lived in one file. It is now a barrel: each of the four
// exported members lives in its own file under ./campaign-scope/, so an
// edit that only appends to OUT_OF_CAMPAIGN_SCOPE (the single most
// frequently touched member, per the field guide) no longer conflicts with
// an edit that only appends to CAMPAIGN_CONSTANT_NAMES or
// TIER2_CEILING_NAMES. NO BEHAVIOR CHANGE: every symbol this file used to
// export is still exported from this exact path, with the exact same
// name, type and value -- only the storage location moved. Every existing
// import of "./campaign-scope" / "../scripts/exit-predicate/campaign-scope"
// keeps working unchanged.
export { CAMPAIGN_CONSTANT_NAMES } from "./campaign-scope/campaign-constant-names";
export { TIER2_CEILING_NAMES } from "./campaign-scope/tier2-ceiling-names";
export { OUT_OF_CAMPAIGN_SCOPE } from "./campaign-scope/out-of-campaign-scope";
export {
  type ParkedFidelityPromise,
  PARKED_FIDELITY_PROMISES,
} from "./campaign-scope/parked-fidelity-promises";
