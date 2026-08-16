// Contacts CRUD + list + headshot upload + push-to-event (CRM-10, DEC-156).
// Split out of the former monolithic src/routes/api/contacts.ts for
// contention (803-line hotspot) reasons only; no behavior change.

import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type { AppEnv } from "../../../server/env";
import * as schema from "../../../db/schema";
import { csrfJson } from "../../../server/middleware";
import { ApiError, parseBoundedIdArray, requireAtLeastOneField } from "../../../server/http";
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH, MAX_LONG_TEXT_LENGTH } from "../../../forms/validate"; // DEC-417
import { overCapFieldMessage, overCapCountMessage } from "../../../domain/cap-copy";
import { isValidEmail, normalizeEmail } from "../../../domain/email"; // DEC-454
import * as repo from "../../../server/repo/contacts";
import { findContactByEmail } from "../../../server/repo/submit";
import { contactLabels, MAX_CONTACT_CUSTOM_FIELDS } from "../../../domain/contact-labels"; // DEC-417
import { plural } from "../../../domain/count-copy"; // DEC-957
import { getEventForOrg } from "../../../server/repo/events";
import { listAcceptedContactIds } from "../../../server/repo/tasks";
import { setContactHeadshot, serializeSocialLinks, type SocialLinks } from "../../../server/repo/profile";
import { sanitizeFilenameForKey, validateHeadshotUpload } from "../../../domain/files";
import { readImageDims, MAX_HEADSHOT_EDGE_PX } from "../../../lib/image-dims";
import { newId } from "../../../domain/ids";
import { makeFileStore, putThenRecord } from "../../../server/context";
import { clampPage, listPerPage } from "../../../lib/pagination";
import { PARTICIPANT_ROLE_OPTIONS } from "../../../domain/participant-roles";
import {
  DEC_290,
  DEC_461,
  DEC_466,
  DEC_755,
  DEC_764,
  DEC_765,
  DEC_810,
  DEC_894,
  DEC_979,
} from "../../../decisions";
void DEC_755; // DEC-755 amendment (wave 43): POST /contacts is find-or-REFUSE, never mint-a-duplicate.
void DEC_894; // DEC-894: headshot dimension gate covers webp too — see below.
void DEC_979;
import {
  currentOrgId,
  asRecord,
  isPlainObject,
  checkLen,
  serializeContact,
  requireOwnedContact,
  requireOwnedContacts,
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
    let params;
    try {
      params = repo.parseContactListQuery(query as Record<string, string | undefined>, rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError("invalid", message);
    }
    const result = await repo.listContactsForOrg(c.var.db, orgId, params);
    // DEC-738/DEC-726 (supersedes DEC-712): labels are the contact's own
    // customFields, formatted once here -- no separate query.
    return c.json({
      items: result.items.map((item) => ({
        ...serializeContact(item),
        labels: contactLabels(repo.parseContactCustomFields(item.customFieldsJson)),
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
      const entries = Object.entries(body.customFields);
      // DEC-417 amendment (wave 2): a non-string value used to silently skip
      // validation and get cast `as Record<string,string>` -- refuse it
      // instead. Same for a key longer than MAX_NAME_LENGTH, and for the key
      // COUNT itself (previously unbounded).
      if (entries.length > MAX_CONTACT_CUSTOM_FIELDS) {
        fields.customFields = overCapCountMessage(entries.length, MAX_CONTACT_CUSTOM_FIELDS, "custom field"); // DEC-422 grammar
      }
      for (const [key, value] of entries) {
        if (typeof value !== "string") {
          fields[`customFields.${key}`] = "must be a string";
        } else if (key.length > MAX_NAME_LENGTH) {
          checkLen(key, `customFields.${key}`, MAX_NAME_LENGTH, fields); // DEC-417/DEC-422: key length shares the value grammar
        } else {
          checkLen(value, `customFields.${key}`, MAX_TEXT_LENGTH, fields); // DEC-417
        }
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
      if (body.sessionTitle.length > MAX_NAME_LENGTH) {
        throw new ApiError("invalid", "Validation failed", { sessionTitle: overCapFieldMessage(body.sessionTitle.length, MAX_NAME_LENGTH) }); // DEC-417
      }
      sessionTitle = body.sessionTitle.trim();
    }

    // DEC-755 amendment (wave 43): contact identity within an org is
    // (orgId, lower(email)) on every find-or-create path -- this manual
    // create is find-or-REFUSE, not find-or-mint-a-duplicate. A silent
    // find-and-return would be a silent merge of two different people's
    // names, so a hit is a 409 naming the existing contact rather than a
    // 201 of the existing row.
    const normalizedEmail = normalizeEmail(body.email as string); // DEC-454
    const existing = await findContactByEmail(c.var.db, orgId, normalizedEmail);
    if (existing) {
      const existingFull = await repo.findContactForOrg(c.var.db, existing.id, orgId);
      const existingName = existingFull ? `${existingFull.firstName} ${existingFull.lastName}` : "An existing contact";
      throw new ApiError("conflict", `${existingName} already uses this email`, {
        email: "Already on an existing contact",
      });
    }

    const created = await repo.createContact(c.var.db, orgId, {
      firstName: body.firstName as string,
      lastName: body.lastName as string,
      email: normalizedEmail,
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
    const rawIds = c.req.query("ids");
    // w39-c: a merge screen resolving its own pair (?ids=<a>,<b>) needs that
    // EXACT pair back regardless of where it sorts in the unfiltered,
    // paginated list -- a false "no longer duplicates" + a page-length
    // masquerading as a total (see MergePage.tsx) otherwise. This does not
    // add a second duplicate-detection rule: it still reads off
    // findDuplicateGroupsForOrg's one stably-ordered array, just reporting a
    // single group's position in it instead of slicing a page.
    if (rawIds !== undefined) {
      const ids = parseBoundedIdArray(
        rawIds.split(",").map((id) => id.trim()).filter((id) => id.length > 0),
        "ids",
      );
      // Org-scoped through the existing owned-contact check -- a foreign or
      // unknown id 404s exactly as the sibling contact routes do, no
      // existence leak via a duplicates-shaped response.
      await requireOwnedContacts(c.var.db, ids, orgId);
      const groups = await repo.findDuplicateGroupsForOrg(c.var.db, orgId);
      const idSet = new Set(ids);
      const matchIndex = groups.findIndex(
        (g) => g.contactIds.length === idSet.size && g.contactIds.every((id) => idSet.has(id)),
      );
      const perPage = listPerPage(c.req.query("perPage"));
      return c.json({
        items: matchIndex === -1 ? [] : [groups[matchIndex]],
        total: groups.length,
        page: 1,
        perPage,
        position: matchIndex === -1 ? null : matchIndex + 1,
      });
    }
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
    // DEC-894: the drawer prints the stored headshot file's filename and
    // upload date beside the image — an uploaded file with no metadata
    // reads as decoration, not as a record. headshotUrl is `/headshots/:fileId`.
    let headshotFile: { filename: string; uploadedAt: number } | null = null;
    if (contact.headshotUrl) {
      // DEC-773 amendment (w32-e): headshotFileId is the single home for the
      // file id -- headshotUrl and headshotFileId are always written together
      // (profile.ts's setContactHeadshot, contacts/merge.ts, scripts/seed.ts),
      // so a non-null url with a null fk means that invariant was violated.
      const [fkRow] = await c.var.db
        .select({ headshotFileId: schema.contact.headshotFileId })
        .from(schema.contact)
        .where(eq(schema.contact.id, contact.id))
        .limit(1);
      if (!fkRow?.headshotFileId) {
        throw new Error(`Contact ${contact.id} has headshotUrl but no headshotFileId`);
      }
      const fileId = fkRow.headshotFileId;
      const [row] = await c.var.db
        .select({ filename: schema.file.filename, createdAt: schema.file.createdAt })
        .from(schema.file)
        .where(eq(schema.file.id, fileId))
        .limit(1);
      if (row) headshotFile = { filename: row.filename, uploadedAt: row.createdAt.getTime() };
    }
    return c.json({ ...serializeContact(contact), history, headshotFile });
  });

  contactsRoutes.patch("/contacts/:id", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);
    const body = asRecord(await c.req.json().catch(() => {
      throw new ApiError("invalid", "Invalid JSON body");
    }));
    // DEC-627 (amendment, wave 6): every field on this PATCH is optional;
    // an empty body must be refused rather than reaching patchContact as a
    // no-op.
    requireAtLeastOneField(body, [
      "firstName",
      "lastName",
      "email",
      "phone",
      "company",
      "title",
      "bio",
      "notes",
      "customFields",
      "socialLinks",
    ]);

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
        const entries = Object.entries(body.customFields);
        // DEC-417 amendment (wave 2): same refuse-not-skip rules as POST
        // /contacts above.
        if (entries.length > MAX_CONTACT_CUSTOM_FIELDS) {
          fields.customFields = overCapCountMessage(entries.length, MAX_CONTACT_CUSTOM_FIELDS, "custom field"); // DEC-422 grammar
        }
        for (const [key, value] of entries) {
          if (typeof value !== "string") {
            fields[`customFields.${key}`] = "must be a string";
          } else if (key.length > MAX_NAME_LENGTH) {
            checkLen(key, `customFields.${key}`, MAX_NAME_LENGTH, fields); // DEC-417/DEC-422: key length shares the value grammar
          } else {
            checkLen(value, `customFields.${key}`, MAX_TEXT_LENGTH, fields); // DEC-417
          }
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

  // DEC-979 (supersedes DEC-956's tasks/pipelineEntries refusal classes):
  // a task_assignment and a pipeline_entry are JOIN rows, not documents —
  // deleteContact cascades them (chunked, set-based) rather than refusing,
  // since the product has no way to remove either independently. The only
  // refusal classes left are ones where something else would lose its
  // meaning: a participant row (a submission would lose an author) and a
  // login (a user account). requireOrganizer + csrfJson are already applied
  // at the /contacts/* router level (see index.ts); org scoping is
  // requireOwnedContact's existence-hiding 404 for a cross-org id.
  contactsRoutes.delete("/contacts/:id", csrfJson, async (c) => {
    const orgId = currentOrgId(c);
    const contact = await requireOwnedContact(c.var.db, c.req.param("id"), orgId);

    const refs = await repo.listContactReferenceRows(c.var.db, contact.id);
    const parts: string[] = [];
    const fields: Record<string, string> = {};

    let submissionCount = 0;
    if (refs.submissions.length > 0) {
      const total = refs.submissions.length + refs.more.submissions;
      submissionCount = total;
      fields.participants = String(total);
      const named = refs.submissions
        .slice(0, 5)
        .map((s) => `${contact.firstName} ${contact.lastName} is a speaker on ${s.ref} "${s.title}" (${s.eventName})`)
        .join("; ");
      const extra = refs.more.submissions > 0 ? ` and ${refs.more.submissions} more ${plural(refs.more.submissions, "submission")}` : "";
      parts.push(`${named}${extra}`);
    }
    if (refs.userAccounts.length > 0) {
      const total = refs.userAccounts.length + refs.more.userAccounts;
      fields.userAccounts = String(total);
      parts.push("has a login");
    }

    if (parts.length > 0) {
      const message =
        `${parts.join(", ")}. ` +
        "To delete this contact, merge this record into the one you are keeping, " +
        // DEC-957: the count phrase goes through plural(), never a raw '(s)'.
        `or remove them from the named ${plural(submissionCount, "session")} in the submission editor, ` +
        "or delete the login in Settings > People.";
      throw new ApiError("conflict", message, fields);
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
    // DEC-894: webp runs the same gate as png/jpeg.
    if (
      validation.servedContentType === "image/png" ||
      validation.servedContentType === "image/jpeg" ||
      validation.servedContentType === "image/webp"
    ) {
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
    const auth = c.var.auth!;
    await putThenRecord(store, r2Key, buf, validation.servedContentType, () =>
      setContactHeadshot(c.var.db, contact.id, {
        filename: headshot.name,
        r2Key,
        sizeBytes: headshot.size,
        contentType: validation.servedContentType,
        uploadedByContactId: auth.contactId ?? contact.id,
      }),
    );

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
    if (body.title.length > MAX_NAME_LENGTH) {
      throw new ApiError("invalid", "Validation failed", { title: overCapFieldMessage(body.title.length, MAX_NAME_LENGTH) }); // DEC-417
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
