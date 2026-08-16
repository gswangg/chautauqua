// Portal tasks + resources (J7 depth), per DEC-029 + DEC-028 (shared
// gate/layout) + DEC-023 (assignment status semantics owned by
// src/server/repo/tasks.ts) + DEC-020 (upload validation/caps). Route file
// exports a named Hono sub-app; only src/index.ts mounts it (DEC-012).
//
// DEC-240 supersedes DEC-029's file-upload rule specifically: the upload
// handler below no longer hardcodes kind='handout'/submission_id=null — see
// its own comment for the current (deterministic-linkage + chaining) rule.
// DEC-029 still governs everything else in this module (form/general/
// resources).
//
// KNOWN RUNTIME DEPENDENCY: task_assignment.response_json/file_id live in
// src/db/schema.ts on main but their D1 migration is owned by in-flight
// w3-a (DEC-017) — this module creates NO migration. The form/upload
// completion actions below will fail loudly at runtime (SQL error) until
// that migration lands; this is accepted/expected for the same wave.
//
// DECOMPOSITION NOTE: this file used to hold every /portal/tasks +
// /portal/resources handler and JSX component in one 840-line file (a
// merge-conflict hotspot). It's now split into cohesive submodules under
// ./tasks/ — this file keeps the task-assignment route handlers (the part
// most tightly coupled to loadTasksPageData) and mounts the rest:
//
//   tasks/shared.ts    — requireAuth/ensureCsrfCookie/assertOwnAssignmentOr403
//   tasks/views.tsx     — pure-render JSX (TaskRow, TasksPage, TaskFormPage,
//                         ResourcesPage, VersionHistory, CommentThread) +
//                         FileRequestExtras/FileVersionRow types
//   tasks/resources.tsx — /resources + /resources/:id/download routes
//
// Every existing call site (`import { portalTasksRoutes } from
// "../../routes/portal/tasks"`) keeps working unchanged — the exported
// sub-app still serves the exact same URL space under app.route("/portal",
// portalTasksRoutes) in src/index.ts.

import { Hono, type Context } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate } from "./shared";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { makeFileStore, putThenRecord } from "../../server/context";
import { newId } from "../../domain/ids";
import { overCapSentence } from "../../domain/cap-copy";
import { updateAssignmentStatus } from "../../server/repo/tasks";
import {
  getReplacesTarget,
  insertFile,
  insertFileComment,

  listFileChainVersions,
  listFileChainVersionsMany,
  listFileComments,
  listFileCommentsForFiles,
  reopenContentReview,
  resolveTaskFileChainLatest,
  resolveTaskFileChainLatestMany,
} from "../../server/repo/files";
import {
  getAssignmentScope,
  getMyTaskAssignments,
  getPortalData,
  listDeliverableCandidates,
  listDeliverableCandidatesForEvents,
  listLatestDeliverables,
  resolveChosenDeliverable,
  saveTaskFileCompletion,
  saveTaskFormResponse,
  type DeliverableCandidate,
} from "../../server/repo/portal";
import { deleteFileRow } from "../../server/repo/portal-config";
import { listFields } from "../../server/repo/forms";
import { validateAnswers } from "../../forms/validate";
import type { AnswerMap } from "../../forms/types";
import { fieldInputName } from "../../views/form-render";
import { extractFileAnswers } from "../../lib/submit-core";
import {
  assertServedContentTypeHeader,
  contentDispositionAttachment,
  isValidFileKind,
  MAX_COMMENT_BODY_LENGTH,
  sanitizeFilenameForKey,
  uploadHintText,
  validateUpload,
} from "../../domain/files";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import {
  DEC_016,
  DEC_020,
  DEC_023,
  DEC_028,
  DEC_029,
  DEC_240,
  DEC_242,
  DEC_244,
  DEC_605,
  DEC_657,
  DEC_696,
  DEC_891,
} from "../../decisions";
import { requireAuth, ensureCsrfCookie, assertOwnAssignmentOr403 } from "./tasks/shared";
import {
  TaskFormPage,
  TasksPage,
  type DeliverableChoiceInfo,
  type FileRequestExtras,
  type FileVersionRow,
} from "./tasks/views";
import { portalResourcesRoutes } from "./tasks/resources";

