// Invited-speaker acceptance (Portals frame, flow 8): the page an invitation
// email links to. The link's token is the credential for this page only --
// it shows the invitation and takes an answer; accepting with no account
// yet goes on to set a password (the claim flow), declining doesn't. Mounted
// before the speaker-gated portal routes (src/index.ts) because the invitee
// may not be signed in. Route file exports a sub-app; only src/index.ts
// mounts it (DEC-012).

import { Hono, type Context } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import { createClaimToken, type KVStore } from "../../auth/claim";
import { requestIpFromHeaders } from "../../lib/rate-limit";
import { checkAndIncrementScopedLimit, refundScopedLimit } from "../../server/repo/rate-limit";
import { AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_ERROR } from "../auth-helpers";
import { findAccountUserIds } from "../../server/repo/comms";
import { answerInvitation, findInvitationByToken, saveDeclineNote, sessionPlacementLine, type InvitationRecord } from "../../server/repo/portals/invitations";
import { buildPersonView } from "../../server/repo/portals/view";
import { reconcileEventPortals } from "../../server/repo/portals/reconcile";
import { ensureOnboardingTasks, getSubmissionStatusForParticipant } from "../../server/repo/submissions";
import { getEventForOrg } from "../../server/repo/events";
import { formatDueDay } from "../../lib/event-time";
import { formatNoun, formatMinutes } from "../../domain/sponsors";
import { participantRoleLabel } from "../../domain/participant-roles";
import { MAX_INVITATION_MESSAGE } from "../../domain/portals/limits";
import { plural } from "../../domain/count-copy";
import { PortalLayout, portalNotFound } from "./shared";
import { ensureCsrfCookie } from "./tasks/shared";

export const portalInvitationRoutes = new Hono<AppEnv>();

// Token guesses are metered like the claim link's (auth-claim.tsx): every
// door spends one unit per request, and resolveOrRefuse refunds it the
// moment the token resolves.
const INVITATION_LIMIT = { windowSeconds: AUTH_RATE_LIMIT_WINDOW_SECONDS, max: AUTH_RATE_LIMIT_MAX };

function meterKey(c: Context<AppEnv>): { ip: string; now: number } {
  return { ip: requestIpFromHeaders((name) => c.req.header(name)), now: Date.now() };
}

async function resolveOrRefuse(
  c: Context<AppEnv>,
  meter: { ip: string; now: number },
  limit: { ok: boolean },
): Promise<InvitationRecord | Response> {
  const invitation = await findInvitationByToken(c.var.db, c.req.param("token") ?? "");
  if (!invitation) {
    if (!limit.ok) {
      return c.html(
        <PortalLayout branding={{ eventName: "Your portal", welcomeMessage: null, accentColor: null, logoUrl: null }} csrfToken="" speakerName="" headerSignOut={false}>
          <h1 class="chq-portal-hero">{RATE_LIMIT_ERROR}</h1>
        </PortalLayout>,
        429,
      );
    }
    return portalNotFound(c, "This invitation link isn't valid any more. Reply to the email it came in and the organizers will help.");
  }
  await refundScopedLimit(c.var.db, "invitation", meter.ip, meter.now, { windowSeconds: INVITATION_LIMIT.windowSeconds });
  return invitation;
}

function roleHeading(inv: InvitationRecord, format: string | null): string {
  if (inv.role === "panelist") return "Panel";
  if (inv.role === "moderator") return "Moderator";
  const noun = format ? formatNoun(format, true) : "Talk";
  const minutes = format ? formatMinutes(format) : null;
  return minutes ? `${noun} · ${minutes} min` : inv.role === "speaker" ? noun : participantRoleLabel(inv.role);
}

function deferredLine(d: { dueDay: number | null; relativeDays: number | null }): string {
  if (d.dueDay !== null) return `by ${formatDueDay(d.dueDay)}`;
  if (d.relativeDays !== null) return `within ${d.relativeDays} ${plural(d.relativeDays, "day")}`;
  return "";
}

async function pageData(c: Context<AppEnv>, inv: InvitationRecord) {
  const event = await getEventForOrg(c.var.db, inv.eventId, inv.orgId);
  const view = await buildPersonView(c.var.db, { eventId: inv.eventId, contactId: inv.contactId, now: Date.now() });
  const section = view.sections.find((s) => s.participation.session?.participantId === inv.participantId) ?? null;
  const placement = await sessionPlacementLine(c.var.db, inv.submissionId);
  return {
    branding: {
      eventName: event?.name ?? "Your portal",
      welcomeMessage: null,
      accentColor: null,
      logoUrl: null,
    },
    format: section?.participation.session?.format ?? null,
    placement,
    deferred: section?.deferredItems ?? [],
  };
}

