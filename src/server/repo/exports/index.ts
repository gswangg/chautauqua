// Export data access for GET /api/v1/events/:eventId/export/:kind (J12,
// DEC-027). Decomposed into one file per export kind (submissions.ts,
// speakers.ts, evaluations.ts, agenda.ts, email-log.ts, showflow.ts) plus
// shared primitives (table.ts, common.ts, kinds.ts) — this file is the
// public barrel every external caller imports (`../../server/repo/exports`
// resolves to this directory's index.ts), re-exporting each submodule's
// public surface unchanged plus the buildExport/buildShowflowExport
// dispatchers. Behavior is unchanged from the pre-decomposition single file.

import type { Db } from "../../context";
import { type ExportKind } from "./kinds";
import { exportSubmissions } from "./submissions";
import type { ParsedListQuery } from "../submissions/query";
import { exportSpeakers } from "./speakers";
import { exportEvaluations, type EvaluationsExportParams } from "./evaluations";
import { exportAgenda } from "./agenda";
import { exportEmailLog, type EmailLogExportParams } from "./email-log";
import { exportContacts } from "./contacts";
import type { ParsedContactListQuery } from "../contacts/query";
import { type ExportTable } from "./table";

export { EXPORT_KINDS, type ExportKind, isExportKind } from "./kinds";
export { type ExportTable } from "./table";
export { minutesToClock, EXPORT_MAX_ROWS } from "./table";
export {
  SUBMISSIONS_HEADER,
  type SubmissionExportInput,
  type SubmissionCustomFieldColumn,
  shapeSubmissionsExport,
} from "./submissions";
export { AGENDA_HEADER, type AgendaExportInput, shapeAgendaExport } from "./agenda";
export { labelByCriterionId, shapeEvaluationsExport, type EvaluationsExportParams } from "./evaluations";
export { type EmailLogExportParams } from "./email-log";
export { SHOWFLOW_HEADER, type ShowflowExportInput, shapeShowflowExport, buildShowflowExport } from "./showflow";
export { CONTACTS_HEADER, exportContacts } from "./contacts";

// DEC-597: 'contacts' is org-scoped, not event-scoped like every other kind
// here — `orgId` is required exactly when kind === 'contacts' (the caller,
// the DEC-027 export route, already resolves it via its object-level event
// ownership check) and ignored otherwise.
export async function buildExport(
  db: Db,
  eventId: string,
  kind: ExportKind,
  orgId?: string,
  submissionsListParams?: ParsedListQuery,
  contactsListParams?: ParsedContactListQuery,
  emailLogParams?: EmailLogExportParams,
  evaluationsParams?: EvaluationsExportParams,
): Promise<ExportTable> {
  switch (kind) {
    case "submissions":
      return exportSubmissions(db, eventId, submissionsListParams);
    case "speakers":
      return exportSpeakers(db, eventId);
    case "evaluations":
      return exportEvaluations(db, eventId, evaluationsParams);
    case "agenda":
      return exportAgenda(db, eventId);
    case "email-log":
      return exportEmailLog(db, eventId, emailLogParams);
    case "contacts":
      if (!orgId) throw new Error("buildExport: orgId is required for kind 'contacts'");
      return exportContacts(db, orgId, contactsListParams);
  }
}