export const portalTasksRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_016;
void DEC_020;
void DEC_023;
void DEC_028;
void DEC_029;
void DEC_240;
void DEC_242;
void DEC_244;
void DEC_605;
void DEC_657;
void DEC_696;
void DEC_891;

portalTasksRoutes.use("*", speakerGate);

// -----------------------------------------------------------------------
// Routes: tasks
// -----------------------------------------------------------------------

// Shared loader for the /tasks list, factored out so a failed upload can
// re-render the SAME page inline (with an on-screen field error attached to
// the offending row) instead of the request falling through to the global
// JSON error handler — see the /upload route below for why this exists.
async function loadTasksPageData(c: Context<AppEnv>, contactId: string, orgId: string) {
  const [data, assignments] = await Promise.all([
    getPortalData(c.var.db, contactId, orgId),
    getMyTaskAssignments(c.var.db, contactId, orgId),
  ]);

  // DEC-530 (wave 48 amendment): collect every id this page needs BEFORE
  // issuing any read — the batched *Many/ForFiles readers below each cost a
  // query count proportional to chain DEPTH (or a constant), never to the
  // number of assignments/candidates on the page, so the loops after them
  // build the render maps in pure JS with no await inside.

  // DEC-244 (implements DEC-242): for every completed file_request
  // assignment, resolve the CHAIN-LATEST file (following previous_file_id
  // forward from the assignment's stored file id, so an organizer-side
  // replace via the submission files route is honored) and load its
  // display name/uploaded time/comment thread up front so TaskRow stays a
  // pure render — this org-scoped /tasks list already only ever contains
  // the caller's own assignments, so no further per-file authz is needed
  // here (ownership flows from the assignment, not the file row).
  const fileTaskAssignments = assignments.filter(
    (a) => a.kind === "file_request" && a.status === "complete" && a.fileId,
  );
  const fileIds = fileTaskAssignments.map((a) => a.fileId as string);

  // DEC-891 (wave 34 amendment): candidates are event-scoped (every accepted
  // session the caller holds in that event), not task-scoped, and this read
  // consumes only `assignments` (already in hand after wave 1) — so it joins
  // the chain-resolution wave below rather than waiting on it. One batched
  // statement over every distinct event id on the page (not one call per
  // event, and not one call per assignment).
  const deliverableAssignments = assignments.filter((a) => a.kind === "file_request" && a.deliverableKind != null);
  const eventIds = [...new Set(deliverableAssignments.map((a) => a.eventId))];

  const [latestByFileId, chainByFileId, candidatesByEventId] = await Promise.all([
    resolveTaskFileChainLatestMany(c.var.db, fileIds),
    listFileChainVersionsMany(c.var.db, fileIds),
    listDeliverableCandidatesForEvents(c.var.db, contactId, eventIds),
  ]);

  // Every id across every chain on the page, deduped — the single set
  // listFileCommentsForFiles reads comments for in one pass. This consumes
  // only chainByFileId (just resolved above), and listLatestDeliverables
  // below consumes only candidatesByEventId (also just resolved above) — so
  // the two reads are independent of each other and join the same wave.
  const allChainIds = [...new Set([...chainByFileId.values()].flatMap((chain) => chain.map((row) => row.id)))];

  // DEC-962/DEC-530: one batched "latest deliverable" read over every
  // candidate submission id this page could show (DEC-891's quiet
  // single-candidate rule already excludes rows that won't render), instead
  // of one getLatestDeliverable call per candidate per assignment.
  const relevantSubmissionIds = [
    ...new Set(
      deliverableAssignments.flatMap((a) => {
        const candidates = candidatesByEventId.get(a.eventId) ?? [];
        return candidates.length < 2 ? [] : candidates.map((cand) => cand.id); // conditional-and-quiet
      }),
    ),
  ];

  const [commentsByFileId, latestDeliverableBySubmissionId] = await Promise.all([
    listFileCommentsForFiles(c.var.db, allChainIds),
    listLatestDeliverables(c.var.db, contactId, orgId, relevantSubmissionIds),
  ]);

  const fileExtrasByAssignmentId = new Map<string, FileRequestExtras>();
  for (const a of fileTaskAssignments) {
    const fileId = a.fileId as string;
    const latest = latestByFileId.get(fileId);
    if (!latest) throw new Error(`loadTasksPageData: chain latest not resolved for file ${fileId} — data corruption`);
    const chain = chainByFileId.get(fileId);
    if (!chain) throw new Error(`loadTasksPageData: version chain not resolved for file ${fileId} — data corruption`);
    const versions: FileVersionRow[] = chain.map((row) => ({
      id: row.id,
      version: row.versionNo,
      filename: row.filename,
      uploadedAt: row.createdAt,
      isCurrent: row.id === latest.id,
    }));
    // The page's own "version N" text for the single-file block above —
    // the chain's last (newest) entry is the same file
    // resolveTaskFileChainLatestMany just resolved for this owner.
    const lastChainRow = chain[chain.length - 1];
    if (!lastChainRow) throw new Error("loadTasksPageData: empty version chain — data corruption");
    const version = lastChainRow.versionNo;
    // Every link's own bucket, flattened and re-sorted the same way
    // listFileComments orders a chain-wide thread (createdAt asc, id asc).
    const comments = chain
      .flatMap((row) => commentsByFileId.get(row.id) ?? [])
      .sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id));
    fileExtrasByAssignmentId.set(a.id, {
      filename: latest.filename,
      version,
      uploadedAt: latest.createdAt,
      comments,
      timezone: a.timezone,
      versions,
    });
  }

  const deliverableChoiceByAssignmentId = new Map<string, DeliverableChoiceInfo>();
  for (const a of deliverableAssignments) {
    const candidates = candidatesByEventId.get(a.eventId) ?? [];
    if (candidates.length < 2) continue; // conditional-and-quiet
    const linkedFilenames = new Map<string, string | null>();
    for (const cand of candidates) {
      linkedFilenames.set(cand.id, latestDeliverableBySubmissionId.get(cand.id)?.filename ?? null);
    }
    deliverableChoiceByAssignmentId.set(a.id, { candidates, linkedFilenames });
  }

  return { data, assignments, fileExtrasByAssignmentId, deliverableChoiceByAssignmentId };
}

