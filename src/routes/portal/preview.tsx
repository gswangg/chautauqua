// GET /portal/preview — DEC-747 (findings wave 7 amendment): the Speaker
// portal settings section's ONE row action ("Open as a speaker") used to
// link to /portal, which speakerGate (./shared.tsx) redirects every
// non-speaker session away from, so the action an organizer actually had was
// none at all. This route builds the smallest honest version of the frame's
// intent (docs/design/Chautauqua Settings.dc.html:175 `Open as a
// speaker`): a read-only preview
// of the producer's OWN portal configuration — branding, welcome message,
// resources — never a person's data (no submissions, no task assignments,
// no files scoped to a contact) and never a mutating control.
//
// Deliberately its own sub-app (mounted at "/portal", ahead of ./index's
// portalRoutes per src/index.ts) rather than a route added to portalRoutes,
// because it does NOT use speakerGate — its guard is the inverse (organizer
// only) and every other session (anonymous, reviewer, speaker) gets the same
// 404 the portal gate already renders for an unknown path, never a redirect,
// so /portal/preview is invisible to roles it is not for (no IDOR, no
// "login-as" affordance).

import { Hono } from "hono";
import type { AppEnv } from "../../server/env";
import { PortalLayout, type PortalBrandingChrome } from "./shared";
import { getEventForOrg } from "../../server/repo/events";
import { getPortalSettingsForEvent, listResourcesForEvent, type ResourceRecord } from "../../server/repo/portal-config";
import {
  ANONYMOUS_NOT_FOUND_LINKS,
  NotFoundDocument,
  ORGANIZER_NOT_FOUND_LINKS,
  resolveNotFoundEyebrow,
} from "../../server/not-found";
import { PublicEmptyState } from "../public/empty-state";
import { ensureCsrfCookie } from "./tasks/shared";
import { DEC_747, DEC_322 } from "../../decisions";
import { safeImageSrc } from "../../domain/brand-url";

void DEC_322;

void DEC_747;

export const portalPreviewRoutes = new Hono<AppEnv>();

function resourceKindLabel(kind: string): string {
  return kind === "file" ? "File" : "Wiki page";
}

function PreviewResourceRow(props: { resource: ResourceRecord }) {
  const { resource } = props;
  return (
    <div class="chq-portal-row">
      <span class="chq-portal-row-title">{resource.title}</span>
      <span class="chq-portal-due">{resourceKindLabel(resource.kind)}</span>
    </div>
  );
}

function PreviewPage(props: {
  branding: PortalBrandingChrome;
  resources: ResourceRecord[];
  showResources: boolean;
  csrfToken: string;
}) {
  // DEC-820: every PortalLayout call site names who is signed in, so no
  // portal page can ship anonymous. This page is the one call site whose
  // viewer is NOT a speaker -- an organizer previewing their own portal
  // config -- and it has no speaker's account to name, so the identity slot
  // says exactly that instead of borrowing a person's name it does not have.
  // (Open question for the frame: whether the slot should instead carry the
  // ORGANIZER'S own name; DEC-747's amendment doesn't say, so this states
  // the truth the banner already states.)
  return (
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken} speakerName="Preview (no speaker)">
      {/* Below this point: no form, no button, no link that mutates
          anything, and nothing scoped to a contact. PortalLayout's own
          footer sign-out control is standard /portal/* chrome (DEC-154,
          every portal page carries it) and mutates only the ORGANIZER'S
          OWN session, never portal content or a speaker's data — it is not
          part of "the preview" this task scopes. */}
      <p class="chq-portal-preview-banner" role="note">
        Preview · read-only. This is the portal your speakers see — no speaker's own submissions, tasks or files
        appear here.
      </p>
      {props.branding.welcomeMessage ? <p class="chq-meta">{props.branding.welcomeMessage}</p> : null}
      <section aria-label="Resources" class="chq-section">
        <div class="chq-section-label">Resources</div>
        {!props.showResources ? (
          // DEC-988 (wave-56 amendment): the preview must show what the
          // speaker sees -- when the section is off, the speaker never
          // reaches this section at all, so the preview replaces its body
          // with a single organizer-facing explanation rather than the
          // resource list.
          <p class="chq-meta">Hidden from speakers by the Speaker portal "Show resources" setting.</p>
        ) : props.resources.length === 0 ? (
          // DEC-919: an SSR zero-collection branch renders PublicEmptyState,
          // never a bare <p> -- 'fresh' because a preview has no filter to
          // clear, so it takes no escape link.
          <PublicEmptyState variant="fresh" what="No resources yet." />
        ) : (
          props.resources.map((resource) => <PreviewResourceRow resource={resource} />)
        )}
      </section>
    </PortalLayout>
  );
}

