// Contacts/CRM domain core (J11), pure module per DEC-002.
// No node:/cloudflare imports — Web APIs only.
//
// Part of the contacts.ts decomposition (structure custodian): merge
// planning (planMerge, mergedInviteStatus, mergedParticipantVisible,
// previewMerge). src/domain/contacts.ts re-exports everything here; import
// from that barrel, not this file, outside of the contacts-parts/* sibling
// modules themselves.

import { ACTIVE_INVITE_STATUSES } from "../acceptance";
import { contactLabels, RESERVED_CUSTOM_FIELD_KEYS } from "../contact-labels";
import type { ContactRecord, SocialLinks } from "./types";
import { fullName } from "./types";

const RESERVED_CUSTOM_FIELD_KEY_SET: Set<string> = new Set(Object.values(RESERVED_CUSTOM_FIELD_KEYS));

export interface MergePlan {
  merged: ContactRecord;
  duplicateId: string;
}

/**
 * Pure descriptor for merging duplicate into primary: primary wins on every
 * field; blank/missing primary fields are filled from duplicate; customFields
 * are unioned with primary taking precedence on key collisions. Does not
 * touch the database — repointing participant/submission/task_assignment/
 * email_log rows to primary.id is wave-3 wiring.
 *
 * DEC-167: primary wins are still fill-if-blank for phone/bio/headshotUrl,
 * socialLinks are filled per-key (each of twitter/linkedin/github/website
 * independently falls back to duplicate's value when primary's is blank),
 * and notes are never silently dropped — primary's notes are kept, with
 * duplicate's notes appended after a '\n\n---\n\n' separator when duplicate
 * has non-blank notes that differ from primary's (so duplicate-only notes
 * always survive the merge instead of being destroyed).
 */
export function planMerge(primary: ContactRecord, duplicate: ContactRecord): MergePlan {
  const fill = (primaryVal: string | undefined, dupVal: string | undefined): string | undefined => {
    if (primaryVal !== undefined && primaryVal.trim() !== "") return primaryVal;
    return dupVal;
  };

  const merged: ContactRecord = {
    id: primary.id,
    email: fill(primary.email, duplicate.email) ?? "",
    firstName: fill(primary.firstName, duplicate.firstName) ?? "",
    lastName: fill(primary.lastName, duplicate.lastName) ?? "",
  };

  const company = fill(primary.company, duplicate.company);
  if (company !== undefined) merged.company = company;

  const title = fill(primary.title, duplicate.title);
  if (title !== undefined) merged.title = title;

  const phone = fill(primary.phone, duplicate.phone);
  if (phone !== undefined) merged.phone = phone;

  const bio = fill(primary.bio, duplicate.bio);
  if (bio !== undefined) merged.bio = bio;

  const headshotUrl = fill(primary.headshotUrl, duplicate.headshotUrl);
  if (headshotUrl !== undefined) merged.headshotUrl = headshotUrl;

  if (primary.socialLinks !== undefined || duplicate.socialLinks !== undefined) {
    const keys: (keyof SocialLinks)[] = ["twitter", "linkedin", "github", "website"];
    const socialLinks = {} as SocialLinks;
    for (const key of keys) {
      socialLinks[key] = fill(primary.socialLinks?.[key], duplicate.socialLinks?.[key]) ?? "";
    }
    merged.socialLinks = socialLinks;
  }

  const primaryNotes = primary.notes?.trim() ?? "";
  const duplicateNotes = duplicate.notes?.trim() ?? "";
  if (duplicateNotes !== "" && duplicateNotes !== primaryNotes) {
    merged.notes = primaryNotes !== "" ? `${primaryNotes}\n\n---\n\n${duplicateNotes}` : duplicateNotes;
  } else if (primaryNotes !== "") {
    merged.notes = primaryNotes;
  }

  const customFields = { ...(duplicate.customFields ?? {}), ...(primary.customFields ?? {}) };
  if (Object.keys(customFields).length > 0) merged.customFields = customFields;

  return { merged, duplicateId: duplicate.id };
}

// invite_status's full vocabulary is 'none' | 'invited' | 'accepted' |
// 'declined' (DEC-003); 'accepted'/'none' are restated here from
// ACTIVE_INVITE_STATUSES (src/domain/acceptance.ts) rather than a second,
// independently-typed literal union so the two modules can't drift.
const [INVITE_STATUS_NONE, INVITE_STATUS_ACCEPTED] = ACTIVE_INVITE_STATUSES;
const INVITE_STATUS_RANK: Record<string, number> = {
  [INVITE_STATUS_ACCEPTED]: 3,
  declined: 2,
  invited: 1,
  [INVITE_STATUS_NONE]: 0,
};

