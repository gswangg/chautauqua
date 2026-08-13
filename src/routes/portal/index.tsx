// Speaker portal shell, per DEC-005 (/portal/* Hono JSX SSR, light
// progressive enhancement) + DEC-012 (thin handlers: gate -> repo -> render)
// + DEC-016 (status label mapping never leaks internal queue states)
// + DEC-028 (shared gate/layout) + DEC-029 (Sessions/invitations depth).
//
// Route files export a named Hono sub-app; only src/index.ts mounts it.

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { speakerGate, PortalLayout } from "./shared";
import { formatCalendarDate, formatEventDate } from "../../lib/event-time";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import {
  assertSpeakerContactId,
  canTransitionInvite,
  getLatestDeliverable,
  getMyInvitations,
  getMySessions,
  getMySubmissions,
  getMyTaskAssignments,
  getParticipantScope,
  getPortalData,
  getPortalSubmissionDetail,
  nextInviteStatus,
  setInviteStatus,
  type InviteAction,
  type PortalData,
  type PortalDeliverable,
  type PortalInvitation,
  type PortalSession,
  type PortalSubmissionDetail,
  type PortalSubmissionListItem,
  type PortalTaskAssignment,
} from "../../server/repo/portal";
import { DEC_729 } from "../../decisions";

void DEC_729;
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { loadEditableSubmission, getPortalParticipants, type PortalParticipant } from "../../server/repo/portal-edit";
import { canEditSubmission } from "../../domain/edit-lock";
import { ensureOnboardingTasks, getSubmissionStatusForParticipant } from "../../server/repo/submissions";

export const portalRoutes = new Hono<AppEnv>();

portalRoutes.use("*", speakerGate);

function ensureCsrfCookie(c: {
  req: { header(name: string): string | undefined; url: string };
}): {
  token: string;
  setCookieIfNew: string | null;
} {
  const cookies = parseCookies(c.req.header("cookie") ?? null);
  const existing = cookies[CSRF_COOKIE_NAME];
  if (existing) return { token: existing, setCookieIfNew: null };
  const token = newCsrfToken();
  return {
    token,
    setCookieIfNew: buildCsrfCookie(token, { secure: isSecureRequest(c.req.url) }),
  };
}

// DEC-590: the worklist is exactly two kinds of row — a pending task
// assignment and a pending co-presenter invitation. Nothing else may ever
// contribute to its count or its rendering.
type WorklistRow =
  | { kind: "task"; task: PortalTaskAssignment }
  | { kind: "invitation"; invitation: PortalInvitation };

function rowRequired(row: WorklistRow): boolean {
  return row.kind === "task" ? row.task.required : false;
}

function rowDueDate(row: WorklistRow): number | null {
  return row.kind === "task" ? row.task.dueDate : null;
}

/** Required rows first, then by due date ascending (no due date sorts
 * last within its required/not-required bucket) — ties keep the original
 * (stable) order. DEC-590: overdue is stated as weight/wording on the row
 * itself, never as a sort-breaking colour channel. */
function sortWorklist(rows: WorklistRow[]): WorklistRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const requiredDelta = Number(rowRequired(b.row)) - Number(rowRequired(a.row));
      if (requiredDelta !== 0) return requiredDelta;
      const dueA = rowDueDate(a.row);
      const dueB = rowDueDate(b.row);
      if (dueA === null && dueB === null) return a.index - b.index;
      if (dueA === null) return 1;
      if (dueB === null) return -1;
      if (dueA !== dueB) return dueA - dueB;
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

function taskActionHref(t: PortalTaskAssignment): string {
  return t.kind === "form" ? `/portal/tasks/${t.id}/form` : `/portal/tasks#task-${t.id}`;
}

function taskActionLabel(t: PortalTaskAssignment): string {
  if (t.kind === "form") return "Fill out form";
  if (t.kind === "file_request") return "Upload file";
  return "Open task";
}