portalTasksRoutes.get("/tasks", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");

  const { data, assignments, fileExtrasByAssignmentId, deliverableChoiceByAssignmentId } = await loadTasksPageData(
    c,
    contactId,
    auth.orgId,
  );

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  // DEC-020 amendment (wave 10): the /upload handler's post-redirect flag —
  // present only after a submission-linked upload, never persisted, purely
  // this one render's receipt.
  const uploadedAssignmentId = c.req.query("uploaded") || undefined;
  // CNT-04: present only right after an upload the DEC-922 guard refused to
  // chain onto this assignment's prior file — see the /upload route's
  // chainRestarted comment.
  const newSeriesAssignmentId = c.req.query("newSeries") || undefined;

  return c.html(
    <TasksPage
      branding={data.branding}
      assignments={assignments}
      csrfToken={csrfToken}
      formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
      fileExtrasFor={(id) => fileExtrasByAssignmentId.get(id)}
      deliverableChoiceFor={(id) => deliverableChoiceByAssignmentId.get(id)}
      speakerName={data.contactName}
      uploadedAssignmentId={uploadedAssignmentId}
      newSeriesAssignmentId={newSeriesAssignmentId}
    />,
  );
});

portalTasksRoutes.get("/tasks/:assignmentId/form", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "form" || !scope.formId) throw new ApiError("invalid", "This task is not a form task");

  const [data, assignments, fields] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
    listFields(c.var.db, scope.formId),
  ]);
  const assignment = assignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new ApiError("not_found", "Task assignment not found");

  const answers: AnswerMap = assignment.responseJson ? JSON.parse(assignment.responseJson) : {};
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  return c.html(
    <TaskFormPage
      branding={data.branding}
      assignment={assignment}
      fields={fields}
      answers={answers}
      csrfToken={csrfToken}
      speakerName={data.contactName}
    />,
  );
});

