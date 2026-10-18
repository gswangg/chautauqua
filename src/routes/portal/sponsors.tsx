// Sponsor contacts' pages (Portals frame, flows 7 and 9): the package, a new
// session on a free slot, one editor for the session's whole life (draft ->
// with the organizers -> changes requested -> approved | not accepted), and
// the team. Every read and write goes through resolveSponsorAccess
// (src/server/repo/sponsors/access.ts): a contact reaches only a
// sponsorship they have joined, so no page here can show another sponsor's
// sessions, team, entitlements or data. Route file exports a sub-app; only
// src/index.ts mounts it (DEC-012).

import { Hono, type Context } from "hono";
import type { AppEnv } from "../../server/env";
import { csrfForm } from "../../server/middleware";
import { ApiError } from "../../server/http";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import type { KVStore } from "../../auth/claim";
import { makeMailer } from "../../server/context";
import { resolveBaseUrl } from "../../server/origin";
import { assertSpeakerContactId, getPortalData, getPortalHome } from "../../server/repo/portal";
import { resolveSponsorAccess, type SponsorAccess } from "../../server/repo/sponsors/access";
import { loadPackages } from "../../server/repo/sponsors/package";
import {
  addSponsorSpeaker,
  createSponsorDraft,
  discardSponsorDraft,
  getSessionForAccess,
  listSessionsForAccess,
  removeSponsorSpeaker,
  submitSponsorSession,
  updateSponsorDraft,
  withdrawSponsorSession,
  type SponsorSessionDetail,
} from "../../server/repo/sponsors/sessions";
import { addSponsorContact, listSponsorContacts, parsePersonInput, removeSponsorContact } from "../../server/repo/sponsors/organizer";
import { sendTeammateInvitation } from "../../server/repo/portals/mail";
import { writeAuditEvent } from "../../server/repo/audit";
import { reconcileEventPortals } from "../../server/repo/portals/reconcile";
import { formatDueDay } from "../../lib/event-time";
import { dayLabelOfInstant } from "../../lib/timezone";
import {
  SPONSOR_SESSION_STATUS_LABELS,
  SPONSOR_SESSION_STATUS_LINES,
  formatNoun,
  freeSlots,
  slotLabel,
  sponsorCanEdit,
  type Slot,
} from "../../domain/sponsors";
import { MAX_SPONSOR_SESSION_ABSTRACT, MAX_SPONSOR_SESSION_TITLE, MAX_PERSON_NAME } from "../../domain/portals/limits";
import { MAX_SPONSOR_SESSION_SPEAKERS } from "../../domain/sponsors";
import { PortalBackLink, PortalLayout, portalNotFound, speakerGate } from "./shared";
import { ensureCsrfCookie } from "./tasks/shared";
import type { ViewSection } from "../../server/repo/portals/view";

export const portalSponsorRoutes = new Hono<AppEnv>();

portalSponsorRoutes.use("/sponsors/*", speakerGate);

interface SponsorPageContext {
  access: SponsorAccess;
  section: ViewSection | null;
  canDesign: boolean;
  canAddTeammates: boolean;
  slots: Slot[];
  branding: { eventName: string; welcomeMessage: string | null; accentColor: string | null; logoUrl: string | null };
  contactName: string;
  timezone: string;
  csrfToken: string;
}

async function sponsorContext(c: Context<AppEnv>): Promise<SponsorPageContext | null> {
  const auth = c.var.auth!;
  const contactId = assertSpeakerContactId(auth);
  const access = await resolveSponsorAccess(c.var.db, { contactId, orgId: auth.orgId, sponsorshipId: c.req.param("sponsorshipId") ?? "" });
  if (!access) return null;
  const [home, data, packages] = await Promise.all([
    getPortalHome(c.var.db, contactId, auth.orgId, Date.now(), { heal: false }),
    getPortalData(c.var.db, contactId, auth.orgId),
    loadPackages(c.var.db, [access.sponsorshipId]),
  ]);
  const view = home.views.find((v) => v.eventId === access.eventId) ?? null;
  const section = view?.sections.find((s) => s.sponsor?.sponsorshipId === access.sponsorshipId) ?? null;
  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });
  return {
    access,
    section,
    canDesign: section?.sponsor?.canDesign ?? false,
    canAddTeammates: section?.sponsor?.canAddTeammates ?? false,
    slots: packages.get(access.sponsorshipId)?.slots ?? [],
    branding: { ...data.branding, eventName: view?.eventName ?? data.branding.eventName },
    contactName: data.contactName,
    timezone: view?.timezone ?? "UTC",
    csrfToken,
  };
}

