// DEC-069 wave-116+ campaign exit predicate: constant-name REGISTRIES.
//
// Extracted from scripts/exit-predicate/campaign-scope.ts (custodian
// decomposition, contention-hotspot split -- NO behavior change; see that
// file's header for the module's overall shape and
// scripts/exit-predicate.ts's header for the top-level decomposition this
// nests under). This file holds only OUT_OF_CAMPAIGN_SCOPE; its siblings
// (CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES,
// ParkedFidelityPromise/PARKED_FIDELITY_PROMISES) live in their own files
// beside it, all re-exported from campaign-scope.ts so every existing
// import path keeps working unchanged.
//
// This is the file the field guide notes as the append-at-map-end
// contention hotspot for new OUT_OF_CAMPAIGN_SCOPE entries; isolating it
// from its two sibling name lists means a new entry here no longer
// conflicts with an unrelated edit to CAMPAIGN_CONSTANT_NAMES or
// TIER2_CEILING_NAMES in the same wave.
//
// wave-56 (task custodian-scripts_exit_predicate_campaign_scope_out_of_
// campaign_scope_ts): this file itself became a four-time merge-conflict
// hotspot -- every wave that appended a new OUT_OF_CAMPAIGN_SCOPE entry
// collided with every OTHER wave doing the same, because all ~55 entries
// lived in one flat object literal. It is now a barrel over five thematic
// partials under this same directory (instrument-completeness,
// test-instrument-soundness, pack-vocabulary, mobile-population,
// security-request-hygiene); a wave adding an entry now picks the file
// matching its entry's own topic, which conflicts only with another wave
// touching that SAME topic, not with every other OUT_OF_CAMPAIGN_SCOPE
// edit in the tree. NO BEHAVIOR CHANGE: OUT_OF_CAMPAIGN_SCOPE still holds
// the exact same keys with the exact same string values -- only the
// storage location moved.

import { INSTRUMENT_COMPLETENESS_OUT_OF_SCOPE } from "./instrument-completeness-ceilings";
import { TEST_INSTRUMENT_SOUNDNESS_OUT_OF_SCOPE } from "./test-instrument-soundness-ceilings";
import { PACK_VOCABULARY_OUT_OF_SCOPE } from "./pack-vocabulary-ceilings";
import { MOBILE_POPULATION_OUT_OF_SCOPE } from "./mobile-population-ceilings";
import { SECURITY_REQUEST_HYGIENE_OUT_OF_SCOPE } from "./security-request-hygiene-ceilings";

/**
 * Names that match the `<NAME>_CEILING` / `<NAME>_FLOOR` (or bare `CEILING`)
 * shape in the real corpus but are deliberately NOT part of the v12 mobile
 * campaign's own exit predicate. Each value is a PRINCIPLE -- a fact about
 * what the constant measures that stays true with every branch name and
 * wave number deleted (DEC-099's shape) -- never a schedule note ("later
 * wave", "in flight", a branch token). `assertCampaignPopulationTotal`
 * treats any candidate name here, or in `CAMPAIGN_CONSTANT_NAMES`, as
 * accounted for; anything else is an ungraded ratchet and throws.
 */
export const OUT_OF_CAMPAIGN_SCOPE: Record<string, string> = {
  ...INSTRUMENT_COMPLETENESS_OUT_OF_SCOPE,
  ...TEST_INSTRUMENT_SOUNDNESS_OUT_OF_SCOPE,
  ...PACK_VOCABULARY_OUT_OF_SCOPE,
  ...MOBILE_POPULATION_OUT_OF_SCOPE,
  ...SECURITY_REQUEST_HYGIENE_OUT_OF_SCOPE,
};