// Wave-39 (DEC-020 amendment): INVITE_STATUS_RANK is a plain object literal
// — `INVITE_STATUS_RANK[x]` for a prototype key like `constructor` returns a
// function, so the `?? -1` fallback never fires and the doc-promised "ranks
// lowest" guarantee breaks. Own-property lookup only, matching
// src/domain/files.ts's allowedContentType shape.
function lookupInviteStatusRank(status: string): number | null {
  return Object.prototype.hasOwnProperty.call(INVITE_STATUS_RANK, status)
    ? INVITE_STATUS_RANK[status]!
    : null;
}

/**
 * DEC-282 amendment: picks the surviving participant.inviteStatus when both
 * contacts being merged are participants on the same submission. Rank
 * accepted(3) > declined(2) > invited(1) > none(0) so a genuine acceptance is
 * never silently discarded by merging the accepted duplicate into a keeper
 * that only got as far as 'declined' or 'invited' — max wins. An unrecognized
 * literal ranks lowest (below 'none') and can never displace a known
 * status; ties keep `a` (the kept contact's own value).
 */
export function mergedInviteStatus(a: string, b: string): string {
  const rankA = lookupInviteStatusRank(a) ?? -1;
  const rankB = lookupInviteStatusRank(b) ?? -1;
  return rankB > rankA ? b : a;
}

/**
 * DEC-282 amendment: picks the surviving participant.visible flag when both
 * contacts being merged are participants on the same submission — logical
 * OR, so merging a publicly-visible duplicate into a keeper that was hidden
 * never silently pulls the merged person out of public visibility.
 */
export function mergedParticipantVisible(a: boolean, b: boolean): boolean {
  return a || b;
}

export interface MergeFieldPreview {
  key: string;
  label: string;
  kept: string;
  discarded: string[];
  outcome: "keep" | "fill" | "append" | "combine";
}

const MERGE_PREVIEW_STANDARD_FIELDS: { key: "email" | "company" | "title" | "phone" | "bio"; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "phone", label: "Phone" },
  { key: "bio", label: "Bio" },
];

// DEC-748 amendment (wave 2): the six identity rows a merge preview ALWAYS
// shows, in this fixed order, regardless of whether the fields actually
// differ -- a pair identical in every field still shows all six ('keep',
// empty discarded). Name folds firstName+lastName to one row (no separate
// First/Last rows); Labels folds every customFields.* key through
// contactLabels (src/domain/contact-labels.ts) into one row -- no raw
// customFields.* row reaches the client any more.
const MERGE_PREVIEW_IDENTITY_FIELDS: { key: "name" | "email" | "company" | "title" | "labels" | "notes"; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "labels", label: "Labels" },
  { key: "notes", label: "Notes" },
];

/**
 * DEC-705: pure preview of what mergeContacts will actually write, computed
 * by folding planMerge over `duplicates` in the exact same order the repo's
 * mergeOnePair chain does (primary, then each duplicate in turn, survivor
 * becoming the next primary) -- this is the ONLY place that reasons about
 * merge rules besides planMerge itself; it never re-derives them.
 *
 * DEC-748 amendment (wave 2): the FIRST SIX entries returned are always, in
 * fixed order, Name/Email/Company/Title/Labels/Notes -- present even when
 * nothing differs (outcome 'keep', discarded []). Any other differing field
 * (Phone, Bio) follows after, in the order it's declared above.
 *
 * `kept` is the field's final value after every fold; `discarded` collects
 * the distinct dropped values (never populated for 'fill'/'append'/'combine'
 * -- nothing is lost there, it's incorporated into `kept`, not thrown away).
 * A duplicate with a BLANK value against a non-blank primary field still
 * discards "" rather than being silently skipped -- only truly identical
 * values (dupVal === beforeVal, including both blank) leave no trace.
 */