function WorklistTaskRow(props: { task: PortalTaskAssignment; now: number }) {
  const { task: t, now } = props;
  const overdue = t.dueDate !== null && t.dueDate < now;
  return (
    <div class="chq-portal-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          {t.title}
          {t.required ? <strong> (required)</strong> : null}
        </span>
        {/* DEC-367/DEC-590: overdue is carried by weight + wording, never a
            red swatch. */}
        {overdue ? <strong class="chq-flag">Overdue</strong> : null}
      </div>
      {t.dueDate ? <span class="chq-portal-due">Due {formatCalendarDate(t.dueDate)}</span> : null}
      <div class="chq-portal-actions">
        <a href={taskActionHref(t)} class="chq-btn chq-btn-primary">
          {taskActionLabel(t)}
        </a>
      </div>
    </div>
  );
}

function WorklistInvitationRow(props: { invitation: PortalInvitation; csrfToken: string }) {
  const { invitation: inv, csrfToken } = props;
  return (
    <div class="chq-portal-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">
          Invited to co-present "{inv.title}" ({inv.ref}) at {inv.eventName}
        </span>
      </div>
      <div class="chq-portal-actions">
        <form method="post" action={`/portal/invitations/${inv.participantId}`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          <input type="hidden" name="action" value="accept" />
          <button type="submit" class="chq-btn chq-btn-primary">Accept</button>
        </form>
        <form method="post" action={`/portal/invitations/${inv.participantId}`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={csrfToken} />
          <input type="hidden" name="action" value="decline" />
          <button type="submit" class="chq-btn chq-btn-secondary">Decline</button>
        </form>
      </div>
    </div>
  );
}

/** DEC-590/w15-b subline: "<Event name> · you speak <day>, <HH:MM>, <room>"
 * when the speaker has an accepted session that's actually been placed on
 * the schedule (day + startMin both set); else the event name alone. The
 * first such placed session is used — the portal home states one line, not
 * a per-session list. */
function scheduledSubline(eventName: string, sessions: PortalSession[]): string {
  const placed = sessions.find((s) => s.day !== null && s.startMin !== null);
  if (!placed) return eventName;
  const room = placed.roomName ? `, ${placed.roomName}` : "";
  return `${eventName} · you speak ${placed.day}, ${minutesToClock(placed.startMin)}${room}`;
}

function SessionCard(props: { session: PortalSession; deliverable: PortalDeliverable | null }) {
  const { session: s, deliverable } = props;
  const metaParts = [
    s.trackName,
    s.acceptedAt !== null ? `accepted ${formatEventDate(s.acceptedAt, s.timezone)}` : null,
  ].filter((p): p is string => p !== null);
  return (
    <div class="chq-portal-row">
      <span class="chq-portal-row-title">{s.title}</span>
      {metaParts.length > 0 ? <span class="chq-portal-due">{metaParts.join(" · ")}</span> : null}
      {deliverable ? (
        <span class="chq-portal-detail">
          {deliverable.filename} · uploaded {formatEventDate(deliverable.uploadedAt, s.timezone)}
        </span>
      ) : null}
      <div class="chq-portal-actions">
        <a href="/portal/tasks" class="chq-btn chq-btn-secondary">Upload again</a>
        <a href="/portal/resources" class="chq-btn chq-btn-secondary">Read notes</a>
      </div>
    </div>
  );
}

function DoneRow(props: { task: PortalTaskAssignment }) {
  const { task: t } = props;
  return (
    <div class="chq-portal-row chq-portal-done-row">
      <span class="chq-portal-row-title">{t.title}</span>
      <span class="chq-portal-done-when">{t.completedAt !== null ? formatEventDate(t.completedAt, t.timezone) : ""}</span>
    </div>
  );
}

// DEC-729: one row per submission the speaker owns — REF · format · track
// (whichever parts exist) plus a public status label, linked to the detail
// page. No participants/answers here; that's the detail page's job.
function SubmissionRow(props: { submission: PortalSubmissionListItem }) {
  const { submission: s } = props;
  const metaParts = [s.ref, s.format, s.trackName].filter((p): p is string => p !== null && p.length > 0);
  return (
    <a href={`/portal/submissions/${s.id}`} class="chq-portal-row chq-portal-submission-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">{s.title}</span>
        <span class="chq-flag">{s.statusLabel}</span>
      </div>
      {metaParts.length > 0 ? <span class="chq-portal-due">{metaParts.join(" · ")}</span> : null}
    </a>
  );
}

function PortalPage(props: {
  data: PortalData;
  sessions: PortalSession[];
  invitations: PortalInvitation[];
  taskAssignments: PortalTaskAssignment[];
  deliverables: Map<string, PortalDeliverable | null>;
  submissions: PortalSubmissionListItem[];
  csrfToken: string;
}) {
  const { branding, contactName, contactCompany } = props.data;
  const { sessions, invitations, taskAssignments, deliverables, submissions, csrfToken } = props;
  const now = Date.now();

  // DEC-590: n is EXACTLY the count of rows rendered below — pending task
  // assignments plus pending co-presenter invitations, nothing else (no
  // completed task, no accepted session, no submission).
  const pendingTasks = taskAssignments.filter((t) => t.status !== "complete");
  const doneTasks = taskAssignments.filter((t) => t.status === "complete");
  const worklist = sortWorklist([
    ...pendingTasks.map((task): WorklistRow => ({ kind: "task", task })),
    ...invitations.map((invitation): WorklistRow => ({ kind: "invitation", invitation })),
  ]);
  const n = worklist.length;

  const footerExtra = (
    <div class="chq-portal-footer-band">
      <span class="chq-portal-footer-who">
        {contactName}
        {contactCompany ? ` · ${contactCompany}` : ""}
      </span>
      {/* w15-b: /portal/resources must stay reachable even when the
          speaker has no accepted session (so no "Read notes" link renders
          in a Your session card) — the footer is the always-present path. */}
      <a href="/portal/resources" class="chq-portal-footer-resources">Resources</a>
      <a href="/portal/profile" class="chq-portal-footer-profile">Profile</a>
    </div>
  );

  return (
    <PortalLayout branding={branding} csrfToken={csrfToken} speakerName={contactName} footerExtra={footerExtra}>
      <h1 class="chq-portal-hero">
        {n} {n === 1 ? "thing" : "things"} to do
      </h1>
      <p class="chq-portal-sub">{scheduledSubline(branding.eventName, sessions)}</p>

      <section aria-label="Waiting on you" class="chq-section">
        <div class="chq-section-label">Waiting on you</div>
        {n === 0 ? (
          <p>Nothing pending right now.</p>
        ) : (
          worklist.map((row) =>
            row.kind === "task" ? (
              <WorklistTaskRow task={row.task} now={now} />
            ) : (
              <WorklistInvitationRow invitation={row.invitation} csrfToken={csrfToken} />
            ),
          )
        )}
        <p>
          <a href="/portal/tasks">View all tasks</a>
        </p>
      </section>

      {/* DEC-729: every submission the speaker owns, pending/accepted/
          declined alike — not just the ones getMySessions restricts to
          accepted. */}
      <section aria-label="Your submissions" class="chq-section">
        <div class="chq-section-label">Your submissions</div>
        {submissions.length === 0 ? (
          <p>No submissions yet.</p>
        ) : (
          submissions.map((s) => <SubmissionRow submission={s} />)
        )}
        <p>
          <a href="/portal/submissions">View all submissions</a>
        </p>
      </section>

      <section aria-label="Your session" class="chq-section">
        <div class="chq-section-label">Your session</div>
        {sessions.length === 0 ? (
          <p>No accepted sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <SessionCard session={s} deliverable={deliverables.get(s.submissionId) ?? null} />
          ))
        )}
      </section>

      <section aria-label="Done" class="chq-section">
        <div class="chq-section-label">Done</div>
        {doneTasks.length === 0 ? (
          <p>Nothing completed yet.</p>
        ) : (
          doneTasks.map((t) => <DoneRow task={t} />)
        )}
      </section>
    </PortalLayout>
  );
}