function packageTitle(ctx: SponsorPageContext): string {
  return ctx.access.tierName ? `Your ${ctx.access.tierName} package` : "Your package";
}

function slotState(slot: Slot, currentSessionId: string | null): string {
  if (!slot.session) return "Free";
  if (slot.session.id === currentSessionId && slot.session.status !== "approved") return "This session";
  return SPONSOR_SESSION_STATUS_LABELS[slot.session.status];
}

function PackagePanel(props: { ctx: SponsorPageContext; currentSessionId: string | null }) {
  const { ctx } = props;
  return (
    <aside class="chq-sponsor-panel" aria-label={packageTitle(ctx)}>
      <div class="chq-home-label">{packageTitle(ctx)}</div>
      <div class="chq-home-rows chq-home-rows-first">
        {ctx.slots.map((slot) => (
          <div class="chq-home-row">
            <div class="chq-home-row-main">
              <span class="chq-home-row-title">{slotLabel(slot)}</span>
              <span class="chq-home-row-line">
                {slot.session ? (slot.session.id === props.currentSessionId ? "This session" : slot.session.title || "Untitled draft") : "Available"}
              </span>
            </div>
            <span class="chq-home-state">{slotState(slot, props.currentSessionId)}</span>
          </div>
        ))}
        {ctx.slots.length === 0 ? <p class="chq-portal-detail">Nothing in your package yet. Ask the organizers.</p> : null}
      </div>
    </aside>
  );
}

function SponsorShell(props: { ctx: SponsorPageContext; back: string; children: unknown; currentSessionId?: string | null; panel?: boolean }) {
  const { ctx } = props;
  return (
    <PortalLayout branding={ctx.branding} csrfToken={ctx.csrfToken} speakerName={ctx.contactName}>
      <PortalBackLink to={props.back} />
      <div class={props.panel === false ? "chq-sponsor-single" : "chq-sponsor-grid"}>
        <div class="chq-sponsor-main">{props.children as any}</div>
        {props.panel === false ? null : <PackagePanel ctx={ctx} currentSessionId={props.currentSessionId ?? null} />}
      </div>
    </PortalLayout>
  );
}

function companyLine(ctx: SponsorPageContext): string {
  return ctx.access.tierName ? `${ctx.access.companyName} · ${ctx.access.tierName}` : ctx.access.companyName;
}

// ---------------------------------------------------------------------------
// The package and its sessions
// ---------------------------------------------------------------------------

