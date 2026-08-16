// GET /api/v1/events/:eventId/export/:kind?format=csv|json — DEC-027
// canonical exports surface (distinct from the DEC-018 plan-results CSV).
// GET /api/v1/events/:eventId/exports/showflow.csv — DEC-055 show-flow
// export, a separate fixed-column surface on its own route.
// Organizer-only, object-level event ownership check, attachment
// disposition. Route files export a named Hono sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../server/env";
import { requireOrganizer } from "../../server/middleware";
import { ApiError, parseBoundedText } from "../../server/http";
import * as schema from "../../db/schema";
import { toCsv } from "../../domain/csv";
import { buildExport, buildShowflowExport, isExportKind, EXPORT_MAX_ROWS, type EmailLogExportParams, type EvaluationsExportParams } from "../../server/repo/exports";
import { contentDispositionAttachment } from "../../domain/files";
import { parseListQuery } from "../../server/repo/submissions/query";
import { parseContactListQuery } from "../../server/repo/contacts/query";
import { parseRulesQueryParam } from "./contacts/segments";
import { EMAIL_LOG_STATUSES } from "../../mail/types";
import { DEC_011, DEC_025, DEC_027, DEC_055, DEC_649, DEC_671 } from "../../decisions";

void DEC_011;
void DEC_025;
void DEC_027;
void DEC_055;
void DEC_649;
void DEC_671;

export const exportsRoutes = new Hono<AppEnv>();

// Object-level ownership check shared by both export surfaces below: the
// event must belong to the caller's org. Returns the event's orgId (DEC-597:
// the 'contacts' kind is org-scoped, and this is where that org id is
// resolved — the caller's own orgId, already proven to match).
async function requireOwnedEvent(c: Context<AppEnv>, eventId: string): Promise<string> {
  const auth = c.var.auth;
  if (!auth) throw new ApiError("unauthorized", "Login required");
  const eventRows = await c.var.db
    .select({ id: schema.event.id, orgId: schema.event.orgId })
    .from(schema.event)
    .where(eq(schema.event.id, eventId))
    .limit(1);
  const eventRow = eventRows[0];
  if (!eventRow || eventRow.orgId !== auth.orgId) {
    throw new ApiError("not_found", "Event not found");
  }
  return eventRow.orgId;
}

// DEC-055: distinct route prefix ('/exports/', singular file) from the
// DEC-027 kinds below ('/export/:kind') per the decision doc's exact path.
exportsRoutes.get("/api/v1/events/:eventId/exports/showflow.csv", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  await requireOwnedEvent(c, eventId);

  const table = await buildShowflowExport(c.var.db, eventId);
  // DEC-027 amendment (wave 50): refuse rather than ship a silently
  // truncated show-flow — this surface has no list filter to narrow with,
  // so the only guidance is the cap itself.
  if (table.truncated) {
    throw new ApiError("invalid", `This event has more than ${EXPORT_MAX_ROWS} accepted sessions — the show-flow export cannot exceed ${EXPORT_MAX_ROWS} rows.`);
  }
  const csv = toCsv([table.header, ...table.rows]);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", contentDispositionAttachment("showflow.csv"));
  return c.body(csv);
});

