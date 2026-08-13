// DEC-559: the ONE shared portal-link resolver — moved verbatim out of
// src/routes/comms.ts so J6 reminder sends (src/server/repo/tasks/
// reminders.ts) and comms compose sends resolve a recipient's portal link
// through the same code path instead of two drifting copies.

import { createClaimToken, type KVStore } from "../../auth/claim";
import { DEC_530 } from "../../decisions";
import { PREVIEW_CLAIM_TOKEN } from "../../domain/compose";

void DEC_530;

/** portal_link (DEC-014/DEC-019): /portal when a user exists for the
 * contact's email, else a claim link. DEC-397 (preview never mints
 * credentials): when mintClaimTokens is false, a userless contact resolves
 * to the fixed PREVIEW_CLAIM_TOKEN placeholder with zero KV writes instead
 * of a freshly minted token. `userId` is looked up once per recipient set
 * (DEC-530: batched via repo.findAccountUserIds) and passed in rather than
 * re-queried per recipient here — claim-token minting itself stays
 * per-recipient (DEC-397: a KV write with real side effects), but DEC-530's
 * wave-42 amendment requires the whole recipient set's minting to run
 * concurrently rather than as N sequential awaits: see resolvePortalLinks. */
export async function resolvePortalLink(
  kv: KVStore,
  contactId: string,
  eventId: string,
  userId: string | null,
  origin: string,
  mintClaimTokens: boolean,
): Promise<string> {
  const map = await resolvePortalLinks(kv, [{ contactId, userId }], eventId, origin, mintClaimTokens);
  const link = map.get(contactId);
  if (!link) throw new Error(`resolvePortalLinks produced no link for contactId ${contactId}`);
  return link;
}

/** Batch form of resolvePortalLink (DEC-530 wave-42 amendment): dedupes by
 * contactId (a co-speaker on multiple submissions appears once) and mints
 * the claim tokens the userless recipients need through a single
 * Promise.all instead of sequential awaits, so a 100-recipient send pays
 * one round of concurrent KV writes rather than up to 100 serial ones.
 * Recipients with an account (userId set) or with mintClaimTokens=false
 * never touch KV — same zero-write PREVIEW_CLAIM_TOKEN branch as the
 * single-recipient reader. Returns contactId -> link for every recipient
 * given (deduped), so both entry points must produce identical links for
 * identical input (contract-tested). */
export async function resolvePortalLinks(
  kv: KVStore,
  recipients: { contactId: string; userId: string | null }[],
  eventId: string,
  origin: string,
  mintClaimTokens: boolean,
): Promise<Map<string, string>> {
  const byContactId = new Map<string, string | null>();
  for (const r of recipients) {
    byContactId.set(r.contactId, r.userId);
  }

  const result = new Map<string, string>();
  const toMint: string[] = [];
  for (const [contactId, userId] of byContactId) {
    if (userId) {
      result.set(contactId, `${origin}/portal`);
    } else if (!mintClaimTokens) {
      result.set(contactId, `${origin}/claim/${PREVIEW_CLAIM_TOKEN}`);
    } else {
      toMint.push(contactId);
    }
  }

  const minted = await Promise.all(
    toMint.map(async (contactId) => {
      const token = await createClaimToken(kv, { contactId, eventId });
      return [contactId, token] as const;
    }),
  );
  for (const [contactId, token] of minted) {
    result.set(contactId, `${origin}/claim/${token}`);
  }

  return result;
}
