// The participant home (Portals frame, flow 6 "One home per person"):
// profile first, then one section per participation -- each session role,
// sponsor company and event role -- with the portal's note to participants
// under its heading. No portal names: the participant sees their roles, not
// the configuration. Rendered from the one person-view builder
// (src/server/repo/portals/view.ts), which preview-as-participant also uses,
// so the two can't disagree.

import type { Db } from "../../server/context";
import type { PersonView, ViewItem, ViewSection } from "../../server/repo/portals/view";
import { getPortalHome, type PortalHome } from "../../server/repo/portal";
import { formatDueDay } from "../../lib/event-time";
import { dayLabelOfInstant } from "../../lib/timezone";
import { lockLine, PROFILE_FIELDS, resolveField, type ProfileField, type ResolvedField } from "../../domain/portals/permissions";
import { capitalizeFirst, countOf, plural, spellCount } from "../../domain/count-copy";
import { CSRF_COOKIE_NAME } from "../../auth/cookies";
import { formatNoun } from "../../domain/sponsors";
import { sessionFormatLabel } from "../../lib/session-vocabulary";
import { HOME_DONE_FOLD_JS } from "./participant-home.css";
import { PublicEmptyState } from "../public/empty-state";
import { ITEM_STATE_WORDS } from "../../domain/portals/items";

export type HomeData = PortalHome;

/** The home loader (src/server/repo/portal/home.ts), re-exported here for
 * the portal pages that read permissions from it. */
export async function loadHome(db: Db, contactId: string, orgId: string, now: number, opts: { heal: boolean } = { heal: true }): Promise<HomeData> {
  return getPortalHome(db, contactId, orgId, now, opts);
}

/** A section shows when it has something for the participant: items, an
 * invitation to answer, an accepted session (its own schedule), or a
 * sponsor company. A submission still in review lives in "Your
 * submissions" below instead. */
export function visibleSections(view: PersonView): ViewSection[] {
  return view.sections.filter((s) => {
    if (s.items.length > 0) return true;
    if (s.participation.participationStatus === "invited") return true;
    if (s.participation.company) return true;
    if (s.participation.session?.status === "accepted") return true;
    return s.participation.kind === "event_role" && s.notes.length > 0;
  });
}

export function homeTodoCount(views: PersonView[]): number {
  return views.reduce((n, v) => n + v.todoCount, 0) + views.reduce((n, v) => n + legacyInvitationCount(v), 0);
}

// an invitation no portal covers still needs an answer
function legacyInvitationCount(view: PersonView): number {
  return view.sections.filter((s) => s.participation.participationStatus === "invited" && !s.items.some((i) => i.kind === "acceptance")).length;
}

function day(ms: number): string {
  return formatDueDay(ms);
}

function completedDay(ms: number, tz: string): string {
  return formatDueDay(dayLabelOfInstant(ms, tz));
}

/** The row's second line: "Due 1 Aug · open until 8 Aug", "Closed 1 Aug ·
 * ask the organizers", "Sent 20 Jul", "Reply by 15 Mar". */
export function itemLine(item: ViewItem, tz: string): string {
  if (item.kind === "acceptance") {
    if (item.state === "waiting") return item.dueDay !== null ? `Reply by ${day(item.dueDay)}` : "Waiting for your answer";
    return item.completedAt !== null ? `Accepted ${completedDay(item.completedAt, tz)}` : "Accepted";
  }
  if (item.kind === "sponsor_sessions") return item.statusLine ?? "";
  switch (item.state) {
    case "done": {
      if (item.completedAt === null) return "";
      const verb = item.kind === "file_request" || item.kind === "headshot" ? "Uploaded" : "Sent";
      return `${verb} ${completedDay(item.completedAt, tz)}`;
    }
    case "overdue_open":
      if (item.dueDay === null) return "Overdue";
      return item.openUntil !== null ? `Due ${day(item.dueDay)} · open until ${day(item.openUntil)}` : `Due ${day(item.dueDay)}`;
    case "closed":
      return item.dueDay !== null ? `Closed ${day(item.dueDay)} · ask the organizers` : "Closed · ask the organizers";
    case "optional":
      return item.dueDay !== null ? `Optional · by ${day(item.dueDay)}` : "Optional";
    case "waiting":
      return item.statusLine ?? "Waiting";
    default:
      return item.dueDay !== null ? `Due ${day(item.dueDay)}` : "";
  }
}

function stateWord(item: ViewItem): string {
  return item.statusWord ?? ITEM_STATE_WORDS[item.state];
}

