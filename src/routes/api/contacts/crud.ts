// Contacts CRUD + list + headshot upload + push-to-event (CRM-10, DEC-156).
// Split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import { csrfJson } from "../../../server/middleware";
import { ApiError } from "../../../server/http";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../../forms/validate"; // DEC-417
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-454
import * as repo from "../../../server/repo/contacts";
import { contactLabels } from "../../../domain/contact-labels";
import { getEventForOrg } from "../../../server/repo/events";
import { listAcceptedContactIds } from "../../../server/repo/tasks";
import { setContactHeadshot, serializeSocialLinks, type SocialLinks } from "../../../server/repo/profile";
import { sanitizeFilenameForKey, validateHeadshotUpload } from "../../../domain/files";
import { readImageDims, MAX_HEADSHOT_EDGE_PX } from "../../../lib/image-dims";
import { newId } from "../../../domain/ids";
import { makeFileStore } from "../../../server/context";
import { clampPage, listPerPage } from "../../../lib/pagination";
import { PARTICIPANT_ROLE_OPTIONS } from "../../../domain/participant-roles";
import { DEC_290, DEC_461, DEC_466, DEC_764, DEC_765, DEC_810 } from "../../../decisions";
import {
  currentOrgId,
  asRecord,
  isPlainObject,
  checkLen,
  serializeContact,
  requireOwnedContact,
} from "./shared";
import { parseRulesQueryParam } from "./segments";

// Compile-checked dependency marker: the optional eventId on POST /contacts
// (roster-scoped create) implements DEC-290.
void DEC_290;
void DEC_461; // optional repo page param + sibling count fn + deterministic ORDER BY
void DEC_466; // /contacts/duplicates bounded below via the blessed JS-slice (DEC-461(e))
// Compile-checked dependency marker: POST /contacts/:id/add-to-event below
// rejects a blank title rather than inventing one (DEC-764).
void DEC_764;
// Compile-checked dependency marker: POST /contacts/:id/add-to-event below
// validates role against PARTICIPANT_ROLE_OPTIONS and passes both role and
// the owned contact row (never re-resolved by email) to pushContactToEvent
// (DEC-765).
void DEC_765;
// Compile-checked dependency marker: POST /contacts below rejects a
// missing/blank `sessionTitle` when `eventId` is present, before creating
// the contact's roster push -- no 'Invited: <name>' fallback (DEC-810).
void DEC_810;