portalSponsorRoutes.get("/sponsors/:sponsorshipId", async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  const sessions = await listSessionsForAccess(c.var.db, ctx.access);
  const free = freeSlots(ctx.slots);
  const allApproved = ctx.slots.length > 0 && ctx.slots.every((s) => s.session?.status === "approved");
  const approvedCount = ctx.slots.filter((s) => s.session?.status === "approved").length;
  return c.html(
    <SponsorShell ctx={ctx} back="/portal">
      <div class="chq-home-label">{ctx.access.tierName ? `${ctx.access.tierName} sponsor` : "Sponsor"}</div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">{ctx.access.companyName} · sessions</h1>
      {ctx.section?.notes.map((n) => <p class="chq-home-note">{n}</p>)}
      <div class="chq-home-rows">
        {sessions
          .filter((s) => s.status !== "declined" || !sessions.some((o) => o.entitlementId === s.entitlementId && o.id !== s.id && o.createdAt > s.createdAt))
          .map((s) => (
            <div class="chq-home-row">
              <div class="chq-home-row-main">
                <a class="chq-home-row-title" href={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}`}>
                  {s.title || "Untitled draft"}
                </a>
                <span class="chq-home-row-line">
                  {s.slotLabel} · {SPONSOR_SESSION_STATUS_LINES[s.status]}
                </span>
              </div>
              <span class={s.status === "changes_requested" ? "chq-home-pill" : "chq-home-state"}>{SPONSOR_SESSION_STATUS_LABELS[s.status]}</span>
            </div>
          ))}
      </div>
      {allApproved ? (
        <div class="chq-home-callout" role="status">
          <strong>Package fully used</strong>
          <span>
            {approvedCount === 1 ? `Your one ${formatNoun(ctx.slots[0]!.format)} is in the program.` : "Every session in your package is in the program."} Ask the
            organizers for more.
          </span>
        </div>
      ) : free.length > 0 && ctx.canDesign ? (
        <p>
          <a class="chq-btn chq-btn-primary" href={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/new`}>
            Design a session
          </a>
        </p>
      ) : free.length > 0 ? (
        <p class="chq-portal-detail">The organizers design your sessions with you. Ask them to get started.</p>
      ) : null}
      <p>
        <a class="chq-portal-standalone-link" href={`/portal/sponsors/${ctx.access.sponsorshipId}/team`}>
          {ctx.canAddTeammates ? "Manage your team" : "Your team"}
        </a>
      </p>
    </SponsorShell>,
  );
});