/** Where an item's title leads, or null when there's nothing to open. */
export function itemHref(item: ViewItem, section: ViewSection | null): string | null {
  if (item.kind === "bio" || item.kind === "headshot") return "/portal/profile";
  if (item.kind === "sponsor_sessions") return section?.sponsor ? `/portal/sponsors/${section.sponsor.sponsorshipId}` : null;
  if (item.kind === "acceptance") return null;
  if (!item.assignmentId) return null;
  if (item.kind === "form") return `/portal/tasks/${item.assignmentId}/form`;
  if (item.kind === "share_kit") return `/portal/tasks/${item.assignmentId}/share`;
  return `/portal/tasks#task-${item.assignmentId}`;
}

function ItemRow(props: { item: ViewItem; section: ViewSection | null; view: PersonView; preview: boolean }) {
  const { item, section, view, preview } = props;
  const href = preview ? null : itemHref(item, section);
  const line = itemLine(item, view.timezone);
  const word = stateWord(item);
  const pill = item.state === "overdue_open" || item.state === "closed";
  const field = item.kind === "bio" || item.kind === "headshot" ? view.profileFields[item.kind] : null;
  const locked = field && field.level !== "edit" && field.lockedBy ? lockLine(field.lockedBy) : null;
  return (
    <div class={`chq-home-row${item.state === "done" ? " chq-home-row-done" : ""}`} data-state={item.state}>
      <div class="chq-home-row-main">
        {href ? (
          <a class="chq-home-row-title" href={href}>
            {item.title}
          </a>
        ) : (
          <span class="chq-home-row-title">{item.title}</span>
        )}
        {line ? (
          <span class="chq-home-row-line">
            {line}
            {item.state === "todo" && item.required && item.dueDay !== null ? <span class="chq-home-required"> · required</span> : null}
          </span>
        ) : null}
        {item.description ? <span class="chq-home-row-line">{item.description}</span> : null}
        {locked ? (
          <span class="chq-home-lock">
            <span class="chq-home-lock-word">Locked</span> {locked}
          </span>
        ) : null}
      </div>
      <span class={pill ? "chq-home-pill" : "chq-home-state"}>{word}</span>
    </div>
  );
}

function ItemList(props: { items: ViewItem[]; section: ViewSection | null; view: PersonView; preview: boolean }) {
  const open = props.items.filter((i) => i.state !== "done");
  const done = props.items.filter((i) => i.state === "done");
  return (
    <>
      {open.map((item) => (
        <ItemRow item={item} section={props.section} view={props.view} preview={props.preview} />
      ))}
      {done.length > 0 ? (
        // Done items collapse behind a "2 done" line on phone (frame, 390);
        // at desktop the summary is hidden and they read inline.
        <details class="chq-home-done" open>
          <summary class="chq-home-done-summary">{`${done.length} done`}</summary>
          {done.map((item) => (
            <ItemRow item={item} section={props.section} view={props.view} preview={props.preview} />
          ))}
        </details>
      ) : null}
    </>
  );
}

function sectionTitle(section: ViewSection): string {
  if (section.participation.company) return section.participation.company.companyName;
  if (section.participation.session) return section.participation.session.title;
  return section.heading;
}

function sectionMeta(s: ViewSection, placements: Map<string, string | null>): string | null {
  if (s.sponsor) {
    const n = s.sponsor.teammates;
    return n === 0 ? "Just you so far" : `You and ${spellCount(n)} ${plural(n, "teammate")}`;
  }
  const sid = s.participation.session?.submissionId;
  if (sid) {
    const placed = placements.get(sid);
    if (placed) return placed;
    // DEC-895: a stored label with no parseable duration is omitted, never
    // printed raw as if it were a length
    const format = s.participation.session?.format;
    return format && sessionFormatLabel(format) !== format ? sessionFormatLabel(format) : null;
  }
  return null;
}

