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
  getMyInvitations,
  getMySessions,
  getParticipantScope,
  getPortalData,
  getPortalSubmissionDetail,
  nextInviteStatus,
  setInviteStatus,
  type InviteAction,
  type PortalData,
  type PortalInvitation,
  type PortalSession,
  type PortalSubmissionDetail,
} from "../../server/repo/portal";
import {
  parseCookies,
  newCsrfToken,
  buildCsrfCookie,
  isSecureRequest,
  CSRF_COOKIE_NAME,
} from "../../auth/cookies";
import { loadEditableSubmission } from "../../server/repo/portal-edit";
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

function Nav() {
  return (
    <nav aria-label="Portal navigation" class="chq-nav">
      <a href="/portal">Dashboard</a> | <a href="/portal/profile">Profile</a> |{" "}
      <a href="/portal/tasks">Tasks</a> | <a href="/portal/resources">Resources</a>
    </nav>
  );
}

function PortalPage(props: { data: PortalData; sessions: PortalSession[]; invitations: PortalInvitation[]; csrfToken: string }) {
  const { branding, submissions, tasks } = props.data;
  const { sessions, invitations, csrfToken } = props;
  // DEC-370-style completion caption: derived from the tasks list the portal
  // repo already returns (task/complete counts), never a fixture figure
  // (DEC-377).
  const doneCount = tasks.filter((t) => t.status === "complete").length;
  const totalCount = tasks.length;
  const donePct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);
  return (
    <PortalLayout branding={branding} csrfToken={csrfToken}>
      <Nav />
      {totalCount > 0 ? (
        <div class="chq-portal-progress">
          <span class="chq-portal-progress-label">
            {doneCount} of {totalCount} tasks complete
          </span>
          <div class="chq-bar">
            <div class="chq-bar-fill" style={`width: ${donePct}%`}></div>
          </div>
        </div>
      ) : null}
      <section aria-label="My Submissions" class="chq-section">
        <div class="chq-section-label">My Submissions</div>
        {submissions.length === 0 ? (
          <p>You haven't submitted anything yet.</p>
        ) : (
          <div class="chq-table-scroll">
            <table class="chq-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr>
                    <td>{s.ref}</td>
                    <td>{s.title}</td>
                    <td>
                      <span class="chq-flag">{s.statusLabel}</span>
                    </td>
                    <td>{formatEventDate(s.submittedAt, s.timezone)}</td>
                    <td>
                      <a href={`/portal/submissions/${s.id}`}>View</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="My Tasks" class="chq-section">
        <div class="chq-section-label">My Tasks</div>
        {tasks.length === 0 ? (
          <p>No tasks assigned yet.</p>
        ) : (
          tasks.map((t) => (
            <div class="chq-portal-row">
              <div class="chq-portal-row-head">
                <span class="chq-portal-row-title">
                  {t.title}
                  {t.required ? <strong> (required)</strong> : null}
                </span>
                <span class={t.status === "complete" ? "chq-flag chq-portal-flag-done" : "chq-flag"}>
                  {t.status === "complete" ? "Done" : "To do"}
                </span>
              </div>
              {t.dueDate ? <span class="chq-portal-due">Due {formatCalendarDate(t.dueDate)}</span> : null}
            </div>
          ))
        )}
        <p>
          <a href="/portal/tasks">View all tasks</a>
        </p>
      </section>

      <section aria-label="Sessions" class="chq-section">
        <div class="chq-section-label">Sessions</div>
        {invitations.length > 0
          ? invitations.map((inv) => (
              <div class="chq-portal-row">
                <span class="chq-portal-row-title">
                  Invited to co-present "{inv.title}" ({inv.ref}) at {inv.eventName}
                </span>
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
            ))
          : null}
        {sessions.length === 0 ? (
          <p>No accepted sessions yet.</p>
        ) : (
          sessions.map((s) => (
            <div class="chq-portal-row">
              <span class="chq-portal-row-title">
                {s.ref}: {s.title}
              </span>
              <span class="chq-portal-due">
                {s.day ? (
                  <>
                    {s.day} {minutesToClock(s.startMin)}–{minutesToClock(s.endMin)}
                    {s.roomName ? ` in ${s.roomName}` : ""}
                  </>
                ) : (
                  "Not yet scheduled"
                )}
              </span>
            </div>
          ))
        )}
      </section>

      <section aria-label="Resources" class="chq-section">
        <div class="chq-section-label">Resources</div>
        <p>
          <a href="/portal/resources">View event resources</a>
        </p>
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

function SubmissionDetailPage(props: {
  branding: PortalData["branding"];
  detail: PortalSubmissionDetail;
  editable: boolean;
  csrfToken: string;
}) {
  const { detail, editable } = props;
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken}>
      <a href="/portal" class="chq-portal-back">&larr; Back to My Submissions</a>
      <h2 class="chq-portal-hero">
        {detail.ref}: {detail.title}
      </h2>
      <p>
        Status: <span class="chq-flag">{detail.statusLabel}</span>
      </p>
      {editable ? (
        <div class="chq-portal-actions">
          <a href={`/portal/submissions/${detail.id}/edit`} class="chq-btn chq-btn-secondary">Edit submission</a>
        </div>
      ) : null}
      <p class="chq-portal-sub">Submitted: {formatEventDate(detail.submittedAt, detail.timezone)}</p>
      {detail.description ? <p>{detail.description}</p> : null}
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

portalRoutes.get("/", async (c) => {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const [data, sessions, invitations] = await Promise.all([
    getPortalData(c.var.db, contactId, auth.orgId),
    getMySessions(c.var.db, contactId, auth.orgId),
    getMyInvitations(c.var.db, contactId, auth.orgId),
  ]);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(<PortalPage data={data} sessions={sessions} invitations={invitations} csrfToken={csrfToken} />);
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
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return c.html(<SubmissionDetailPage branding={data.branding} detail={detail} editable={editable} csrfToken={csrfToken} />);
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