function minutesToClock(min: number | null): string {
  if (min === null) return "";
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// DEC-729 (w1-c rebuild): docs/design "Portal · Your session" frame —
// uppercase status badge + submitted date, title, "REF · format · track"
// line, a placement line only when the session has actually landed on the
// schedule (day + startMin both set, same placed-test as scheduledSubline),
// Abstract, a Slides/deliverable card, then the existing Participants/
// Answers sections this task doesn't remove.
function SubmissionDetailPage(props: {
  branding: PortalData["branding"];
  detail: PortalSubmissionDetail;
  editable: boolean;
  csrfToken: string;
  participants: PortalParticipant[];
  deliverable: PortalDeliverable | null;
}) {
  const { detail, editable, participants, deliverable } = props;
  const metaParts = [detail.ref, detail.format, detail.trackName].filter(
    (p): p is string => p !== null && p.length > 0,
  );
  const placed = detail.day !== null && detail.startMin !== null;
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken}>
      <a href="/portal/submissions" class="chq-portal-back">&larr; Back to My Submissions</a>
      <span class="chq-flag chq-portal-status-badge">
        {detail.statusLabel} · {formatCalendarDate(detail.submittedAt)}
      </span>
      <h2 class="chq-portal-hero">{detail.title}</h2>
      {metaParts.length > 0 ? <span class="chq-portal-sub">{metaParts.join(" · ")}</span> : null}
      {placed ? (
        <span class="chq-portal-sub">
          {detail.day}, {minutesToClock(detail.startMin)}
          {detail.roomName ? ` · ${detail.roomName}` : ""}
        </span>
      ) : null}
      {editable ? (
        <div class="chq-portal-actions">
          <a href={`/portal/submissions/${detail.id}/edit`} class="chq-btn chq-btn-secondary">Edit submission</a>
        </div>
      ) : null}

      <div class="chq-section-label">Abstract</div>
      {detail.description ? <p>{detail.description}</p> : <p>No abstract yet.</p>}

      <div class="chq-section-label">Slides</div>
      {deliverable ? (
        <div class="chq-portal-row">
          <span class="chq-portal-row-title">{deliverable.filename}</span>
          <span class="chq-portal-due">Uploaded {formatEventDate(deliverable.uploadedAt, detail.timezone)}</span>
        </div>
      ) : (
        <p>Nothing uploaded yet.</p>
      )}

      <h3 class="chq-section-label">Participants</h3>
      {participants.length === 0 ? (
        <p>No participants yet.</p>
      ) : (
        <ul>
          {participants.map((p) => (
            <li>
              {p.name} — <span class="chq-flag">{p.roleLabel}</span>
            </li>
          ))}
        </ul>
      )}
      <h3 class="chq-section-label">Answers</h3>
      {detail.answers.length === 0 ? (
        <p>No additional answers.</p>
      ) : (
        <dl>
          {detail.answers.map((a) => (
            <>
              <dt>{a.label}</dt>
              <dd>{String(a.value)}</dd>
            </>
          ))}
        </dl>
      )}
    </PortalLayout>
  );
}

