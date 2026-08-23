// DEC-393 wave-54 clause (task w54-g): the SELF-FLOORED tier, ported from
// this instrument's sibling (test/inline-prose-exemption-premise.scan.test.ts's
// `selfFloored`, DEC-393 wave-52 amendment). A receipt whose OWN
// `receiptedClasses` tokens -- merged across every rule in the swept corpus
// that mentions them, the same merge idiom `tokenReachesFloor` already
// exposes for `judgeSelfScoped` (DEC-613: never a second copy of the merge
// logic) -- already satisfy the full 44px-floor grammar needs no companion's
// testimony at all. Consulted BEFORE the companion search and before the
// generic "no companion class named in the reason" fallthrough, for every
// family that reaches that fallthrough (`composition`/`inline`/`modifier`;
// `other` and `render-gate` are dispatched earlier in `judgeReceipt` and
// never reach here; `scoped` is dispatched to `judgeSelfScoped`, which
// already performs this same self-token check -- plus a present-in-markup
// requirement the wave-52 inline sibling's rung 0 does not impose, so this
// port stays faithful to that sibling rather than re-deriving a stricter
// rule).
import type { Receipt, RosterRow } from "./receipts";
import { tokenReachesFloor } from "./css-grammar";

export function judgeSelfFloored(
  receipt: Receipt,
  allChunks: Array<{ selector: string; body: string }>,
): RosterRow | null {
  for (const token of receipt.receiptedClasses) {
    const { floored, ruleCount } = tokenReachesFloor(token, allChunks);
    if (floored) {
      return {
        ...receipt,
        verdict: "VERIFIED",
        detail: `self-floored tier: own receipted class .${token} satisfies the 44px-floor grammar (min-height:44px + centred flex + non-zero horizontal padding, or the replaced-content width/height tier), merged across ${ruleCount} rule(s) in the swept corpus -- no companion needed (DEC-393 wave-54 amendment)`,
      };
    }
  }
  return null;
}