portalTasksRoutes.post("/tasks/:assignmentId/complete", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "general") throw new ApiError("invalid", "Only 'general' tasks complete this way");

  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date(), contactId);
  return c.redirect("/portal/tasks", 302);
});

portalTasksRoutes.post("/tasks/:assignmentId/form", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "form" || !scope.formId) throw new ApiError("invalid", "This task is not a form task");

  const fields = await listFields(c.var.db, scope.formId);
  const body = (await c.req.parseBody({ all: true })) as Record<string, unknown>;

  // DEC-040 amendment (wave 70): this assignment's OWN prior responseJson —
  // needed so an empty file part on re-submit carries the stored value
  // forward instead of clearing it (a submitted blank clears per DEC-842,
  // but a file INPUT with no new selection is silence, not a blank).
  const priorAssignments = await getMyTaskAssignments(c.var.db, contactId, auth.orgId);
  const priorAssignment = priorAssignments.find((a) => a.id === assignmentId);
  if (!priorAssignment) throw new ApiError("not_found", "Task assignment not found");
  const priorAnswers: AnswerMap = priorAssignment.responseJson ? JSON.parse(priorAssignment.responseJson) : {};

  const fileFields = fields.filter((field) => field.kind === "file");
  const fileAnswers = extractFileAnswers(
    fileFields.map((field) => field.id),
    fieldInputName,
    body,
  );

  const answers: AnswerMap = {};
  for (const field of fields) {
    const name = fieldInputName(field.id);
    if (field.kind === "checkbox") {
      answers[field.id] = body[name] !== undefined;
      continue;
    }
    if (field.kind === "file") continue; // handled in the upload loop below
    const raw = body[name];
    if (raw === undefined) continue;
    answers[field.id] = typeof raw === "string" ? raw : String(raw);
  }

  // DEC-040: mirrors the public CFP submit pipeline (src/routes/public/
  // submit.tsx) for file-kind fields — validate/store each newly-uploaded
  // file, ONE putThenRecord per field (never a bare store.put), and write
  // the resulting file id into `answers` BEFORE validateAnswers runs so its
  // required check sees a present answer. A field with no new upload keeps
  // its prior stored file id (carry-forward, not a clear); a field with
  // neither a new upload nor a prior value is simply absent, same as any
  // other unanswered field.
  //
  // DEC-040 wave-78 amendment: a re-answer of an already-filled file field
  // must chain onto the prior upload's row (previousFileId), never overwrite
  // it with an unlinked file — otherwise the earlier row + its R2 object are
  // orphaned forever, same defect DEC-922 already closed on the plain
  // ~/upload path below. Mirrors that route's chain-or-restart rule inline:
  // when the field's prior stored answer resolves to a file whose own
  // submissionId is null (a form 'handout' answer never carries one) and
  // whose kind is 'handout', the new file chains onto it; any mismatch (a
  // legacy/foreign row) just starts a fresh chain — never a 400 here, this
  // is never a validation error for the speaker.
  const store = makeFileStore(c.env.FILES);
  const fileErrors: Record<string, string> = {};
  // DEC-040 amendment (wave 74): every file this request writes gets tracked
  // here so a validation failure below can roll them back — mirrors the
  // public CFP path (src/routes/public/submit.tsx) instead of leaking an R2
  // object + `file` row on every failed multi-field attempt. A carried-
  // forward prior file id (the `priorAnswers` branch above) is NEVER added
  // here — it isn't this request's write, so it must never be deleted.
  const writtenFiles: { r2Key: string; fileId: string }[] = [];
  for (const field of fileFields) {
    const file = fileAnswers[field.id];
    if (!file) {
      const prior = priorAnswers[field.id];
      if (typeof prior === "string" && prior) {
        answers[field.id] = prior;
      }
      continue;
    }
    const validation = validateUpload({ filename: file.name, sizeBytes: file.size, kind: "handout" });
    if (!validation.ok) {
      fileErrors[field.id] = validation.message;
      continue;
    }
    const r2Key = `task/${assignmentId}/${newId()}-${sanitizeFilenameForKey(file.name)}`;
    let previousFileId: string | null = null;
    const priorValue = priorAnswers[field.id];
    if (typeof priorValue === "string" && priorValue) {
      const target = await getReplacesTarget(c.var.db, priorValue);
      if (target && target.submissionId === null && target.kind === "handout") {
        previousFileId = priorValue;
      }
      // else: a mismatch (legacy/foreign row) — fresh chain, never a 400.
    }
    const fileId = await putThenRecord(store, r2Key, file.stream(), validation.servedContentType, () =>
      insertFile(c.var.db, {
        submissionId: null,
        kind: "handout",
        filename: file.name,
        r2Key,
        sizeBytes: file.size,
        contentType: validation.servedContentType,
        previousFileId,
        uploadedByContactId: contactId,
        taskAssignmentId: assignmentId,
      }),
    );
    answers[field.id] = fileId;
    writtenFiles.push({ r2Key, fileId });
  }

  const validation = validateAnswers(fields, answers);
  const hasFileErrors = Object.keys(fileErrors).length > 0;
  if (!validation.ok || hasFileErrors) {
    // DEC-040 amendment (wave 74): a validation failure on ANY field must
    // not leave this request's already-uploaded files behind — delete their
    // `file` rows and the R2 objects before rendering the 400.
    //
    // DEC-713 ordering (amended wave 50/51, scanned by
    // test/file-delete-ordering.scan.test.ts): the DB rows commit FIRST,
    // then the R2 objects are deleted in a try whose catch logs and
    // swallows. The two failure modes are not symmetric — a surviving `file`
    // row pointing at missing bytes 404s forever, while an object outliving
    // its row is just an unreferenced blob, invisible and reclaimable. So a
    // cleanup failure never replaces the validation error the speaker
    // actually needs to see: they still get their 400 naming the bad field.
    if (writtenFiles.length > 0) {
      for (const f of writtenFiles) {
        await deleteFileRow(c.var.db, f.fileId);
      }
      try {
        await store.deleteMany(writtenFiles.map((f) => f.r2Key));
      } catch (err) {
        console.error(
          `portal/tasks form rollback: store.deleteMany failed for assignment ${assignmentId} after row commit (${writtenFiles.length} keys)`,
          err,
        );
      }
    }
    const mergedErrors = { ...(validation.ok ? {} : validation.errors), ...fileErrors };
    const data = await getPortalData(c.var.db, contactId, auth.orgId);
    const assignment = priorAssignments.find((a) => a.id === assignmentId);
    if (!assignment) throw new ApiError("not_found", "Task assignment not found");
    const { token: csrfToken } = ensureCsrfCookie(c);
    return c.html(
      <TaskFormPage
        branding={data.branding}
        assignment={assignment}
        fields={fields}
        answers={answers}
        csrfToken={csrfToken}
        errors={mergedErrors}
        speakerName={data.contactName}
      />,
      400,
    );
  }

  await saveTaskFormResponse(c.var.db, assignmentId, contactId, JSON.stringify(validation.cleaned));
  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date(), contactId);
  return c.redirect("/portal/tasks", 302);
});

