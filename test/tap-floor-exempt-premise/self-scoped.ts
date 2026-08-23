// Contention decomposition (custodian, wave 44): the self-scoped tier,
// extracted verbatim from test/tap-floor-exempt-premise.scan.test.ts, no
// behavior change.
import type { Receipt, RosterRow } from "./receipts";
import { tokenReachesFloor } from "./css-grammar";

/** SELF-SCOPED tier (DEC-393 wave-40): a `scoped` reason that names only a
 * token already present in `receiptedClasses` (no DISTINCT companion) is
 * checked against the receipted selector's OWN classes -- not just the
 * self-named one, since a compound selector's OTHER class (e.g. `.chq-link-
 * button` alongside `.chq-detail-participant-row-actions`) may carry the
 * real floor elsewhere in the tree. VERIFIED the moment any receipted class
 * reaches the floor grammar and appears in real markup; otherwise REFUTED
 * to FALSE-PREMISE -- not silently accepted -- when none of them declare a
 * floor anywhere. */
export function judgeSelfScoped(receipt: Receipt, allChunks: Array<{ selector: string; body: string }>, allText: string): RosterRow {
  for (const token of receipt.receiptedClasses) {
    const { floored, ruleCount } = tokenReachesFloor(token, allChunks);
    const present = new RegExp(`\\b${token}\\b`).test(allText);
    if (floored && present) {
      return {
        ...receipt,
        verdict: "VERIFIED",
        detail: `self-scoped tier: the receipted selector's own class .${token} declares the 44px floor (merged across ${ruleCount} rule(s)) and appears in real markup`,
      };
    }
  }
  return {
    ...receipt,
    verdict: "FALSE-PREMISE",
    detail: `self-scoped tier: none of the receipted selector's own classes (${receipt.receiptedClasses.map((c) => `.${c}`).join(", ")}) declare a 44px floor anywhere in the tree -- REFUTED, not silently accepted`,
  };
}