// DEC-729: /portal/submissions full-page list — the same rows the portal
// home's "Your submissions" section renders, just not truncated by the
// home page's other sections.
function SubmissionsListPage(props: { branding: PortalData["branding"]; csrfToken: string; submissions: PortalSubmissionListItem[] }) {
  const { submissions } = props;
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken}>
      <a href="/portal" class="chq-portal-back">&larr; Your portal</a>
      <h1 class="chq-portal-hero">Your submissions</h1>
      {submissions.length === 0 ? (
        <p>No submissions yet.</p>
      ) : (
        submissions.map((s) => <SubmissionRow submission={s} />)
      )}
    </PortalLayout>
  );
}

portalRoutes.get("/", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const [data, sessions, invitations, taskAssignments, submissions] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMySessions(c.var.db, contactId, auth.orgId),
    getMyInvitations(c.var.db, contactId, auth.orgId),
    getMyTaskAssignments(c.var.db, contactId, auth.orgId),
    getMySubmissions(c.var.db, contactId, auth.orgId),
  ]);
  const deliverableEntries = await Promise.all(
    sessions.map(async (s): Promise<[string, PortalDeliverable | null]> => [
      s.submissionId,
      await getLatestDeliverable(c.var.db, s.submissionId),
    ]),
  );
  const deliverables = new Map(deliverableEntries);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <PortalPage
      data={data}
      sessions={sessions}
      invitations={invitations}
      taskAssignments={taskAssignments}
      deliverables={deliverables}
      submissions={submissions}
      csrfToken={csrfToken}
    />,
  );
});