export function previewMerge(primary: ContactRecord, duplicates: ContactRecord[]): MergeFieldPreview[] {
  const outcomeByKey = new Map<string, MergeFieldPreview["outcome"]>();
  const discardedByKey = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();

  let survivor = primary;
  for (const duplicate of duplicates) {
    const before = survivor;
    const { merged } = planMerge(before, duplicate);

    // Name: firstName+lastName folded to one row (DEC-748 amendment).
    labelByKey.set("name", "Name");
    const beforeName = fullName(before);
    const dupName = fullName(duplicate);
    if (dupName !== beforeName) {
      if (beforeName === "") {
        if (!outcomeByKey.has("name")) outcomeByKey.set("name", "fill");
      } else {
        outcomeByKey.set("name", "keep");
        const list = discardedByKey.get("name") ?? [];
        if (!list.includes(dupName)) list.push(dupName);
        discardedByKey.set("name", list);
      }
    }

    for (const { key, label } of MERGE_PREVIEW_STANDARD_FIELDS) {
      labelByKey.set(key, label);
      const beforeVal = (before[key] ?? "").trim();
      const dupVal = (duplicate[key] ?? "").trim();
      if (dupVal === beforeVal) continue;
      if (beforeVal === "") {
        // dupVal is non-blank here (dupVal !== beforeVal === "")
        if (!outcomeByKey.has(key)) outcomeByKey.set(key, "fill");
      } else {
        // beforeVal survives whether dupVal is blank or a differing value --
        // either way the duplicate's side is discarded (DEC-748: a blank
        // dupVal is discarded too, as "").
        outcomeByKey.set(key, "keep");
        const list = discardedByKey.get(key) ?? [];
        if (!list.includes(dupVal)) list.push(dupVal);
        discardedByKey.set(key, list);
      }
    }

    // Notes: DEC-167 always appends duplicate-only notes text onto the
    // running primary's notes rather than filling/discarding, whether or
    // not the primary already had notes of its own. DEC-802: the Notes row
    // is shown whenever either side has notes at all, even when the
    // duplicate contributes nothing (a keeper-only note must still be
    // visible in the preview).
    labelByKey.set("notes", "Notes");
    const beforeNotes = (before.notes ?? "").trim();
    const dupNotes = (duplicate.notes ?? "").trim();
    if (dupNotes !== "" && dupNotes !== beforeNotes) {
      outcomeByKey.set("notes", "append");
    } else if (beforeNotes !== "" && !outcomeByKey.has("notes")) {
      outcomeByKey.set("notes", "keep");
    }

    // Labels: union of both sides' customFields keys folded into ONE row
    // through contactLabels (DEC-738/DEC-748 amendment) -- never a raw
    // customFields.<key> row. The reserved keys (dietary, travel,
    // accessibility -- DEC-292 amendment findings wave 5) are excluded
    // (they're each edited via their own textarea, never listed as a
    // label). A duplicate-only key upgrades the row to 'combine'; a
    // colliding key that differs stays 'keep' with the dropped "key value"
    // pair recorded in discarded.
    labelByKey.set("labels", "Labels");
    const customFieldKeys = new Set<string>([
      ...Object.keys(before.customFields ?? {}),
      ...Object.keys(duplicate.customFields ?? {}),
    ]);
    for (const fieldKey of customFieldKeys) {
      if (RESERVED_CUSTOM_FIELD_KEY_SET.has(fieldKey)) continue;
      const beforeValue = before.customFields?.[fieldKey];
      const hasDupValue = Object.prototype.hasOwnProperty.call(duplicate.customFields ?? {}, fieldKey);
      const dupValue = duplicate.customFields?.[fieldKey];
      if (beforeValue === undefined) {
        if (hasDupValue) outcomeByKey.set("labels", "combine");
      } else if (hasDupValue && beforeValue !== dupValue) {
        if (outcomeByKey.get("labels") !== "combine") outcomeByKey.set("labels", "keep");
        const list = discardedByKey.get("labels") ?? [];
        const entry = `${fieldKey} ${dupValue ?? ""}`;
        if (!list.includes(entry)) list.push(entry);
        discardedByKey.set("labels", list);
      }
    }

    survivor = merged;
  }

  const keptValue = (key: string): string => {
    if (key === "name") return fullName(survivor);
    if (key === "notes") return (survivor.notes ?? "").trim();
    if (key === "labels") return contactLabels(survivor.customFields ?? {}).join(", ");
    return (survivor[key as keyof ContactRecord] as string | undefined)?.trim() ?? "";
  };

  const out: MergeFieldPreview[] = MERGE_PREVIEW_IDENTITY_FIELDS.map(({ key, label }) => ({
    key,
    label,
    kept: keptValue(key),
    discarded: discardedByKey.get(key) ?? [],
    outcome: outcomeByKey.get(key) ?? "keep",
  }));

  const identityKeys = new Set<string>(MERGE_PREVIEW_IDENTITY_FIELDS.map((f) => f.key));
  for (const [key, outcome] of outcomeByKey) {
    if (identityKeys.has(key)) continue;
    out.push({
      key,
      label: labelByKey.get(key) ?? key,
      kept: keptValue(key),
      discarded: discardedByKey.get(key) ?? [],
      outcome,
    });
  }
  return out;
}
