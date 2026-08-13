// Per-speaker portal invitation (DEC-805): "Inviting a speaker to the
// portal is a send, not a pill." ONE exported invitation template constant
// (speaker_name/event_name/portal_link only), rendered through the same
// renderTemplate merge machinery every other send path uses — never a
// string typed into the route handler. Pure core (DEC-002): no node:/
// cloudflare imports.

import { renderTemplate } from "../mail/render";

/** Mirrors MAX_COMPOSE_RECIPIENTS/MAX_BULK_EMAIL_RECIPIENTS's precedent. */
export const MAX_PORTAL_INVITE_RECIPIENTS = 100;

export const PORTAL_INVITE_SUBJECT_TEMPLATE = "You're invited to the {event_name} speaker portal";

export const PORTAL_INVITE_BODY_TEMPLATE =
  "Hi {speaker_name},\n\n" +
  "You've been invited to the {event_name} speaker portal, where you can manage your " +
  "submission, complete outstanding tasks, and update your profile.\n\n" +
  "{portal_link}\n";

export interface PortalInviteRecipient {
  contactId: string;
  name: string;
  /** null/empty means this contact has no address on file — renderPortalInvites
   * names them in `missingEmail` instead of rendering/sending anything. */
  email: string | null;
}

export interface RenderedPortalInvite {
  contactId: string;
  name: string;
  email: string;
  subject: string;
  text: string;
}

export interface PortalInviteMissingEmail {
  contactId: string;
  name: string;
}

export interface PortalInviteRenderResult {
  rendered: RenderedPortalInvite[];
  missingEmail: PortalInviteMissingEmail[];
}

/**
 * Renders the ONE fixed invitation template for every recipient carrying an
 * email address; a recipient with none is named in `missingEmail` rather
 * than silently dropped (DEC-805) — it never reaches the mailer at all.
 * `portalLinkByContactId` must already contain a resolved link for every
 * recipient in `recipients` (the route resolves these async, via the SAME
 * resolvePortalLinks helper the compose path uses, before calling in).
 */
export function renderPortalInvites(
  recipients: PortalInviteRecipient[],
  eventName: string,
  portalLinkByContactId: Map<string, string>,
): PortalInviteRenderResult {
  const rendered: RenderedPortalInvite[] = [];
  const missingEmail: PortalInviteMissingEmail[] = [];

  for (const recipient of recipients) {
    if (!recipient.email || recipient.email.trim() === "") {
      missingEmail.push({ contactId: recipient.contactId, name: recipient.name });
      continue;
    }
    const portalLink = portalLinkByContactId.get(recipient.contactId);
    if (portalLink === undefined) {
      throw new Error(`renderPortalInvites: no portal link resolved for contact ${recipient.contactId}`);
    }
    const vars = { speaker_name: recipient.name, event_name: eventName, portal_link: portalLink };
    rendered.push({
      contactId: recipient.contactId,
      name: recipient.name,
      email: recipient.email,
      subject: renderTemplate(PORTAL_INVITE_SUBJECT_TEMPLATE, vars),
      text: renderTemplate(PORTAL_INVITE_BODY_TEMPLATE, vars),
    });
  }

  return { rendered, missingEmail };
}