async function renderNotFound(c: { var: { db: import("../../server/context").Db; auth?: { role: string } } }) {
  const eyebrow = await resolveNotFoundEyebrow(c.var.db);
  const links = c.var.auth?.role === "organizer" ? ORGANIZER_NOT_FOUND_LINKS : ANONYMOUS_NOT_FOUND_LINKS;
  return { eyebrow, links };
}

portalPreviewRoutes.get("/preview", async (c) => {
  const auth = c.var.auth;
  // Guard: organizer only. Every other case (anonymous, reviewer, speaker)
  // renders the SAME 404 card shared.tsx's speakerGate already builds for an
  // unknown /portal/* path — a 404, never a redirect, so the route is
  // invisible to roles it is not for.
  //
  // DEC-550: an ANONYMOUS request must be turned away strictly before any db
  // access, so the no-auth branch is split out and uses the db-free default
  // eyebrow ("Not found" — exactly what resolveNotFoundEyebrow itself returns
  // for a non-single-event hub) instead of reading the org/event name. An
  // authenticated non-organizer has already paid for a session lookup, so it
  // still gets the branded eyebrow.
  if (!auth) {
    return c.html(
      <NotFoundDocument
        eyebrow="Not found"
        body="The link may be old, or the event may have been switched since it was saved."
        links={ANONYMOUS_NOT_FOUND_LINKS}
      />,
      404,
    );
  }
  if (auth.role !== "organizer") {
    const { eyebrow, links } = await renderNotFound(c);
    return c.html(
      <NotFoundDocument
        eyebrow={eyebrow}
        body="The link may be old, or the event may have been switched since it was saved."
        links={links}
      />,
      404,
    );
  }

  const eventId = c.req.query("eventId");
  const event = eventId ? await getEventForOrg(c.var.db, eventId, auth.orgId) : null;
  if (!event) {
    // No eventId given, or it doesn't belong to this org (object-level
    // ownership check, SPEC §6) — same 404 card, not a redirect.
    const { eyebrow, links } = await renderNotFound(c);
    return c.html(
      <NotFoundDocument
        eyebrow={eyebrow}
        body="The link may be old, or the event may have been switched since it was saved."
        links={links}
      />,
      404,
    );
  }

  const [settings, resources] = await Promise.all([
    getPortalSettingsForEvent(c.var.db, event.id),
    listResourcesForEvent(c.var.db, event.id),
  ]);

  const branding: PortalBrandingChrome = {
    eventName: event.name,
    welcomeMessage: settings?.welcomeMessage ?? null,
    accentColor: settings?.accentColor ?? null,
    // DEC-322 wave-30 amendment: sanitize at the read so a legacy stored
    // value (written before this gate existed) can never reach an <img
    // src>.
    logoUrl: safeImageSrc(settings?.logoUrl ?? null),
  };

  const { token: csrfToken, setCookieIfNew } = ensureCsrfCookie(c);
  if (setCookieIfNew) c.header("Set-Cookie", setCookieIfNew, { append: true });

  return c.html(
    <PreviewPage
      branding={branding}
      resources={resources}
      showResources={settings?.showResources ?? true}
      csrfToken={csrfToken}
    />,
  );
});