// GET /portal/submissions — DEC-729: the full-page list of every submission
// this speaker owns, not truncated by the home page's worklist/session/done
// sections.
portalRoutes.get("/submissions", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const [data, submissions] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMySubmissions(c.var.db, contactId, auth.orgId),
  ]);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(<SubmissionsListPage branding={data.branding} csrfToken={csrfToken} submissions={submissions} />);
});

portalRoutes.get("/submissions/:id", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const id = c.req.param("id");
  const detail = await getPortalSubmissionDetail(c.var.db, id, contactId, auth.orgId);
  if (!detail) {
    return c.text("Not found", 404);
  }
  // Re-derive branding for the header; cheap relative to the round trip
  // already spent on the detail query, and keeps this handler thin.
  const data = await getPortalData(c.var.db, contactId, auth.orgId);
  // DEC-041: the edit link only shows when the submission is still
  // editable (accepted, or the form window is open).
  const editData = await loadEditableSubmission(c.var.db, contactId, id);
  const editable = editData
    ? canEditSubmission(editData.submission.status, editData.form.closeDate, Date.now(), editData.form.timezone)
    : false;
  const participants = await getPortalParticipants(c.var.db, id);
  const deliverable = await getLatestDeliverable(c.var.db, id);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(
    <SubmissionDetailPage
      branding={data.branding}
      detail={detail}
      editable={editable}
      csrfToken={csrfToken}
      participants={participants}
      deliverable={deliverable}
    />,
  );
});

// POST /portal/invitations/:participantId { action: 'accept'|'decline' } —
// own participant rows only, and only rows currently invite_status='invited'
// may transition (DEC-029).
portalRoutes.post("/invitations/:participantId", csrfForm, async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const participantId = c.req.param("participantId");

  const scope = await getParticipantScope(c.var.db, participantId);
  if (!scope || scope.orgId !== auth.orgId) throw new ApiError("not_found", "Invitation not found");
  if (scope.contactId !== contactId) throw new ApiError("forbidden", "This invitation does not belong to you");
  if (!canTransitionInvite(scope.inviteStatus)) {
    throw new ApiError("invalid", "This invitation has already been responded to");
  }

  const body = await c.req.parseBody();
  const action = body["action"];
  if (action !== "accept" && action !== "decline") {
    throw new ApiError("invalid", "action must be 'accept' or 'decline'", { action: "Invalid value" });
  }

  const nextStatus = nextInviteStatus(action as InviteAction);
  await setInviteStatus(c.var.db, participantId, nextStatus);

  // DEC-278: accepting an invitation on a submission that is ALREADY
  // 'accepted' never re-fires updateSubmissionStatuses' fireAcceptance
  // branch (that only fires once, at the original accept transition), so
  // this speaker would otherwise never get onboarding tasks planned. Never
  // sends email on this path (product principle 4).
  if (nextStatus === "accepted") {
    const submissionInfo = await getSubmissionStatusForParticipant(c.var.db, participantId);
    if (submissionInfo && submissionInfo.status === "accepted") {
      await ensureOnboardingTasks(c.var.db, submissionInfo.eventId, submissionInfo.submissionId, [contactId], new Date());
    }
  }

  return c.redirect("/portal", 302);
});
