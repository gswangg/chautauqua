// DEC-559: the ONE shared portal-link resolver — moved verbatim out of
// src/routes/comms.ts so J6 reminder sends (src/server/repo/tasks/
// reminders.ts) and comms compose sends resolve a recipient's portal link
// through the same code path instead of two drifting copies.

import { createClaimToken, type KVStore } from "../../auth/claim";
import { PREVIEW_CLAIM_TOKEN } from "../../domain/compose";

/** portal_link (DEC-014/DEC-019): /portal when a user exists for the
 * contact's email, else a claim link. DEC-397 (preview never mints
 * credentials): when mintClaimTokens is false, a userless contact resolves
 * to the fixed PREVIEW_CLAIM_TOKEN placeholder with zero KV writes instead
 * of a freshly minted token. `userId` is looked up once per recipient set
 * (DEC-530: batched via repo.findAccountUserIds) and passed in rather than
 * re-queried per recipient here — claim-token minting itself stays
 * per-recipient (DEC-397: a KV write with real side effects). */
export async function resolvePortalLink(
  kv: KVStore,
  contactId: string,
  eventId: string,
  userId: string | null,
  origin: string,
  mintClaimTokens: boolean,
): Promise<string> {
  if (userId) return `${origin}/portal`;
  if (!mintClaimTokens) return `${origin}/claim/${PREVIEW_CLAIM_TOKEN}`;
  const token = await createClaimToken(kv, { contactId, eventId });
  return `${origin}/claim/${token}`;
}