portalTasksRoutes.post("/tasks/:assignmentId/upload", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request") throw new ApiError("invalid", "Only 'file_request' tasks complete this way");

  const body = await c.req.parseBody();
  const file = body["file"];

  // Disallowed extension/MIME or an over-cap size (SPEC §6) must produce a
  // clear ON-SCREEN error, same page, same URL — NOT the raw
  // {"error":{...}} JSON blob the global onError handler renders for a
  // full-page form POST (a real regression found live in-browser: a
  // full-page navigation landing on unstyled JSON is not a "clear
  // on-screen error" by any reading of that requirement). Mirrors the
  // existing /tasks/:id/form validation-failure pattern: re-render
  // TasksPage inline (400, not a redirect) with the field error attached
  // to the offending row via errorFor, instead of throwing.
  async function reRenderWithError(message: string): Promise<Response> {
    const { data, assignments, fileExtrasByAssignmentId, deliverableChoiceByAssignmentId } = await loadTasksPageData(
      c,
      contactId as string,
      auth.orgId,
    );
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    return c.html(
      <TasksPage
        branding={data.branding}
        assignments={assignments}
        csrfToken={csrfToken}
        formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
        fileExtrasFor={(id) => fileExtrasByAssignmentId.get(id)}
        deliverableChoiceFor={(id) => deliverableChoiceByAssignmentId.get(id)}
        errorFor={(id) => (id === assignmentId ? message : undefined)}
        speakerName={data.contactName}
      />,
      400,
    );
  }

  if (!(file instanceof File)) {
    return reRenderWithError("Choose a file first — nothing was uploaded.");
  }

  // DEC-240 (supersedes DEC-029's submission_id-null/'handout'-only rule),
  // amended by DEC-549: a task upload is a session deliverable ONLY when the
  // task opts in by declaring deliverable_kind. When scope.deliverableKind
  // is set, kind = that value, and the upload links to a submission the
  // uploader themself named — DEC-891 replaces the old deterministic
  // lowest-seq tie-break with an explicit `submissionId` choice whenever the
  // speaker has more than one eligible session (resolveChosenDeliverable
  // 403s a foreign id, 400s a missing choice when one is required),
  // chaining previous_file_id on re-upload instead of minting an unlinked
  // file each time. When deliverable_kind is null, the task is a plain
  // 'handout' request with NO submission link — submissionId is null and
  // the candidate lookup never runs, so the file never joins a submission's
  // deliverable-authz population.
  let kind: string;
  let submissionId: string | null;
  if (scope.deliverableKind != null) {
    kind = scope.deliverableKind;
    const rawChosen = body["submissionId"];
    const chosenId = typeof rawChosen === "string" && rawChosen.length > 0 ? rawChosen : null;
    const candidates = await listDeliverableCandidates(c.var.db, contactId, scope.eventId);
    submissionId = resolveChosenDeliverable(candidates, chosenId);
  } else {
    kind = "handout";
    submissionId = null;
  }
  if (!isValidFileKind(kind)) throw new Error(`invalid task.deliverable_kind persisted: ${kind}`);
  const validation = validateUpload({ filename: file.name, sizeBytes: file.size, kind });
  if (!validation.ok) {
    // DEC-657 (wave 28 amendment): a refusal names the accepted formats and
    // why, sourced from src/domain/files.ts's own uploadHintText -- never a
    // re-typed copy of the allowlist -- and, on a replace (this assignment
    // already carries a completed file), says what survived so the speaker
    // knows their existing upload was not touched.
    const survivalNote = scope.fileId ? " Your current file is unchanged. Nothing was replaced." : "";
    return reRenderWithError(`${validation.message} ${uploadHintText(kind)}${survivalNote}`);
  }

  const sanitized = sanitizeFilenameForKey(file.name);
  const r2Key = `task/${assignmentId}/${newId()}-${sanitized}`;
  const store = makeFileStore(c.env.FILES);

  // DEC-922: scope.fileId is this assignment's PREVIOUS upload, but the
  // speaker may have re-chosen a different eligible submission via
  // DEC-891's explicit picker (`submissionId` above) since that prior
  // upload. Chaining onto it unconditionally would let insertFile label
  // another submission's deliverable 'v2' and let
  // resolveTaskFileChainLatest (files-versions.ts) serve it back as THIS
  // task's file. Mirror domain/files.ts's isValidVersionChain rule
  // (same submissionId + same kind, null-submissionId handouts included)
  // inline, since insertFile's previousFileId is only ever this
  // assignment's own prior file, never a cross-submission id: this is not
  // a validation error for the speaker (never 400 here) — a mismatch just
  // means a fresh chain starts at v1 for the newly chosen submission.
  // CNT-04 (wave 26 re-open of DEC-922): when the guard above legitimately
  // refuses to continue the chain (a real submission/kind mismatch against
  // this assignment's own prior file), that refusal must be legible to the
  // speaker instead of silent — a bare redirect back to the same task list
  // is indistinguishable from data loss. chainRestarted flags this case for
  // the redirect below; it is never set on a first-ever upload (scope.fileId
  // null, nothing to have restarted from).
  let previousFileId: string | null = null;
  let chainRestarted = false;
  if (scope.fileId) {
    const target = await getReplacesTarget(c.var.db, scope.fileId);
    if (target && target.submissionId === submissionId && target.kind === kind) {
      previousFileId = scope.fileId;
    } else {
      chainRestarted = true;
    }
  }

  const fileId = await putThenRecord(store, r2Key, file.stream(), validation.servedContentType, () =>
    insertFile(c.var.db, {
      submissionId,
      kind,
      filename: file.name,
      r2Key,
      sizeBytes: file.size,
      contentType: validation.servedContentType,
      previousFileId,
      uploadedByContactId: contactId,
      taskAssignmentId: assignmentId,
    }),
  );

  // DEC-020 amendment: a new deliverable version reopens content review.
  // submissionId is null for a plain 'handout' task (no submission link) —
  // reopen only when this upload is a real, submission-linked deliverable.
  // kind is already narrowed to FILE_KINDS above (never HEADSHOT_KIND).
  // DEC-020 wave-58 amendment: reopenContentReview now returns
  // `{ reopened }` — this route's own disclosure is unconditional on
  // submissionId (see the redirect below), not on that flag, so the value
  // is intentionally unused here.
  if (submissionId) {
    await reopenContentReview(c.var.db, scope.eventId, submissionId);
  }

  await saveTaskFileCompletion(c.var.db, assignmentId, contactId, fileId);
  await updateAssignmentStatus(c.var.db, assignmentId, "complete", auth.userId, new Date(), contactId);
  // DEC-020 amendment (wave 10): the reopen above (submissionId != null) is
  // otherwise silent — a speaker who just posted a new deck gets no receipt
  // that it pulled their accepted session off the public schedule pending
  // re-approval. A plain handout upload (submissionId null, no reopen)
  // keeps today's bare redirect — nothing to disclose.
  const redirectParams = new URLSearchParams();
  if (submissionId) redirectParams.set("uploaded", assignmentId);
  // CNT-04: name the restart on the redirect so the tasks list can render a
  // plain line disclosing it — see chainRestarted above.
  if (chainRestarted) redirectParams.set("newSeries", assignmentId);
  const redirectQs = redirectParams.toString();
  return c.redirect(redirectQs ? `/portal/tasks?${redirectQs}` : "/portal/tasks", 302);
});