function InvitationPage(props: {
  inv: InvitationRecord;
  data: Awaited<ReturnType<typeof pageData>>;
  token: string;
  csrfToken: string;
  sent: boolean;
}) {
  const { inv, data, token } = props;
  const name = `${inv.firstName} ${inv.lastName}`.trim();
  if (inv.inviteStatus === "declined") {
    return (
      <PortalLayout branding={data.branding} csrfToken={props.csrfToken} speakerName={name} headerSignOut={false}>
        <div class="chq-invite-page">
        <h1 class="chq-portal-hero">Thanks for letting us know</h1>
        <p class="chq-portal-sub">We've let the organizers know.</p>
        {props.sent ? (
          <p role="status">Your message is with the organizers.</p>
        ) : (
          <form method="post" action={`/portal/invitations/${token}/note`} class="chq-invite-note">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
            <label class="chq-portal-field-label" for="note">
              Message to the organizers · optional
            </label>
            <textarea class="chq-textarea" id="note" name="note" rows={4} maxLength={MAX_INVITATION_MESSAGE}>
              {inv.declineNote ?? ""}
            </textarea>
            <p class="chq-portal-detail">Changed your mind? Reply to {inv.invitedByName ? `${inv.invitedByName.split(" ")[0]}'s` : "the"} email.</p>
            <div class="chq-portal-actions">
              <button type="submit" class="chq-btn chq-btn-primary">Send</button>
            </div>
          </form>
        )}
        </div>
      </PortalLayout>
    );
  }
  const meta = [data.placement, inv.invitedByName ? `from ${inv.invitedByName}` : null].filter((x): x is string => !!x).join(" · ");
  return (
    <PortalLayout branding={data.branding} csrfToken={props.csrfToken} speakerName={name} headerSignOut={false}>
      <div class="chq-invite-page">
      <div class="chq-home-label">{roleHeading(inv, data.format)}</div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">{inv.sessionTitle}</h1>
      {meta ? <p class="chq-portal-sub">{meta}</p> : null}
      {inv.message ? <p class="chq-invite-quote">“{inv.message}”</p> : null}
      {data.deferred.length > 0 ? (
        <section class="chq-home-section" aria-label="If you accept, we'll ask for">
          <div class="chq-home-label">If you accept, we'll ask for</div>
          <div class="chq-home-rows">
            {data.deferred.map((d) => (
              <div class="chq-home-row">
                <div class="chq-home-row-main">
                  <span class="chq-home-row-title">{d.name}</span>
                  {deferredLine(d) ? <span class="chq-home-row-line">{deferredLine(d)}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {inv.replyBy !== null ? <p class="chq-portal-detail">Please reply by {formatDueDay(inv.replyBy)}.</p> : null}
      <div class="chq-home-actions">
        <form method="post" action={`/portal/invitations/${token}/accept`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <button type="submit" class="chq-btn chq-btn-primary">Accept</button>
        </form>
        <form method="post" action={`/portal/invitations/${token}/decline`}>
          <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
          <button type="submit" class="chq-btn chq-btn-secondary">Decline</button>
        </form>
      </div>
      </div>
    </PortalLayout>
  );
}

portalInvitationRoutes.get("/invitations/:token", async (c) => {
  const meter = meterKey(c);
  const limit = await checkAndIncrementScopedLimit(c.var.db, "invitation", meter.ip, meter.now, INVITATION_LIMIT);
  const resolved = await resolveOrRefuse(c, meter, limit);
  if (resolved instanceof Response) return resolved;
  // an accepted invitation is a session like any other: go to the portal
  if (resolved.inviteStatus === "accepted" || resolved.inviteStatus === "none") return c.redirect("/portal", 302);
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  const data = await pageData(c, resolved);
  return c.html(
    <InvitationPage inv={resolved} data={data} token={c.req.param("token")} csrfToken={csrfToken} sent={c.req.query("sent") === "1"} />,
  );
});

portalInvitationRoutes.post("/invitations/:token/accept", csrfForm, async (c) => {
  const meter = meterKey(c);
  const limit = await checkAndIncrementScopedLimit(c.var.db, "invitation", meter.ip, meter.now, INVITATION_LIMIT);
  const resolved = await resolveOrRefuse(c, meter, limit);
  if (resolved instanceof Response) return resolved;
  if (resolved.inviteStatus !== "invited") return c.redirect("/portal", 302);
  const now = new Date();
  await answerInvitation(c.var.db, resolved, "accepted", now);
  // DEC-278: accepting onto an already-accepted session plans this
  // speaker's onboarding tasks (the session's own acceptance never re-fires)
  const info = await getSubmissionStatusForParticipant(c.var.db, resolved.participantId);
  if (info && info.status === "accepted") {
    await ensureOnboardingTasks(c.var.db, info.eventId, info.submissionId, [resolved.contactId], now);
  }
  await reconcileEventPortals(c.var.db, resolved.eventId, now, { notify: "none" });
  const accounts = await findAccountUserIds(c.var.db, [{ contactId: resolved.contactId, email: resolved.email }]);
  if (accounts.get(resolved.contactId)) return c.redirect("/portal?confirmed=1", 302);
  // no account yet: set a password, then land in the portal
  const claim = await createClaimToken(c.env.KV as unknown as KVStore, {
    contactId: resolved.contactId,
    eventId: resolved.eventId,
    purpose: "invitation",
  });
  return c.redirect(`/claim/${claim}`, 302);
});

portalInvitationRoutes.post("/invitations/:token/decline", csrfForm, async (c) => {
  const meter = meterKey(c);
  const limit = await checkAndIncrementScopedLimit(c.var.db, "invitation", meter.ip, meter.now, INVITATION_LIMIT);
  const resolved = await resolveOrRefuse(c, meter, limit);
  if (resolved instanceof Response) return resolved;
  if (resolved.inviteStatus === "invited") {
    const now = new Date();
    await answerInvitation(c.var.db, resolved, "declined", now);
    // declining ends the participation: it leaves every portal
    await reconcileEventPortals(c.var.db, resolved.eventId, now, { notify: "none" });
  }
  return c.redirect(`/portal/invitations/${c.req.param("token")}`, 302);
});

portalInvitationRoutes.post("/invitations/:token/note", csrfForm, async (c) => {
  const meter = meterKey(c);
  const limit = await checkAndIncrementScopedLimit(c.var.db, "invitation", meter.ip, meter.now, INVITATION_LIMIT);
  const resolved = await resolveOrRefuse(c, meter, limit);
  if (resolved instanceof Response) return resolved;
  const body = await c.req.parseBody();
  await saveDeclineNote(c.var.db, resolved, typeof body.note === "string" ? body.note : "", new Date());
  return c.redirect(`/portal/invitations/${c.req.param("token")}?sent=1`, 302);
});