portalSponsorRoutes.get("/sponsors/:sponsorshipId/sessions/new", async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) return portalNotFound(c, "Sessions for your sponsorship are designed with the organizers.");
  const free = freeSlots(ctx.slots);
  const back = `/portal/sponsors/${ctx.access.sponsorshipId}`;
  if (free.length === 0) {
    return c.html(
      <SponsorShell ctx={ctx} back={back}>
        <h1 class="chq-portal-hero chq-portal-hero-drill">Package fully used</h1>
        <p class="chq-portal-sub">Every part of your package is in use. Ask the organizers for more.</p>
      </SponsorShell>,
    );
  }
  const firstFree = free[0]!.entitlementId;
  return c.html(
    <SponsorShell ctx={ctx} back={back}>
      <div class="chq-home-label">{companyLine(ctx)}</div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">New session</h1>
      <p class="chq-portal-sub">Draft · Only your team can see it</p>
      <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
        <fieldset class="chq-sponsor-slots">
          <legend class="chq-home-label">What is this session using?</legend>
          {ctx.slots.map((slot, i) => {
            const used = slot.session !== null;
            // a used slot can't be picked; the first free one is preselected
            return (
              <label class={`chq-sponsor-slot${used ? " chq-sponsor-slot-used" : ""}`}>
                <input
                  class="chq-sponsor-slot-input"
                  type="radio"
                  name="entitlementId"
                  value={slot.entitlementId}
                  disabled={used}
                  checked={!used && slot.entitlementId === firstFree && ctx.slots.findIndex((x) => !x.session) === i}
                />
                <span class="chq-home-row-main">
                  <span class="chq-home-row-title">{slotLabel(slot)}</span>
                  <span class="chq-home-row-line">{used ? `Used by ${slot.session!.title || "a draft"}` : "Available"}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <div class="chq-home-actions">
          <button type="submit" class="chq-btn chq-btn-primary">Start the draft</button>
          <a class="chq-btn chq-btn-secondary" href={back}>Cancel</a>
        </div>
      </form>
    </SponsorShell>,
  );
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  const body = await c.req.parseBody();
  const id = await createSponsorDraft(c.var.db, ctx.access, body.entitlementId, new Date());
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${id}`, 302);
});

// ---------------------------------------------------------------------------
// One session: the editor and its status
// ---------------------------------------------------------------------------

function noteDay(ms: number | null, tz: string): string {
  return ms === null ? "" : formatDueDay(dayLabelOfInstant(ms, tz));
}

function SessionPage(props: { ctx: SponsorPageContext; s: SponsorSessionDetail; error?: string; approvedItems: ViewSection | null }) {
  const { ctx, s } = props;
  const back = `/portal/sponsors/${ctx.access.sponsorshipId}`;
  const editable = sponsorCanEdit(s.status) && ctx.canDesign;
  const noun = formatNoun(s.format);
  const firstName = (n: string | null) => (n ? n.split(" ")[0] : "the organizers");
  return (
    <SponsorShell ctx={ctx} back={back} currentSessionId={s.id}>
      <div class="chq-home-label">{companyLine(ctx)}</div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">Your {noun}</h1>
      <p class="chq-portal-sub">
        {SPONSOR_SESSION_STATUS_LABELS[s.status]} · {SPONSOR_SESSION_STATUS_LINES[s.status]}
      </p>
      {props.error ? <p role="alert" class="chq-field-error">{props.error}</p> : null}

      {s.status === "changes_requested" && s.lastNote ? (
        <div class="chq-home-callout" role="status">
          <strong>The organizers asked for changes</strong>
          <span>
            “{s.lastNote}” — {firstName(s.lastNoteBy)}
            {s.lastNoteAt ? `, ${noteDay(s.lastNoteAt, ctx.timezone)}` : ""}
          </span>
        </div>
      ) : null}

      {s.status === "submitted" ? (
        <>
          <div class="chq-home-callout" role="status">
            <strong>With the organizers</strong>
            <span>Submitted {noteDay(s.submittedAt, ctx.timezone)}. You'll get an email when they reply.</span>
          </div>
          <h2 class="chq-home-title">{s.title}</h2>
          <p class="chq-home-meta">
            {s.slotLabel} · {s.speakers.map((sp) => sp.name).join(", ")}
          </p>
          {ctx.canDesign ? (
            <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}/withdraw`} class="chq-home-actions">
              <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
              <button type="submit" class="chq-btn chq-btn-secondary">Withdraw</button>
            </form>
          ) : null}
          <p class="chq-portal-detail">Withdrawing takes it back to your draft and keeps the slot.</p>
        </>
      ) : null}

      {s.status === "approved" ? (
        <>
          <div class="chq-home-callout" role="status">
            <strong>Approved</strong>
            <span>It's in the program. The organizers will confirm the time and room.</span>
          </div>
          <h2 class="chq-home-title">{s.title}</h2>
          {props.approvedItems ? (
            <div class="chq-home-rows">
              {props.approvedItems.items.map((i) => (
                <div class="chq-home-row">
                  <div class="chq-home-row-main">
                    <span class="chq-home-row-title">{i.title}</span>
                    {i.dueDay !== null ? <span class="chq-home-row-line">Due {formatDueDay(i.dueDay)}</span> : null}
                  </div>
                  <span class="chq-home-state">{i.state === "done" ? "Done" : "To do"}</span>
                </div>
              ))}
            </div>
          ) : null}
          <p>
            <a class="chq-portal-standalone-link" href="/portal">Go to your portal</a>
          </p>
        </>
      ) : null}

      {s.status === "declined" ? (
        <>
          <div class="chq-home-callout" role="status">
            <strong>Not accepted</strong>
            {s.declineReason ? (
              <span>
                “{s.declineReason}” — {firstName(s.lastNoteBy)}
              </span>
            ) : null}
          </div>
          <h2 class="chq-home-title">Your {noun} slot is free again</h2>
          <p class="chq-portal-sub">You can use it for a different session.</p>
          {ctx.canDesign ? (
            <p>
              <a class="chq-btn chq-btn-primary" href={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/new`}>
                Design a new session
              </a>
            </p>
          ) : null}
        </>
      ) : null}

      {s.status === "draft" || s.status === "changes_requested" ? (
        <>
          <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}`} id="chq-sponsor-session-form">
            <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
            <div class="chq-portal-field">
              <span class="chq-portal-field-label">Using</span>
              <p class="chq-home-meta">
                {s.slotLabel} — {packageTitle(ctx).replace(/^Your /, "your ")}
              </p>
            </div>
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="title">Title</label>
              <input class="chq-input" type="text" id="title" name="title" value={s.title} maxLength={MAX_SPONSOR_SESSION_TITLE} readonly={!editable} />
            </div>
            <div class="chq-portal-field">
              <label class="chq-portal-field-label" for="abstract">Abstract</label>
              <textarea class="chq-textarea" id="abstract" name="abstract" rows={5} maxLength={MAX_SPONSOR_SESSION_ABSTRACT} readonly={!editable}>
                {s.abstract ?? ""}
              </textarea>
            </div>
            <div class="chq-portal-field">
              <span class="chq-portal-field-label">Format</span>
              <p class="chq-home-meta">{s.slotLabel}</p>
            </div>
          </form>
          <section class="chq-home-section" aria-label="Speakers">
            <div class="chq-home-label">Speakers</div>
            <div class="chq-home-rows">
              {s.speakers.map((sp) => (
                <div class="chq-home-row">
                  <div class="chq-home-row-main">
                    <span class="chq-home-row-title">{sp.name}</span>
                    <span class="chq-home-row-line">
                      {sp.contactId === ctx.access.contactId ? "You" : sp.isNew ? `${sp.email} · new · invited on approval` : sp.email}
                    </span>
                  </div>
                  {editable && sp.contactId !== ctx.access.contactId ? (
                    <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}/speakers/${sp.id}/remove`}>
                      <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
                      <button type="submit" class="chq-btn chq-btn-tertiary">Remove</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {editable && s.speakers.length < MAX_SPONSOR_SESSION_SPEAKERS ? (
              <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}/speakers`} class="chq-sponsor-add">
                <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
                <div class="chq-home-label">Add a speaker</div>
                <div class="chq-portal-field">
                  <label class="chq-portal-field-label" for="speaker-name">Name</label>
                  <input class="chq-input" type="text" id="speaker-name" name="name" maxLength={MAX_PERSON_NAME * 2} required />
                </div>
                <div class="chq-portal-field">
                  <label class="chq-portal-field-label" for="speaker-email">Email</label>
                  <input class="chq-input" type="email" id="speaker-email" name="email" maxLength={254} required />
                </div>
                <p class="chq-portal-detail">Someone new gets their invitation when the session is approved.</p>
                <div class="chq-home-actions">
                  <button type="submit" class="chq-btn chq-btn-secondary">Add a speaker</button>
                </div>
              </form>
            ) : null}
          </section>
          {editable ? (
            <div class="chq-home-actions">
              <button type="submit" form="chq-sponsor-session-form" name="intent" value="save" class="chq-btn chq-btn-secondary">
                Save draft
              </button>
              <button type="submit" form="chq-sponsor-session-form" name="intent" value="submit" class="chq-btn chq-btn-primary">
                {s.submitCount > 0 ? "Resubmit for approval" : "Submit for approval"}
              </button>
            </div>
          ) : null}
          {editable && s.status === "draft" && s.submitCount === 0 ? (
            <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${s.id}/discard`}>
              <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
              <button type="submit" class="chq-btn chq-btn-tertiary">Discard this draft</button>
            </form>
          ) : null}
        </>
      ) : null}
    </SponsorShell>
  );
}

async function renderSession(c: Context<AppEnv>, ctx: SponsorPageContext, sessionId: string, error?: string, status = 200) {
  const s = await getSessionForAccess(c.var.db, ctx.access, sessionId);
  if (!s) return portalNotFound(c);
  let approvedItems: ViewSection | null = null;
  if (s.submissionId) {
    const home = await getPortalHome(c.var.db, ctx.access.contactId, ctx.access.orgId, Date.now(), { heal: false });
    approvedItems =
      home.views.flatMap((v) => v.sections).find((sec) => sec.participation.session?.submissionId === s.submissionId) ?? null;
  }
  return c.html(<SessionPage ctx={ctx} s={s} error={error} approvedItems={approvedItems} />, status as 200);
}

portalSponsorRoutes.get("/sponsors/:sponsorshipId/sessions/:sessionId", async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  return renderSession(c, ctx, c.req.param("sessionId"));
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions/:sessionId", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  const sessionId = c.req.param("sessionId");
  const body = await c.req.parseBody();
  const now = new Date();
  try {
    await updateSponsorDraft(c.var.db, ctx.access, sessionId, { title: body.title, abstract: body.abstract }, now);
    if (body.intent === "submit") {
      const result = await submitSponsorSession(c.var.db, ctx.access, sessionId, now);
      await writeAuditEvent(
        c.var.db,
        {
          orgId: ctx.access.orgId,
          eventId: ctx.access.eventId,
          actor: { userId: c.var.auth!.userId, contactId: ctx.access.contactId, label: ctx.contactName },
          action: "sponsor_session.submit",
          targetType: "sponsor_session",
          targetId: sessionId,
          details: { resubmitted: result.resubmitted, title: result.title },
        },
        now,
      );
    }
  } catch (err) {
    if (err instanceof ApiError && (err.code === "invalid" || err.code === "conflict")) {
      return renderSession(c, ctx, sessionId, err.message, 400);
    }
    throw err;
  }
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${sessionId}`, 302);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions/:sessionId/speakers", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  const sessionId = c.req.param("sessionId");
  const body = await c.req.parseBody();
  try {
    await addSponsorSpeaker(c.var.db, ctx.access, sessionId, { name: body.name, email: body.email }, new Date());
  } catch (err) {
    if (err instanceof ApiError && (err.code === "invalid" || err.code === "conflict")) return renderSession(c, ctx, sessionId, err.message, 400);
    throw err;
  }
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${sessionId}`, 302);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions/:sessionId/speakers/:speakerId/remove", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  const sessionId = c.req.param("sessionId");
  await removeSponsorSpeaker(c.var.db, ctx.access, sessionId, c.req.param("speakerId"), new Date());
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${sessionId}`, 302);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions/:sessionId/withdraw", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  const sessionId = c.req.param("sessionId");
  const now = new Date();
  const { title } = await withdrawSponsorSession(c.var.db, ctx.access, sessionId, now);
  await writeAuditEvent(
    c.var.db,
    {
      orgId: ctx.access.orgId,
      eventId: ctx.access.eventId,
      actor: { userId: c.var.auth!.userId, contactId: ctx.access.contactId, label: ctx.contactName },
      action: "sponsor_session.withdraw",
      targetType: "sponsor_session",
      targetId: sessionId,
      details: { title },
    },
    now,
  );
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/sessions/${sessionId}`, 302);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/sessions/:sessionId/discard", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canDesign) throw new ApiError("forbidden", "Sessions for your sponsorship are designed with the organizers");
  await discardSponsorDraft(c.var.db, ctx.access, c.req.param("sessionId"));
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}`, 302);
});

// ---------------------------------------------------------------------------
// The team (flow 9)
// ---------------------------------------------------------------------------

async function renderTeam(c: Context<AppEnv>, ctx: SponsorPageContext, error?: string, status = 200) {
  const team = await listSponsorContacts(c.var.db, ctx.access.sponsorshipId);
  const day = (ms: number | null) => (ms === null ? "" : formatDueDay(dayLabelOfInstant(ms, ctx.timezone)));
  return c.html(
    <SponsorShell ctx={ctx} back={`/portal/sponsors/${ctx.access.sponsorshipId}`} panel={false}>
      <div class="chq-home-label">{ctx.access.companyName}</div>
      <h1 class="chq-portal-hero chq-portal-hero-drill">Your team</h1>
      {error ? <p role="alert" class="chq-field-error">{error}</p> : null}
      {c.req.query("invited") === "1" ? <p role="status">Invitation sent.</p> : null}
      <div class="chq-home-rows">
        {team.map((m) => (
          <div class="chq-home-row">
            <div class="chq-home-row-main">
              <span class="chq-home-row-title">{m.name}</span>
              <span class="chq-home-row-line">
                {m.contactId === ctx.access.contactId
                  ? m.isPrimary
                    ? "You · primary contact"
                    : "You"
                  : m.status === "invited"
                    ? `${m.email} · invited ${day(m.invitedAt)}`
                    : `${m.email} · joined ${day(m.joinedAt)}`}
              </span>
            </div>
            {m.status === "invited" ? <span class="chq-home-state">Invited</span> : null}
            {/* an invitation not yet taken up can be withdrawn (a mistyped
                address would otherwise sit on the team for good); a joined
                teammate is removed. Same route either way. */}
            {ctx.canAddTeammates && !m.isPrimary && m.contactId !== ctx.access.contactId ? (
              <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/team/${m.id}/remove`}>
                <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
                <button type="submit" class="chq-btn chq-btn-tertiary">{m.status === "invited" ? "Withdraw" : "Remove"}</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
      {ctx.canAddTeammates ? (
        <form method="post" action={`/portal/sponsors/${ctx.access.sponsorshipId}/team`} class="chq-sponsor-add">
          <input type="hidden" name={CSRF_COOKIE_NAME} value={ctx.csrfToken} />
          <div class="chq-home-label">Invite a teammate</div>
          <div class="chq-portal-field">
            <label class="chq-portal-field-label" for="teammate-name">Name</label>
            <input class="chq-input" type="text" id="teammate-name" name="name" maxLength={MAX_PERSON_NAME * 2} required />
          </div>
          <div class="chq-portal-field">
            <label class="chq-portal-field-label" for="teammate-email">Email</label>
            <input class="chq-input" type="email" id="teammate-email" name="email" maxLength={254} required />
          </div>
          <p class="chq-portal-detail">They'll see {ctx.access.companyName}'s items, not your talks.</p>
          <div class="chq-home-actions">
            <button type="submit" class="chq-btn chq-btn-primary">Send invitation</button>
          </div>
        </form>
      ) : (
        <p class="chq-portal-detail">Ask the organizers to add someone to your team.</p>
      )}
    </SponsorShell>,
    status as 200,
  );
}

portalSponsorRoutes.get("/sponsors/:sponsorshipId/team", async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  return renderTeam(c, ctx);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/team", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canAddTeammates) throw new ApiError("forbidden", "Ask the organizers to add someone to your team");
  const body = await c.req.parseBody();
  const now = new Date();
  let added;
  try {
    const person = parsePersonInput({ name: body.name, email: body.email });
    added = await addSponsorContact(
      c.var.db,
      {
        orgId: ctx.access.orgId,
        eventId: ctx.access.eventId,
        sponsorshipId: ctx.access.sponsorshipId,
        person,
        status: "invited",
        isPrimary: false,
        invitedByContactId: ctx.access.contactId,
      },
      now,
    );
  } catch (err) {
    if (err instanceof ApiError && (err.code === "invalid" || err.code === "conflict")) return renderTeam(c, ctx, err.message, 400);
    throw err;
  }
  await sendTeammateInvitation(c.var.db, makeMailer(c.var.db, c.env), c.env.KV as unknown as KVStore, {
    eventId: ctx.access.eventId,
    origin: resolveBaseUrl(c),
    contactId: added.contactId,
    companyName: ctx.access.companyName,
    inviterName: ctx.contactName,
  });
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/team?invited=1`, 302);
});

portalSponsorRoutes.post("/sponsors/:sponsorshipId/team/:sponsorContactId/remove", csrfForm, async (c) => {
  const ctx = await sponsorContext(c);
  if (!ctx) return portalNotFound(c);
  if (!ctx.canAddTeammates) throw new ApiError("forbidden", "Ask the organizers to change your team");
  const sponsorContactId = c.req.param("sponsorContactId");
  const team = await listSponsorContacts(c.var.db, ctx.access.sponsorshipId);
  if (team.find((m) => m.id === sponsorContactId)?.contactId === ctx.access.contactId) {
    return renderTeam(c, ctx, "You can't remove yourself. Ask a teammate or the organizers.", 400);
  }
  await removeSponsorContact(c.var.db, ctx.access.sponsorshipId, sponsorContactId);
  // company items leave the home of the removed teammate (work they did
  // stays on the record)
  await reconcileEventPortals(c.var.db, ctx.access.eventId, new Date(), { notify: "none" });
  return c.redirect(`/portal/sponsors/${ctx.access.sponsorshipId}/team`, 302);
});
