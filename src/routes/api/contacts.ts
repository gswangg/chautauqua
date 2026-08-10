// CRM API (J11), per DEC-026. Route file exports a named Hono<AppEnv>
// sub-app; only src/index.ts mounts it (DEC-012). Every endpoint is
// organizer-only + csrfJson on mutations, org-scoped via auth.orgId, with
// object-level ownership checks on every :id lookup (no IDOR).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfJson, requireOrganizer } from "../../server/middleware";
import { ApiError } from "../../server/http";
import * as repo from "../../server/repo/contacts";
import { getEventForOrg } from "../../server/repo/events";
import { createClaimToken, type KVStore } from "../../auth/claim";
import { parseCsv } from "../../lib/csv";
import { mapImportRow, matchesSegment, type ContactRecord, type SegmentRule } from "../../domain/contacts";
import { preflightRender, type RenderTarget } from "../../domain/compose";
import { textToHtml } from "../../mail/render";
import type { Db } from "../../server/context";
import { makeFileStore } from "../../server/context";
import { setContactHeadshot, serializeSocialLinks, type SocialLinks } from "../../server/repo/profile";
import { sanitizeFilenameForKey, validateHeadshotUpload } from "../../domain/files";
import { readImageDims, MAX_HEADSHOT_EDGE_PX } from "../../lib/image-dims";
import { newId } from "../../domain/ids";

export const contactsRoutes = new Hono<AppEnv>();

// NOTE: see events.ts for why a blanket `.use("*", requireOrganizer)` is
// unsafe once mounted under /api/v1 alongside sibling sub-apps — scope to
// this router's own path prefixes instead (DEC-060 w8-d finding).
contactsRoutes.use("/contacts", requireOrganizer);
contactsRoutes.use("/contacts/*", requireOrganizer);
contactsRoutes.use("/segments", requireOrganizer);
contactsRoutes.use("/segments/*", requireOrganizer);

