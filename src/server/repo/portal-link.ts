// DEC-559: the ONE shared portal-link resolver — moved verbatim out of
// src/routes/comms.ts so J6 reminder sends (src/server/repo/tasks/
// reminders.ts) and comms compose sends resolve a recipient's portal link
// through the same code path instead of two drifting copies.

import { createClaimToken, type KVStore } from "../../auth/claim";
import { DEC_530 } from "../../decisions";
import { PREVIEW_CLAIM_TOKEN } from "../../domain/compose";

void DEC_530;

/** The ONE portal_link resolver (DEC-014/DEC-019): /portal when a user
 * exists for the contact's email, else a claim link. DEC-397 (preview never
 * mints credentials): when mintClaimTokens is false, a userless contact
 * resolves to the fixed PREVIEW_CLAIM_TOKEN placeholder with zero KV writes.
 * DEC-530 wave-42/wave-46 amendments: every caller (comms compose,
 * content-notes, contacts bulk-email, task reminders) resolves its whole
 * recipient set through this ONE batched call — dedupes by contactId (a
 * co-speaker on multiple submissions appears once) and mints the claim
 * tokens the userless recipients need through a single Promise.all instead
 * of sequential awaits, so a 100-recipient send pays one round of
 * concurrent KV writes rather than up to 100 serial ones. Recipients with
 * an account (userId set) or with mintClaimTokens=false never touch KV.
 * Returns contactId -> link for every recipient given (deduped). There is
 * no single-recipient wrapper — a caller with one recipient passes a
 * one-element array. */
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

/** DEC-397 wave-50 amendment (MINT LATE): overwrites vars.portal_link on
 * already-built render targets with REAL minted links, in place, after
 * preflightRender has already accepted the batch built with
 * mintClaimTokens=false. Mints once via a single resolvePortalLinks call
 * (still one batched Promise.all of KV writes) rather than per-target. */
export async function applyMintedPortalLinks(
  kv: KVStore,
  recipients: { contactId: string; userId: string | null }[],
  eventId: string,
  origin: string,
  targets: { contactId: string; vars: Record<string, string> }[],
): Promise<void> {
  const portalLinkMap = await resolvePortalLinks(kv, recipients, eventId, origin, true);
  for (const target of targets) {
    const portalLink = portalLinkMap.get(target.contactId);
    if (!portalLink) throw new Error(`no portal link resolved for contactId ${target.contactId}`);
    target.vars.portal_link = portalLink;
  }
}