// DEC-244 (implements DEC-242): reply on a completed file_request
// assignment's file comment thread, anchored to the CHAIN-LATEST file id
// (same anchor rule as the organizer DeliverableDetail view, which shows
// comments[latest.id]) — not the assignment's raw stored file id, so a
// reply always lands on the thread the current version's viewers see.
// Authorized strictly through getAssignmentScope + assertOwnAssignmentOr403
// (existence-hiding: an unknown/foreign assignmentId 404s/403s before any
// file is ever looked up) — identical to the upload route's authz.
portalTasksRoutes.post("/tasks/:assignmentId/comments", csrfForm, async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("invalid", "This task has no uploaded file to comment on");
  }

  const body = await c.req.parseBody();
  const raw = body["body"];
  const text = typeof raw === "string" ? raw : "";
  const trimmed = text.trim();

  // DEC-244 amendment (wave 56): a producer-input refusal here (empty body,
  // over-cap body) must fail the way the upload route's reRenderWithError
  // already fails — inline, same page, with the speaker's typed text kept —
  // never the bare thrown ApiError that used to lose the draft into the
  // global JSON handler. Authz refusals above (not_found / wrong kind / no
  // file) still throw: those aren't something the speaker typed.
  async function reRenderWithCommentError(message: string): Promise<Response> {
    const { data, assignments, fileExtrasByAssignmentId, deliverableChoiceByAssignmentId } = await loadTasksPageData(
      c,
      contactId as string,
      auth.orgId,
    );
    const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
    if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
    return c.html(
      <TasksPage
        branding={data.branding}
        assignments={assignments}
        csrfToken={csrfToken}
        formLinkFor={(a) => `/portal/tasks/${a.id}/form`}
        fileExtrasFor={(id) => fileExtrasByAssignmentId.get(id)}
        deliverableChoiceFor={(id) => deliverableChoiceByAssignmentId.get(id)}
        commentErrorFor={(id) => (id === assignmentId ? message : undefined)}
        commentDraftBodyFor={(id) => (id === assignmentId ? text : undefined)}
        speakerName={data.contactName}
      />,
      200,
    );
  }

  if (!trimmed) {
    return reRenderWithCommentError("A reply can't be empty.");
  }
  if (trimmed.length > MAX_COMMENT_BODY_LENGTH) {
    return reRenderWithCommentError(overCapSentence("Reply", trimmed.length, MAX_COMMENT_BODY_LENGTH));
  }

  const latest = await resolveTaskFileChainLatest(c.var.db, scope.fileId);
  await insertFileComment(c.var.db, {
    fileId: latest.id,
    body: trimmed,
    authorUserId: auth.userId,
    authorContactId: contactId,
  });
  return c.redirect("/portal/tasks", 302);
});