function currentOrgId(c: { var: { auth?: { orgId: string } } }): string {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  return auth.orgId;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null) {
    throw new ApiError("invalid", "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

function serializeContact(row: repo.ContactRow) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    title: row.title,
    bio: row.bio,
    headshotUrl: row.headshotUrl,
    notes: row.notes,
    customFields: row.customFieldsJson ? JSON.parse(row.customFieldsJson) : null,
    socialLinks: row.socialLinksJson ? JSON.parse(row.socialLinksJson) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeSegment(row: repo.SegmentRow) {
  return {
    id: row.id,
    name: row.name,
    rules: JSON.parse(row.rulesJson) as SegmentRule[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireOwnedContact(db: Db, id: string, orgId: string): Promise<repo.ContactRow> {
  const contact = await repo.findContactForOrg(db, id, orgId);
  if (!contact) throw new ApiError("not_found", "Contact not found");
  return contact;
}

async function requireOwnedSegment(db: Db, id: string, orgId: string): Promise<repo.SegmentRow> {
  const segment = await repo.findSegmentForOrg(db, id, orgId);
  if (!segment) throw new ApiError("not_found", "Segment not found");
  return segment;
}

// ---------------------------------------------------------------------------
// Contacts CRUD + list
// ---------------------------------------------------------------------------

contactsRoutes.get("/contacts", async (c) => {
  const orgId = currentOrgId(c);
  const query = c.req.query();
  const rules = parseRulesQueryParam(query.rules);
  const params = repo.parseContactListQuery(query as Record<string, string | undefined>, rules);
  const result = await repo.listContactsForOrg(c.var.db, orgId, params);
  return c.json({
    items: result.items.map(serializeContact),
    total: result.total,
    page: params.page,
    perPage: params.perPage,
  });
});

contactsRoutes.post("/contacts", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  if (typeof body.firstName !== "string" || body.firstName.trim() === "") fields.firstName = "required";
  if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "required";
  if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "required";
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const created = await repo.createContact(c.var.db, orgId, {
    firstName: body.firstName as string,
    lastName: body.lastName as string,
    email: body.email as string,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    company: typeof body.company === "string" ? body.company : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    bio: typeof body.bio === "string" ? body.bio : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    customFields: isPlainObject(body.customFields) ? (body.customFields as Record<string, string>) : undefined,
  });
  return c.json(serializeContact(created), 201);
});

contactsRoutes.get("/contacts/duplicates", async (c) => {
  const orgId = currentOrgId(c);
  const groups = await repo.findDuplicateGroupsForOrg(c.var.db, orgId);
  return c.json({ items: groups, total: groups.length, page: 1, perPage: groups.length || 1 });
});

contactsRoutes.get("/contacts/stats", async (c) => {
  const orgId = currentOrgId(c);
  const stats = await repo.getContactStats(c.var.db, orgId);
  return c.json(stats);
});

contactsRoutes.get("/contacts/:id", async (c) => {
  const orgId = currentOrgId(c);
  const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
  const history = await repo.getContactHistory(c.var.db, contact.id);
  return c.json({ ...serializeContact(contact), history });
});

contactsRoutes.patch("/contacts/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  const patch: repo.ContactPatch = {};
  if (body.firstName !== undefined) {
    if (typeof body.firstName !== "string" || body.firstName.trim() === "") fields.firstName = "must be a non-empty string";
    else patch.firstName = body.firstName;
  }
  if (body.lastName !== undefined) {
    if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "must be a non-empty string";
    else patch.lastName = body.lastName;
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "must be a non-empty string";
    else patch.email = body.email;
  }
  if (body.phone !== undefined) patch.phone = body.phone === null ? null : String(body.phone);
  if (body.company !== undefined) patch.company = body.company === null ? null : String(body.company);
  if (body.title !== undefined) patch.title = body.title === null ? null : String(body.title);
  if (body.bio !== undefined) patch.bio = body.bio === null ? null : String(body.bio);
  if (body.notes !== undefined) patch.notes = body.notes === null ? null : String(body.notes);
  if (body.customFields !== undefined) {
    if (body.customFields === null) patch.customFields = null;
    else if (isPlainObject(body.customFields)) patch.customFields = body.customFields as Record<string, string>;
    else fields.customFields = "must be an object";
  }
  // CNT-10 (DEC-152, DEC-142): admin bio/social-link editing reuses the
  // portal profile plumbing verbatim — serializeSocialLinks is the single
  // source of the on-disk JSON shape, whichever surface writes it.
  if (body.socialLinks !== undefined) {
    if (body.socialLinks === null) {
      patch.socialLinksJson = serializeSocialLinks({ twitter: "", linkedin: "", github: "", website: "" });
    } else if (isPlainObject(body.socialLinks)) {
      const raw = body.socialLinks as Record<string, unknown>;
      const socialFields = ["twitter", "linkedin", "github", "website"] as const;
      let invalid = false;
      for (const key of socialFields) {
        if (raw[key] !== undefined && typeof raw[key] !== "string") invalid = true;
      }
      if (invalid) {
        fields.socialLinks = "each link must be a string";
      } else {
        const links: SocialLinks = {
          twitter: typeof raw.twitter === "string" ? raw.twitter : "",
          linkedin: typeof raw.linkedin === "string" ? raw.linkedin : "",
          github: typeof raw.github === "string" ? raw.github : "",
          website: typeof raw.website === "string" ? raw.website : "",
        };
        patch.socialLinksJson = serializeSocialLinks(links);
      }
    } else {
      fields.socialLinks = "must be an object of {twitter,linkedin,github,website}";
    }
  }
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const updated = await repo.patchContact(c.var.db, contact.id, patch);
  return c.json(serializeContact(updated));
});

// ---------------------------------------------------------------------------
// Headshot upload (CNT-10, DEC-152: organizer-side mirror of the portal
// headshot route src/routes/portal/profile.tsx — same validation limits,
// same repo write (setContactHeadshot), so a speaker's and an organizer's
// upload of the same contact behave identically).
// ---------------------------------------------------------------------------

contactsRoutes.post("/contacts/:id/headshot", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);

  const body = await c.req.parseBody();
  const headshot = body["headshot"];
  if (!(headshot instanceof File)) {
    throw new ApiError("invalid", "Validation failed", { headshot: "required" });
  }

  const validation = validateHeadshotUpload({ filename: headshot.name, sizeBytes: headshot.size });
  if (!validation.ok) {
    throw new ApiError("invalid", validation.message, validation.fields);
  }

  const buf = await headshot.arrayBuffer();

  // DEC-084 dimension gate, mirrored verbatim from the portal route.
  if (validation.servedContentType === "image/png" || validation.servedContentType === "image/jpeg") {
    let dims: { width: number; height: number };
    try {
      dims = readImageDims(new Uint8Array(buf), validation.servedContentType);
    } catch (err) {
      throw new ApiError("invalid", err instanceof Error ? err.message : "Headshot image could not be read", {
        headshot: "unreadable",
      });
    }
    if (dims.width > MAX_HEADSHOT_EDGE_PX || dims.height > MAX_HEADSHOT_EDGE_PX) {
      throw new ApiError(
        "invalid",
        "Headshot is larger than 2048px on its longest edge — please upload a smaller image.",
        { headshot: "too large" },
      );
    }
  }

  const sanitized = sanitizeFilenameForKey(headshot.name);
  const r2Key = `headshot/${contact.id}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);
  await store.put(r2Key, buf, validation.servedContentType);

  const auth = c.var.auth!;
  await setContactHeadshot(c.var.db, contact.id, {
    filename: headshot.name,
    r2Key,
    sizeBytes: headshot.size,
    contentType: validation.servedContentType,
    uploadedByContactId: auth.contactId ?? contact.id,
  });

  const updated = await requireOwnedContact(c.var.db, contact.id, orgId);
  return c.json(serializeContact(updated));
});

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// CSV import (DEC-011/DEC-026)
// ---------------------------------------------------------------------------

contactsRoutes.post("/contacts/import", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.csvText !== "string" || body.csvText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { csvText: "required" });
  }
  if (!isPlainObject(body.mapping)) {
    throw new ApiError("invalid", "Validation failed", { mapping: "required, column -> field" });
  }
  const mapping = body.mapping as Record<string, string>;

  let table: string[][];
  try {
    table = parseCsv(body.csvText);
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "Failed to parse CSV");
  }
  if (table.length === 0) {
    return c.json({ created: 0, updated: 0, skipped: [] });
  }
  const [header, ...dataRows] = table;
  if (!header) throw new ApiError("invalid", "CSV has no header row");

  // Fail loudly on a bad mapping (e.g. a target field the pure core doesn't
  // recognize) with a 400 naming the offending column, instead of letting
  // mapImportRow's thrown Error surface as an unhandled 500 mid-batch — a
  // client/server mapping mismatch should be visible, not a silent/opaque
  // failure of the whole import (P1 fix, w1-f).
  let rows: { line: number; parsed: Record<string, unknown> }[];
  try {
    rows = dataRows.map((row, idx) => ({
      line: idx + 2,
      parsed: mapImportRow(mapping, header, row) as Record<string, unknown>,
    }));
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "Invalid column mapping", {
      mapping: err instanceof Error ? err.message : "invalid",
    });
  }

  const result = await repo.applyImportRows(c.var.db, orgId, rows);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

contactsRoutes.post("/contacts/merge", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (typeof body.keepId !== "string" || typeof body.mergeId !== "string") {
    throw new ApiError("invalid", "Validation failed", { keepId: "required", mergeId: "required" });
  }
  if (body.keepId === body.mergeId) {
    throw new ApiError("invalid", "keepId and mergeId must differ", { mergeId: "must differ from keepId" });
  }

  await requireOwnedContact(c.var.db, body.keepId, orgId);
  await requireOwnedContact(c.var.db, body.mergeId, orgId);

  const merged = await repo.mergeContacts(c.var.db, body.keepId, body.mergeId);
  return c.json(serializeContact(merged));
});

// ---------------------------------------------------------------------------
// Segments (migrations/0005_w4_segment.sql, DEC-025/DEC-026)
// ---------------------------------------------------------------------------

function isRuleShape(r: unknown): r is SegmentRule {
  return (
    typeof r === "object" &&
    r !== null &&
    typeof (r as Record<string, unknown>).field === "string" &&
    ["eq", "ne", "contains"].includes((r as Record<string, unknown>).op as string) &&
    typeof (r as Record<string, unknown>).value === "string"
  );
}

/** Throws (rather than returning an error) if any rule references a field
 * matchesSegment doesn't recognize — fail loudly at parse time rather than
 * at filter time (DEC-149 'any' is a recognized pseudo-field here). */
function assertRulesResolvable(rules: SegmentRule[]): void {
  const probe: ContactRecord = { id: "probe", email: "", firstName: "", lastName: "" };
  matchesSegment(rules, probe);
}

function parseRules(body: Record<string, unknown>, fields: Record<string, string>): SegmentRule[] | undefined {
  if (!Array.isArray(body.rules)) {
    fields.rules = "must be an array of {field,op,value}";
    return undefined;
  }
  const rules: SegmentRule[] = [];
  for (const r of body.rules) {
    if (!isRuleShape(r)) {
      fields.rules = "each rule needs field, op (eq|ne|contains), value";
      return undefined;
    }
    rules.push(r);
  }
  // Fail loudly at creation time rather than at filter time: a bad field
  // name should reject the segment, not silently break every list query
  // that later applies it.
  try {
    assertRulesResolvable(rules);
  } catch (err) {
    fields.rules = err instanceof Error ? err.message : "invalid rule";
    return undefined;
  }
  return rules;
}

/** Parses+validates GET /contacts?rules=<URL-encoded JSON array>
 * (DEC-149). Hono's c.req.query() already URL-decodes the raw param, so
 * this only JSON.parses + shape-checks it. Absent/blank rules param means
 * "no rules" (returns []), matching q/segmentId's absent-means-off
 * convention; any malformed value 400s with {error:{code,message,fields}}. */
export function parseRulesQueryParam(raw: string | undefined): SegmentRule[] {
  if (raw === undefined || raw.trim() === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError("invalid", "rules must be URL-encoded JSON", { rules: "invalid JSON" });
  }
  if (!Array.isArray(parsed)) {
    throw new ApiError("invalid", "rules must be a JSON array", { rules: "must be an array of {field,op,value}" });
  }
  const rules: SegmentRule[] = [];
  for (const r of parsed) {
    if (!isRuleShape(r)) {
      throw new ApiError("invalid", "each rule needs field, op (eq|ne|contains), value", {
        rules: "each rule needs field, op (eq|ne|contains), value",
      });
    }
    rules.push(r);
  }
  try {
    assertRulesResolvable(rules);
  } catch (err) {
    throw new ApiError("invalid", err instanceof Error ? err.message : "invalid rule", {
      rules: err instanceof Error ? err.message : "invalid rule",
    });
  }
  return rules;
}

contactsRoutes.get("/segments", async (c) => {
  const orgId = currentOrgId(c);
  const items = await repo.listSegmentsForOrg(c.var.db, orgId);
  return c.json({ items: items.map(serializeSegment), total: items.length, page: 1, perPage: items.length || 1 });
});

contactsRoutes.post("/segments", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "required";
  const rules = parseRules(body, fields);
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const created = await repo.createSegment(c.var.db, orgId, body.name as string, rules as SegmentRule[]);
  return c.json(serializeSegment(created), 201);
});

contactsRoutes.patch("/segments/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  const fields: Record<string, string> = {};
  const patch: { name?: string; rules?: SegmentRule[] } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") fields.name = "must be a non-empty string";
    else patch.name = body.name;
  }
  if (body.rules !== undefined) {
    const rules = parseRules(body, fields);
    if (rules) patch.rules = rules;
  }
  if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

  const updated = await repo.patchSegment(c.var.db, segment.id, patch);
  return c.json(serializeSegment(updated));
});

contactsRoutes.delete("/segments/:id", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const segment = await requireOwnedSegment(c.var.db, c.req.param("id"), orgId);
  await repo.deleteSegment(c.var.db, segment.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Bulk email (DEC-019 atomic send semantics, DEC-026 restricted whitelist)
// ---------------------------------------------------------------------------

const MAX_BULK_EMAIL_RECIPIENTS = 100;

/** DEC-026: bulk email is contact-scoped, not submission-scoped — only
 * speaker_name/event_name/portal_link resolve; {talk_title}/{feedback} (or
 * any other placeholder) are absent from vars, so preflightRender's
 * MergeFieldError check naturally rejects them as 'invalid'. */
async function resolvePortalLink(db: Db, kv: KVStore, contactId: string, eventId: string, email: string, origin: string): Promise<string> {
  const userId = await repo.findUserIdByEmail(db, email);
  if (userId) return `${origin}/portal`;
  const token = await createClaimToken(kv, { contactId, eventId });
  return `${origin}/claim/${token}`;
}

contactsRoutes.post("/contacts/bulk-email", csrfJson, async (c) => {
  const orgId = currentOrgId(c);
  const body = asRecord(await c.req.json().catch(() => {
    throw new ApiError("invalid", "Invalid JSON body");
  }));

  if (!Array.isArray(body.contactIds) || body.contactIds.length === 0 || !body.contactIds.every((id) => typeof id === "string")) {
    throw new ApiError("invalid", "Validation failed", { contactIds: "must be a non-empty array of contact ids" });
  }
  if (body.contactIds.length > MAX_BULK_EMAIL_RECIPIENTS) {
    throw new ApiError("invalid", `${body.contactIds.length} recipients exceeds the ${MAX_BULK_EMAIL_RECIPIENTS}-recipient cap; narrow the batch.`);
  }
  if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { eventId: "required" });
  }
  if (typeof body.subject !== "string" || body.subject.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { subject: "required" });
  }
  if (typeof body.bodyText !== "string" || body.bodyText.trim() === "") {
    throw new ApiError("invalid", "Validation failed", { bodyText: "required" });
  }

  const event = await getEventForOrg(c.var.db, body.eventId, orgId);
  if (!event) throw new ApiError("not_found", "Event not found");

  const contactIds = body.contactIds as string[];
  const contacts = await repo.findContactsForOrg(c.var.db, contactIds, orgId);
  if (contacts.length !== contactIds.length) {
    throw new ApiError("not_found", "One or more contacts not found");
  }

  const kv = c.env.KV as unknown as KVStore;
  const origin = new URL(c.req.url).origin;
  const targets: RenderTarget[] = [];
  for (const contact of contacts) {
    const portalLink = await resolvePortalLink(c.var.db, kv, contact.id, event.id, contact.email, origin);
    targets.push({
      contactId: contact.id,
      submissionId: "",
      email: contact.email,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      vars: {
        speaker_name: `${contact.firstName} ${contact.lastName}`.trim(),
        event_name: event.name,
        portal_link: portalLink,
      },
    });
  }

  // Atomic preflight (DEC-019): every recipient must render before the
  // first send is attempted; any failure (including a submission-scoped
  // placeholder like {talk_title}/{feedback}, absent from the whitelist
  // above) rejects the whole batch — zero sends.
  const result = preflightRender(targets, body.subject, body.bodyText);
  if (!result.ok) {
    const fields: Record<string, string> = {};
    for (const m of result.missing) fields[m.contactId] = `missing merge field '${m.field}'`;
    throw new ApiError("invalid", "One or more recipients are missing merge fields (only speaker_name/event_name/portal_link are allowed)", fields);
  }

  const { makeMailer } = await import("../../server/context");
  const mailer = makeMailer(c.var.db);
  for (const rendered of result.rendered) {
    await mailer.send({
      to: { email: rendered.email, name: rendered.name },
      subject: rendered.subject,
      text: rendered.text,
      html: textToHtml(rendered.text),
      eventId: event.id,
      contactId: rendered.contactId,
    });
  }

  return c.json({ sent: result.rendered.length, items: result.rendered });
});