exportsRoutes.get("/api/v1/events/:eventId/export/:kind", requireOrganizer, async (c) => {
  const eventId = c.req.param("eventId");
  const kind = c.req.param("kind");

  if (!isExportKind(kind)) {
    throw new ApiError("invalid", `Unknown export kind '${kind}'`);
  }

  const orgId = await requireOwnedEvent(c, eventId);

  const format = (c.req.query("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    throw new ApiError("invalid", "format must be 'csv' or 'json'");
  }

  // DEC-649 + DEC-843: the 'submissions' export honours the list's own
  // filter (q/status/trackId/sort) via the EXISTING parseListQuery — not a
  // reimplementation — and status tokens go through the SAME
  // readStatusTokens-backed reader the list route uses, so the two
  // surfaces can never parse an identical query string into different row
  // sets. An unrecognised status literal fails loudly as a 400.
  let submissionsListParams: ReturnType<typeof parseListQuery> | undefined;
  if (kind === "submissions") {
    const statusTokens = c.req.queries("status");
    const raw = c.req.query();
    try {
      submissionsListParams = parseListQuery({ ...raw, status: statusTokens });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError("invalid", message);
    }
  }

  // DEC-671: the 'contacts' export honours the directory's own filter (q/
  // segmentId/rules) via the EXISTING parseContactListQuery + rules-param
  // validator — not a reimplementation. An unparseable rules payload 400s,
  // same as the list.
  let contactsListParams: ReturnType<typeof parseContactListQuery> | undefined;
  if (kind === "contacts") {
    const query = c.req.query();
    const rules = parseRulesQueryParam(query.rules);
    try {
      contactsListParams = parseContactListQuery(query as Record<string, string | undefined>, rules);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ApiError("invalid", message);
    }
  }

  // w41-a (DEC-027 wave-41 amendment): the 'email-log' export honours the
  // History tab's own filter (contactId/status/q/batchId/since) via the SAME
  // validators the sibling route (src/routes/api/email-log.ts) uses -- not a
  // reimplementation -- so an unrecognised status/since value 400s the same
  // way here as it does there.
  // task-w3-g (DEC-027 wave-82 amendment): templateId joins that list too --
  // EmailLogExportParams is now Pick<>'d from EmailLogListParams so this
  // vocabulary can never silently drift from the list's again, and templateId
  // is parsed with the same parseBoundedText call the list route uses.
  let emailLogParams: EmailLogExportParams | undefined;
  if (kind === "email-log") {
    const contactIdRaw = c.req.query("contactId") || undefined;
    const contactId = contactIdRaw !== undefined ? parseBoundedText(contactIdRaw, "contactId", { max: 64, required: false }) : undefined;
    const statusRaw = c.req.query("status") || undefined;
    if (statusRaw !== undefined && !(EMAIL_LOG_STATUSES as readonly string[]).includes(statusRaw)) {
      throw new ApiError("invalid", "status must be one of sent, failed", { status: "invalid" });
    }
    const qRaw = c.req.query("q") || undefined;
    const q = qRaw !== undefined ? parseBoundedText(qRaw, "q", { max: 200, required: false }) : undefined;
    const batchIdRaw = c.req.query("batchId") || undefined;
    const batchKey = batchIdRaw !== undefined ? parseBoundedText(batchIdRaw, "batchId", { max: 64, required: false }) : undefined;
    const sinceRaw = c.req.query("since");
    let since: number | undefined;
    if (sinceRaw !== undefined) {
      const n = Number(sinceRaw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        throw new ApiError("invalid", "since must be a non-negative integer epoch-ms timestamp", { since: "invalid" });
      }
      since = n;
    }
    // DEC-027 (wave-82 amendment): templateId parsed with the SAME
    // parseBoundedText validator the sibling list route
    // (src/routes/api/email-log.ts) uses, so an over-long/malformed value
    // 400s identically on both routes rather than being reimplemented here.
    const templateIdRaw = c.req.query("templateId") || undefined;
    const templateId = templateIdRaw !== undefined ? parseBoundedText(templateIdRaw, "templateId", { max: 64, required: false }) : undefined;
    emailLogParams = { contactId, status: statusRaw, q, batchKey, since, templateId };
  }

  // w41-a (DEC-027 wave-41 amendment): the 'evaluations' export honours an
  // optional planId/round narrowing. A planId that is not a plan of THIS
  // event is a loud ApiError (exportEvaluations itself checks ownership),
  // never a silently empty CSV.
  let evaluationsParams: EvaluationsExportParams | undefined;
  if (kind === "evaluations") {
    const planIdRaw = c.req.query("planId") || undefined;
    const planId = planIdRaw !== undefined ? parseBoundedText(planIdRaw, "planId", { max: 64, required: false }) : undefined;
    const roundRaw = c.req.query("round");
    let round: number | undefined;
    if (roundRaw !== undefined) {
      const n = Number(roundRaw);
      if (!Number.isInteger(n) || n < 1) {
        throw new ApiError("invalid", "round must be a positive integer", { round: "invalid" });
      }
      round = n;
    }
    evaluationsParams = { planId, round };
  }

  const table = await buildExport(c.var.db, eventId, kind, orgId, submissionsListParams, contactsListParams, emailLogParams, evaluationsParams);

  // DEC-027 amendment (wave 50, extended wave 41): refuse rather than ship a
  // silently truncated file. 'submissions' and 'contacts' honour the list's
  // own filter (q/status/trackId/sort per DEC-649; q/segmentId/rules per
  // DEC-671); 'email-log' and 'evaluations' now honour their own filters too
  // (w41-a) so "narrow with that filter and retry" is a real next action for
  // all four; 'speakers'/'agenda' have no filter here and are told the cap
  // plainly.
  if (table.truncated) {
    const narrowHint =
      kind === "submissions"
        ? " Narrow with the list's own filter (q/status/trackId) and retry."
        : kind === "contacts"
          ? " Narrow with the directory's own filter (q/segmentId/rules) and retry."
          : kind === "email-log"
            ? " Narrow with the history's own filter (status/q/batchId/since/contactId/templateId) and retry."
            : kind === "evaluations"
              ? " Narrow with planId/round and retry."
              : "";
    throw new ApiError("invalid", `This export would exceed the ${EXPORT_MAX_ROWS}-row cap.${narrowHint}`);
  }

  if (format === "json") {
    c.header("Content-Disposition", contentDispositionAttachment(`${kind}.json`));
    return c.json(table.records);
  }

  const csv = toCsv([table.header, ...table.rows]);
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", contentDispositionAttachment(`${kind}.csv`));
  return c.body(csv);
});
