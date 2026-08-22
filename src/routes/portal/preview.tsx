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
import { DEC_747, DEC_322, DEC_902 } from "../../decisions";
import { safeImageSrc } from "../../domain/brand-url";
import { DEFAULT_PORTAL_SETTINGS } from "../../domain/portal-settings";

void DEC_322;

void DEC_747;

void DEC_902;

export const portalPreviewRoutes = new Hono<AppEnv>();

function resourceKindLabel(kind: string): string {
  return kind === "file" ? "File" : "Wiki page";
}

function PreviewResourceRow(props: { resource: ResourceRecord }) {
  const { resource } = props;
  return (
    <div class="chq-portal-row">
      <div class="chq-portal-row-head">
        <span class="chq-portal-row-title">{resource.title}</span>
        {/* DEC-733 says an action that cannot apply to a row is ABSENT, never
            disabled — but Download is not inapplicable here, it is a real
            speaker control this preview cannot exercise because there is no
            speaker session to download as. Rendering it disabled shows the
            organizer the control that exists for the speaker, rather than
            silently dropping it, so DEC-747's frame ruling names this the one
            sanctioned disabled control on the surface.
            G13 (frame 10--24, MAJOR) + DEVIATIONS §2: a disabled link-shaped
            control keeps NO surface -- muted text, no box, right-flushed on
            the title's own line -- never a full-column filled secondary
            (full-column buttons are phone anatomy).
            DEC-747 amendment (wave-153): the tooltip is copy too, and it used
            to name a capability the product has no path for ("sign in as
            this speaker") -- directly contradicting the read-only-
            impersonation sentence this same page renders below and the
            control's own name on the settings frame ("Open as a speaker").
            The tooltip now states the real, narrower reason the control is
            inert: this preview has no speaker session to download as,
            because it never impersonates one. */}
        <button type="button" class="chq-portal-preview-download" disabled aria-disabled="true" title="Preview only — no speaker session to download as">
          Download
        </button>
      </div>
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
    // G13 (frame 10--24): the identity slot reads 'PREVIEW · NO SPEAKER'
    // (the header cluster is the 11px caps register); headerSignOut off --
    // the preview page keeps exactly one form (the shared footer sign-out).
    <PortalLayout branding={props.branding} csrfToken={props.csrfToken} speakerName="Preview · no speaker" headerSignOut={false}>
      {/* Below this point: no form, no button, no link that mutates
          anything, and nothing scoped to a contact. PortalLayout's own
          footer sign-out control is standard /portal/* chrome (DEC-154,
          every portal page carries it) and mutates only the ORGANIZER'S
          OWN session, never portal content or a speaker's data — it is not
          part of "the preview" this task scopes. */}
      {/* w8-g (DEC-380 wave-133): frame :1488/:1523 draws two lines. The
          'Preview · read-only.' eyebrow stays first -- Ruling A22 requires
          this surface to state the read-only impersonation explicitly, and
          the frame's own first line doesn't say the word -- then the
          frame's sentence follows verbatim. */}
      <p class="chq-portal-preview-banner" role="note">
        Preview · read-only. This is the portal your speakers see. It has no speaker attached, so there are no
        submissions, tasks or files here — only what you have written for everyone.
      </p>
      {/* Frame 10--24, clause 2: the honest sentence that this page is the
          configuration, not a person's data — there is no way for an
          organizer to actually stand inside a real speaker's portal. */}
      <p class="chq-meta">
        To see a real speaker's portal you would have to be them — this preview deliberately cannot.
      </p>
      {/* G13 (frame 10--24, MAJOR): the previewed portal opens the way the
          speaker's own portal opens -- an H1 'Welcome' with the configured
          welcome message as its lede, never a 13px meta line with no H1 on
          the page at all. */}
      <h1 class="chq-portal-hero">Welcome</h1>
      {props.branding.welcomeMessage ? <p class="chq-portal-lede">{props.branding.welcomeMessage}</p> : null}
      {/* DEC-902 wave-19 clause (b): frame `Chautauqua Public and
          Portal.dc.html:1495` draws a SECOND sentence after the organizer's
          own welcome message -- `Everything we need from you is on this
          page, in order.` The clause rules this line is APP-OWNED CHROME,
          not stored copy (unlike the sentence above it, which is the
          organizer's own text in the frame's fictional world, DEC-967): it
          is a separate node appended after the lede, never concatenated
          into it and never replacing it, and it renders unconditionally --
          even when welcomeMessage is null -- because a static orientation
          line needs no stored data to be true. */}
      <p class="chq-portal-lede">Everything we need from you is on this page, in order.</p>
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
      {/* Frame 10--24, clause 1: named from what the route's own header
          comment (:8-10) says it declines to load — their submissions,
          their tasks, their files. Not invented: this is that list. */}
      <section aria-label="Not shown here" class="chq-section">
        <div class="chq-section-label">Not shown here</div>
        <p class="chq-meta">
          This preview does not include what a real speaker sees on their own portal:
        </p>
        <ul class="chq-portal-not-shown-list">
          <li class="chq-portal-not-shown-chip">Their submissions</li>
          <li class="chq-portal-not-shown-chip">Their tasks</li>
          <li class="chq-portal-not-shown-chip">Their uploaded files</li>
        </ul>
      </section>
      {/* Frame 10--24, clause 4: a plain link, never a form or button — the
          route's no-mutation invariant (comment block above) stands. */}
      {/* DEC-393 wave-142 (task w17-e): standalone row link (sole content of
          its own <p>, not a sentence phrase) -- real floor. */}
      <p class="chq-meta">
        <a class="chq-portal-standalone-link" href={`/admin/settings?section=portal`}>&lsaquo; Back to settings</a>
      </p>
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
      showResources={settings?.showResources ?? DEFAULT_PORTAL_SETTINGS.showResources}
      csrfToken={csrfToken}
    />,
  );
});