function InvitationActions(props: { section: ViewSection; csrfToken: string; preview: boolean }) {
  const participantId = props.section.participation.session?.participantId;
  if (!participantId) return null;
  if (props.preview) {
    return (
      <div class="chq-home-actions">
        <button type="button" class="chq-btn chq-btn-primary" disabled>
          Accept the invitation
        </button>
        <button type="button" class="chq-btn chq-btn-secondary" disabled>
          Decline
        </button>
      </div>
    );
  }
  return (
    <div class="chq-home-actions">
      <form method="post" action={`/portal/invitations/${participantId}`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
        <input type="hidden" name="action" value="accept" />
        <button type="submit" class="chq-btn chq-btn-primary">
          Accept the invitation
        </button>
      </form>
      <form method="post" action={`/portal/invitations/${participantId}`}>
        <input type="hidden" name={CSRF_COOKIE_NAME} value={props.csrfToken} />
        <input type="hidden" name="action" value="decline" />
        <button type="submit" class="chq-btn chq-btn-secondary">
          Decline
        </button>
      </form>
    </div>
  );
}

function Section(props: {
  section: ViewSection;
  view: PersonView;
  placements: Map<string, string | null>;
  csrfToken: string;
  preview: boolean;
  sessionExtra?: (submissionId: string, eventId: string) => unknown;
}) {
  const { section: s, view, preview } = props;
  const invited = s.participation.participationStatus === "invited";
  const meta = sectionMeta(s, props.placements);
  // an invitation no portal covers still gets its answer row
  const items =
    invited && !s.items.some((i) => i.kind === "acceptance")
      ? [
          {
            key: `sys:acceptance:${s.participation.key}`,
            kind: "acceptance" as const,
            title: "Accept your invitation",
            taskId: null,
            formId: null,
            assignmentId: null,
            scopeKey: s.participation.key,
            state: "waiting" as const,
            required: true,
            dueDay: s.invitation?.replyBy ?? null,
            graceDays: 0,
            canAct: true,
            completedAt: null,
            portals: [],
            direct: false,
            merge: null,
            detached: false,
            statusLine: null,
            statusWord: null,
            openUntil: null,
            instructions: null,
          },
          ...s.items,
        ]
      : s.items;
  const submissionId = s.participation.session?.submissionId;
  return (
    <section class="chq-home-section" aria-label={`${s.heading}: ${sectionTitle(props.section)}`}>
      <div class="chq-home-label">{s.heading}</div>
      <h2 class="chq-home-title">
        {!preview && submissionId && !invited ? (
          <a class="chq-home-title-link" href={`/portal/submissions/${submissionId}`}>
            {sectionTitle(props.section)}
          </a>
        ) : (
          sectionTitle(props.section)
        )}
      </h2>
      {meta ? <p class="chq-home-meta">{meta}</p> : null}
      {s.notes.map((n) => (
        <p class="chq-home-note">{n}</p>
      ))}
      <div class="chq-home-rows">
        <ItemList items={items} section={s} view={view} preview={preview} />
      </div>
      {invited && s.deferredItemNames.length > 0 ? (
        <p class="chq-home-then">Then: {s.deferredItemNames.map((n) => n.toLowerCase()).join(", ")}</p>
      ) : null}
      {invited ? <InvitationActions section={s} csrfToken={props.csrfToken} preview={preview} /> : null}
      {!preview && s.sponsor?.canAddTeammates ? (
        <p class="chq-home-links">
          <a class="chq-portal-standalone-link" href={`/portal/sponsors/${s.sponsor.sponsorshipId}/team`}>
            Manage your team
          </a>
        </p>
      ) : null}
      {!preview && submissionId && !invited && s.participation.session?.status === "accepted" && props.sessionExtra ? (
        <div class="chq-home-extras">{props.sessionExtra(submissionId, view.eventId) as any}</div>
      ) : null}
    </section>
  );
}

function invitationLead(sections: ViewSection[]): string | null {
  const invited = sections.filter((s) => s.participation.participationStatus === "invited");
  if (invited.length === 0) return null;
  if (invited.length > 1) return "You're invited to speak";
  const s = invited[0]!;
  const fmt = s.participation.session?.format;
  const role = s.participation.role;
  if (role === "panelist") return "You're invited to join a panel";
  if (role === "moderator") return "You're invited to moderate a session";
  const noun = fmt ? formatNoun(fmt) : "talk";
  return `You're invited to give ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;
}

export function HomeBody(props: {
  firstName: string;
  data: HomeData;
  csrfToken: string;
  preview: boolean;
  // "DevFlow Conf 2027 · you speak Tue 12 May, 10:00 · Room 2A" (DEC-590)
  subline?: string;
  // just accepted an invitation (Portals frame flow 8, "You're confirmed")
  confirmed?: boolean;
  sessionExtra?: (submissionId: string, eventId: string) => unknown;
}) {
  const { data, preview } = props;
  const n = homeTodoCount(data.views);
  const all = data.views.flatMap((v) => visibleSections(v));
  const lead = invitationLead(all);
  const onlyInvitations = all.length > 0 && all.every((s) => s.participation.participationStatus === "invited");
  const multiEvent = data.views.length > 1;
  return (
    <>
      <h1 class="chq-portal-hero chq-home-hero">
        Hi {props.firstName}
        {n > 0 ? ` — ${countOf(n, "thing")} to do` : null}
      </h1>
      {props.subline ? <p class="chq-portal-sub">{props.subline}</p> : null}
      {props.confirmed ? (
        <div class="chq-home-callout" role="status">
          <strong>You're confirmed</strong>
          <span>Thank you, {props.firstName}. Here's what's next.</span>
        </div>
      ) : null}
      {lead ? (
        <div class="chq-home-callout" role="status">
          <strong>{lead}</strong>
          {onlyInvitations ? <span>Nothing is due until you accept.</span> : null}
        </div>
      ) : null}
      {all.length === 0 && !data.views.some((v) => v.profileItems.length > 0) ? (
        // nothing from any portal yet, and no session of theirs is accepted
        <>
          <section aria-label="Waiting on you" class="chq-section">
            <PublicEmptyState variant="fresh" what="Nothing pending right now." />
          </section>
          <section aria-label="Your sessions" class="chq-section">
            <PublicEmptyState
              variant="fresh"
              what="No accepted sessions yet."
              reason="When a session of yours is accepted it appears here with its schedule."
            />
          </section>
        </>
      ) : null}
      {data.views.map((view) => {
        const sections = visibleSections(view);
        const showProfile = view.profileItems.length > 0;
        const blocks = (showProfile ? 1 : 0) + sections.length;
        return (
          <div class={`chq-home-event${blocks >= 3 ? " chq-home-wide" : ""}`}>
            {multiEvent ? <div class="chq-home-event-name">{view.eventName}</div> : null}
            <div class="chq-home-grid">
              {showProfile ? (
                <section class="chq-home-section" aria-label="Your profile">
                  <div class="chq-home-label">Your profile</div>
                  {view.profileNotes.map((note) => (
                    <p class="chq-home-note">{note}</p>
                  ))}
                  <div class="chq-home-rows chq-home-rows-first">
                    <ItemList items={view.profileItems} section={null} view={view} preview={preview} />
                  </div>
                </section>
              ) : null}
              {sections.map((s) => (
                <Section
                  section={s}
                  view={view}
                  placements={data.placements}
                  csrfToken={props.csrfToken}
                  preview={preview}
                  sessionExtra={props.sessionExtra}
                />
              ))}
            </div>
          </div>
        );
      })}
      {data.views.some((v) => [...v.profileItems, ...v.sections.flatMap((x) => x.items)].some((i) => i.state === "done")) ? (
        <script dangerouslySetInnerHTML={{ __html: HOME_DONE_FOLD_JS }} />
      ) : null}
    </>
  );
}

export function capitalizedCount(n: number): string {
  return capitalizeFirst(spellCount(n));
}

const LEVEL_ORDER: Record<string, number> = { hidden: 0, view: 1, edit: 2 };

/** One person's profile fields across every event they take part in: the
 * strictest level wins (the profile is one record, shared by every event),
 * and the lock line names the participation that set it. */
export function mergeProfileFields(views: PersonView[]): Record<ProfileField, ResolvedField> {
  const out = Object.fromEntries(PROFILE_FIELDS.map((f) => [f, resolveField(f, [])])) as Record<ProfileField, ResolvedField>;
  if (views.length === 0) return out;
  for (const f of PROFILE_FIELDS) {
    const fields = views.map((v) => v.profileFields[f]);
    let best: ResolvedField = fields[0]!;
    for (const r of fields.slice(1)) {
      if (LEVEL_ORDER[r.level]! < LEVEL_ORDER[best.level]!) best = { ...r, help: r.help ?? best.help };
      else if (!best.help && r.help) best = { ...best, help: r.help };
    }
    out[f] = best;
  }
  return out;
}

export interface SessionAccess {
  editSubmission: boolean;
  addCoPresenters: boolean;
  sessionTitle: ResolvedField;
  abstract: ResolvedField;
}

/** What this person's portals let them do on one of their sessions
 * (Portals frame, "Permissions · actions" and the session fields). A
 * session no portal covers keeps today's abilities. */
export async function sessionAccessFor(db: Db, contactId: string, orgId: string, submissionId: string): Promise<SessionAccess> {
  const home = await loadHome(db, contactId, orgId, Date.now(), { heal: false });
  for (const view of home.views) {
    const section = view.sections.find((s) => s.participation.session?.submissionId === submissionId);
    if (section) {
      return {
        editSubmission: section.capabilities.editSubmission,
        addCoPresenters: section.capabilities.addCoPresenters,
        sessionTitle: section.sessionFields.sessionTitle,
        abstract: section.sessionFields.abstract,
      };
    }
  }
  return {
    editSubmission: true,
    addCoPresenters: true,
    sessionTitle: resolveField("sessionTitle", []),
    abstract: resolveField("abstract", []),
  };
}