// DEC-244: streams the CHAIN-LATEST version of a completed file_request
// assignment's deliverable — authz identical to the upload route
// (getAssignmentScope + assertOwnAssignmentOr403 + org scope), deliberately
// NOT the organizer /files route, so a speaker's own portal session is
// self-sufficient for downloading their own uploads.
portalTasksRoutes.get("/tasks/:assignmentId/file", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("not_found", "This task has no uploaded file");
  }

  const latest = await resolveTaskFileChainLatest(c.var.db, scope.fileId);
  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(latest.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  return c.body(obj.body, 200, {
    "Content-Type": assertServedContentTypeHeader(latest.contentType),
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDispositionAttachment(latest.filename),
  });
});

// DEC-605: streams ANY version in a completed file_request assignment's
// chain, not just the chain-latest — same assignment-ownership check as the
// /file route above, then asserts the requested :fileId actually walks back
// to THIS assignment's chain root before streaming. An id in the URL is
// never evidence of ownership by itself: listFileChainVersions is called
// against the assignment's OWN stored fileId (never the untrusted URL
// param), and the URL param is only ever used as a membership lookup key
// against that trusted chain — so a fileId belonging to a different
// assignment/chain 404s (existence-hiding), never a 403 that would confirm
// the id is real.
portalTasksRoutes.get("/tasks/:assignmentId/file/:fileId", async (c) => {
  const auth = requireAuth(c);
  const contactId = auth.contactId;
  if (!contactId) throw new Error("speaker auth session missing contact_id — invariant violated");
  const assignmentId = c.req.param("assignmentId");
  const requestedFileId = c.req.param("fileId");

  const scope = await getAssignmentScope(c.var.db, assignmentId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Task assignment not found");
  assertOwnAssignmentOr403(scope, contactId);
  if (scope.kind !== "file_request" || !scope.fileId) {
    throw new ApiError("not_found", "This task has no uploaded file");
  }

  const chain = await listFileChainVersions(c.var.db, scope.fileId);
  const target = chain.find((v) => v.id === requestedFileId);
  if (!target) throw new ApiError("not_found", "File not found in this task's version history");

  const store = makeFileStore(c.env.FILES);
  const obj = await store.get(target.r2Key);
  if (!obj) throw new ApiError("not_found", "File contents not found");

  return c.body(obj.body, 200, {
    "Content-Type": assertServedContentTypeHeader(target.contentType),
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": contentDispositionAttachment(target.filename),
  });
});

// -----------------------------------------------------------------------
// Routes: resources (see ./tasks/resources.tsx)
// -----------------------------------------------------------------------

portalTasksRoutes.route("/", portalResourcesRoutes);