export function registerCrudRoutes(contactsRoutes: Hono<AppEnv>): void {
  contactsRoutes.get("/contacts", async (c) => {
    const orgId = currentOrgId(c);
    const query = c.req.query();
    const rules = parseRulesQueryParam(query.rules);
    const params = repo.parseContactListQuery(query as Record<string, string | undefined>, rules);
    const result = await repo.listContactsForOrg(c.var.db, orgId, params);
    // DEC-738/DEC-726 (supersedes DEC-712): labels are the contact's own
    // customFields, formatted once here -- no separate query.
    return c.json({
      items: result.items.map((item) => ({
        ...serializeContact(item),
        labels: contactLabels(item.customFieldsJson ? JSON.parse(item.customFieldsJson) : {}),
      })),
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
    else checkLen(body.firstName, "firstName", MAX_NAME_LENGTH, fields); // DEC-417
    if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "required";
    else checkLen(body.lastName, "lastName", MAX_NAME_LENGTH, fields); // DEC-417
    if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "required";
    else {
      checkLen(body.email, "email", MAX_NAME_LENGTH, fields); // DEC-417
      if (!fields.email && !isValidEmail(body.email)) fields.email = "must be a valid email address"; // DEC-454
    }
    if (typeof body.phone === "string") checkLen(body.phone, "phone", MAX_NAME_LENGTH, fields); // DEC-417
    if (typeof body.company === "string") checkLen(body.company, "company", MAX_NAME_LENGTH, fields); // DEC-417
    if (typeof body.title === "string") checkLen(body.title, "title", MAX_NAME_LENGTH, fields); // DEC-417
    if (typeof body.bio === "string") checkLen(body.bio, "bio", MAX_LONG_TEXT_LENGTH, fields); // DEC-417
    if (typeof body.notes === "string") checkLen(body.notes, "notes", MAX_LONG_TEXT_LENGTH, fields); // DEC-417
    if (isPlainObject(body.customFields)) {
      for (const [key, value] of Object.entries(body.customFields)) {
        if (typeof value === "string") checkLen(value, `customFields.${key}`, MAX_TEXT_LENGTH, fields); // DEC-417
      }
    }
    if (Object.keys(fields).length > 0) throw new ApiError("invalid", "Validation failed", fields);

    // DEC-290: an optional eventId puts the newly-created contact directly on
    // the event roster, riding the existing add-to-event push (no new route).
    // DEC-810: pushing onto an event creates a real, named session, so an
    // eventId requires a session title -- rejected loudly rather than
    // falling back to an invented 'Invited: <name>' title. This is a
    // distinct field from `title` (the contact's own job title, validated
    // above), named `sessionTitle` so the two never collide.
    let eventId: string | undefined;
    let sessionTitle: string | undefined;
    if (body.eventId !== undefined) {
      if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
        throw new ApiError("invalid", "Validation failed", { eventId: "must be a non-empty string" });
      }
      const event = await getEventForOrg(c.var.db, body.eventId, orgId);
      if (!event) throw new ApiError("not_found", "Event not found");
      eventId = event.id;
      if (typeof body.sessionTitle !== "string" || body.sessionTitle.trim() === "") {
        throw new ApiError("invalid", "Validation failed", {
          sessionTitle: "required to name the session this contact is added to the event with",
        });
      }
      sessionTitle = body.sessionTitle.trim();
    }

    const created = await repo.createContact(c.var.db, orgId, {
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: normalizeEmail(body.email as string), // DEC-454
      phone: typeof body.phone === "string" ? body.phone : undefined,
      company: typeof body.company === "string" ? body.company : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      customFields: isPlainObject(body.customFields) ? (body.customFields as Record<string, string>) : undefined,
    });

    if (eventId !== undefined) {
      const alreadyOnRoster = await listAcceptedContactIds(c.var.db, eventId);
      if (!alreadyOnRoster.includes(created.id)) {
        if (sessionTitle === undefined) throw new Error("sessionTitle required when eventId is set (checked above)");
        await repo.pushContactToEvent(c.var.db, eventId, orgId, created, sessionTitle);
      }
    }

    return c.json(serializeContact(created), 201);
  });

  contactsRoutes.get("/contacts/duplicates", async (c) => {
    const orgId = currentOrgId(c);
    const groups = await repo.findDuplicateGroupsForOrg(c.var.db, orgId);
    // DEC-466/DEC-461(e): blessed JS-slice -- groups is assembled from an
    // already-materialized array (findDuplicateGroupsForOrg's own order,
    // which is stably tiebroken by the group's first contact id -- see the
    // comment at that function's definition), so clamp with a slice and
    // report the FULL array length as `total`, never the slice's.
    const page = clampPage(c.req.query("page"));
    const perPage = listPerPage(c.req.query("perPage"));
    const total = groups.length;
    const start = (page - 1) * perPage;
    const items = groups.slice(start, start + perPage);
    return c.json({ items, total, page, perPage });
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
      else { checkLen(body.firstName, "firstName", MAX_NAME_LENGTH, fields); patch.firstName = body.firstName; } // DEC-417
    }
    if (body.lastName !== undefined) {
      if (typeof body.lastName !== "string" || body.lastName.trim() === "") fields.lastName = "must be a non-empty string";
      else { checkLen(body.lastName, "lastName", MAX_NAME_LENGTH, fields); patch.lastName = body.lastName; } // DEC-417
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || body.email.trim() === "") fields.email = "must be a non-empty string";
      else {
        checkLen(body.email, "email", MAX_NAME_LENGTH, fields); // DEC-417
        if (!fields.email && !isValidEmail(body.email)) fields.email = "must be a valid email address"; // DEC-454
        if (!fields.email) patch.email = normalizeEmail(body.email); // DEC-454
      }
    }
    if (body.phone !== undefined) {
      patch.phone = body.phone === null ? null : String(body.phone);
      if (patch.phone !== null) checkLen(patch.phone, "phone", MAX_NAME_LENGTH, fields); // DEC-417
    }
    if (body.company !== undefined) {
      patch.company = body.company === null ? null : String(body.company);
      if (patch.company !== null) checkLen(patch.company, "company", MAX_NAME_LENGTH, fields); // DEC-417
    }
    if (body.title !== undefined) {
      patch.title = body.title === null ? null : String(body.title);
      if (patch.title !== null) checkLen(patch.title, "title", MAX_NAME_LENGTH, fields); // DEC-417
    }
    if (body.bio !== undefined) {
      patch.bio = body.bio === null ? null : String(body.bio);
      if (patch.bio !== null) checkLen(patch.bio, "bio", MAX_LONG_TEXT_LENGTH, fields); // DEC-417
    }
    if (body.notes !== undefined) {
      patch.notes = body.notes === null ? null : String(body.notes);
      if (patch.notes !== null) checkLen(patch.notes, "notes", MAX_LONG_TEXT_LENGTH, fields); // DEC-417
    }
    if (body.customFields !== undefined) {
      if (body.customFields === null) patch.customFields = null;
      else if (isPlainObject(body.customFields)) {
        for (const [key, value] of Object.entries(body.customFields)) {
          if (typeof value === "string") checkLen(value, `customFields.${key}`, MAX_TEXT_LENGTH, fields); // DEC-417
        }
        patch.customFields = body.customFields as Record<string, string>;
      } else fields.customFields = "must be an object";
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
          else if (typeof raw[key] === "string" && (raw[key] as string).length > MAX_TEXT_LENGTH) invalid = true; // DEC-417
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

  // DEC-758: delete refuses honestly — a contact with any dependent row
  // (participant, task assignment, pipeline entry, or linked user account)
  // 409s naming the counts; merge is the answer for a contact with history.
  // requireOrganizer + csrfJson are already applied at the /contacts/*
  // router level (see index.ts); org scoping is requireOwnedContact's
  // existence-hiding 404 for a cross-org id.
  contactsRoutes.delete("/contacts/:id", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);

    const counts = await repo.countContactReferences(c.var.db, contact.id);
    const parts: string[] = [];
    const fields: Record<string, string> = {};
    if (counts.participants > 0) {
      parts.push(`${counts.participants} submission${counts.participants === 1 ? "" : "s"}`);
      fields.participants = String(counts.participants);
    }
    if (counts.taskAssignments > 0) {
      parts.push(`${counts.taskAssignments} task${counts.taskAssignments === 1 ? "" : "s"}`);
      fields.taskAssignments = String(counts.taskAssignments);
    }
    if (counts.pipelineEntries > 0) {
      parts.push(`${counts.pipelineEntries} pipeline entr${counts.pipelineEntries === 1 ? "y" : "ies"}`);
      fields.pipelineEntries = String(counts.pipelineEntries);
    }
    if (counts.userAccounts > 0) {
      parts.push(`${counts.userAccounts} user account${counts.userAccounts === 1 ? "" : "s"}`);
      fields.userAccounts = String(counts.userAccounts);
    }
    if (parts.length > 0) {
      const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
      throw new ApiError(
        "conflict",
        `This contact is on ${list}. Merge it into another record instead of deleting it.`,
        fields,
      );
    }

    await repo.deleteContact(c.var.db, contact.id);
    return c.body(null, 204);
  });

  // -------------------------------------------------------------------------
  // Headshot upload (CNT-10, DEC-152: organizer-side mirror of the portal
  // headshot route src/routes/portal/profile.tsx — same validation limits,
  // same repo write (setContactHeadshot), so a speaker's and an organizer's
  // upload of the same contact behave identically).
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Push to event (CRM-10, DEC-156)
  // -------------------------------------------------------------------------

  contactsRoutes.post("/contacts/:id/add-to-event", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));

    if (typeof body.eventId !== "string" || body.eventId.trim() === "") {
      throw new ApiError("invalid", "Validation failed", { eventId: "required" });
    }
    const event = await getEventForOrg(c.var.db, body.eventId, orgId);
    if (!event) throw new ApiError("not_found", "Event not found");

    // DEC-764: the server no longer invents a title — a blank field is
    // rejected rather than silently falling back to 'Invited: <name>'.
    if (typeof body.title !== "string" || body.title.trim() === "") {
      throw new ApiError("invalid", "Validation failed", { title: "required" });
    }
    const title = body.title;

    // DEC-765: role reaches participant.role, validated against the app's
    // own vocabulary (never a free-text value from the modal).
    let role: string | undefined;
    if (body.role !== undefined) {
      if (typeof body.role !== "string" || !PARTICIPANT_ROLE_OPTIONS.some((o) => o.value === body.role)) {
        throw new ApiError("invalid", "Validation failed", { role: "invalid" });
      }
      role = body.role;
    }

    const submissionId = await repo.pushContactToEvent(c.var.db, event.id, orgId, contact, title, role);
    return c.json({ submissionId }, 201);
  });
}
