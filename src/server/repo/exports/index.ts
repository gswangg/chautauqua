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
import { exportSpeakers } from "./speakers";
import { exportEvaluations } from "./evaluations";
import { exportAgenda } from "./agenda";
import { exportEmailLog } from "./email-log";
import { type ExportTable } from "./table";

export { EXPORT_KINDS, type ExportKind, isExportKind } from "./kinds";
export { type ExportTable } from "./table";
export { minutesToClock } from "./table";
export {
  SUBMISSIONS_HEADER,
  type SubmissionExportInput,
  type SubmissionCustomFieldColumn,
  shapeSubmissionsExport,
} from "./submissions";
export { AGENDA_HEADER, type AgendaExportInput, shapeAgendaExport } from "./agenda";
export { labelByCriterionId, shapeEvaluationsExport } from "./evaluations";
export { SHOWFLOW_HEADER, type ShowflowExportInput, shapeShowflowExport, buildShowflowExport } from "./showflow";

export async function buildExport(db: Db, eventId: string, kind: ExportKind): Promise<ExportTable> {
  switch (kind) {
    case "submissions":
      return exportSubmissions(db, eventId);
    case "speakers":
      return exportSpeakers(db, eventId);
    case "evaluations":
      return exportEvaluations(db, eventId);
    case "agenda":
      return exportAgenda(db, eventId);
    case "email-log":
      return exportEmailLog(db, eventId);
  }
}
