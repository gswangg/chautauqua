// Person record (Portals frame, flow 3 "What a person gets, and why"): the
// two tables. Participations says what the person is at this event and
// which portals each one matched; Every item says what they were given and
// which portal brought it, so every row answers "why does she have this?"
// without opening a portal. Words come from the participant home
// (src/routes/portal/home.tsx) so organizer and participant read the same
// status for the same item.
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { formatDateOnlyNoYear } from '../../lib/dates';
import { countOf } from '../../lib/plural';
import { SESSION_ORIGIN_LABELS, isSessionOrigin } from '../../../../src/domain/portals/participations';
import { STATUS_LABELS } from '../submissions/types';
import type { SubmissionStatus } from '../submissions/types';
import type { PersonViewJson, ResolvedField, ViewItemJson, ViewParticipationJson, ViewSectionJson } from './types';
import { ITEM_STATE_WORDS } from '../../../../src/domain/portals/items';

// The view also carries, per section, what an unanswered invitation brings
// once accepted (src/server/repo/portals/view.ts ViewSection.deferredItems);
// the SPA's shared type leaves it out, so it is read here.
interface DeferredItem {
  name: string;
  dueDay: number | null;
  relativeDays: number | null;
}

type RecordSection = ViewSectionJson & { deferredItems?: DeferredItem[] };

// The participant home's own state words (one source in the domain module),
// so the record and the home never disagree about what an item is.
function statusWord(item: Pick<ViewItemJson, 'state' | 'statusWord'>): string {
  return item.statusWord ?? ITEM_STATE_WORDS[item.state];
}

// Each register's class written out in full, so the CSS contract scans can
// see every token.
const STATUS_CLASS = {
  pill: 'chq-person-record-status chq-person-record-status-pill',
  strong: 'chq-person-record-status chq-person-record-status-strong',
  quiet: 'chq-person-record-status chq-person-record-status-quiet',
} as const;

/** The status cell's register: an ink pill for late work (the home's own
 * pill states), bold ink for what still needs doing, muted for settled. */
function statusTone(item: Pick<ViewItemJson, 'state' | 'statusWord'>): keyof typeof STATUS_CLASS {
  if (item.state === 'overdue_open' || item.state === 'closed') return 'pill';
  if (item.state === 'todo' || item.state === 'optional') return 'strong';
  // "Changes requested" overrides a waiting state: it is back with them
  if (item.statusWord && item.state !== 'done') return 'strong';
  return 'quiet';
}

export function dayLabel(dueDay: number): string {
  return formatDateOnlyNoYear(dueDay);
}

/** "Through the CFP · accepted", "Invited by organizers", "Gold sponsor". */
export function arrivalLine(p: ViewParticipationJson): string {
  const part = p.participation;
  // the session's origin says how the session arrived; an open invitation
  // onto someone else's CFP session still needs naming as an invitation
  const invite =
    part.participationStatus === 'invited'
      ? part.session?.origin === 'organizer'
        ? 'no reply yet'
        : 'invited, no reply yet'
      : part.participationStatus === 'declined'
        ? 'declined'
        : null;
  if (part.session) {
    const origin = isSessionOrigin(part.session.origin) ? SESSION_ORIGIN_LABELS[part.session.origin] : 'Added by organizers';
    // an organizer or sponsor session is accepted by construction; the
    // status is news only for a CFP or imported session, or when it moved
    const showStatus = part.session.origin === 'cfp' || part.session.origin === 'import' || part.session.status !== 'accepted';
    const status = STATUS_LABELS[part.session.status as SubmissionStatus] ?? part.session.status;
    return [origin, showStatus ? status.toLowerCase() : null, invite].filter(Boolean).join(' · ');
  }
  if (part.company) {
    const tier = part.company.tierName ? `${part.company.tierName} sponsor` : 'Sponsor';
    const pending = part.company.sponsorshipStatus !== 'active' ? 'sponsorship pending' : null;
    const joined = part.participationStatus === 'invited' ? "hasn't joined yet" : null;
    return [tier, pending, joined].filter(Boolean).join(' · ');
  }
  return 'Added by organizers';
}

/** The record's group heading for a participation's items: the session's
 * reference and title, the company, or the role ("Press"). The home's own
 * heading ("Your talk") speaks to the participant, not about them. */
function sectionTitle(section: ViewSectionJson): string {
  const p = section.participation;
  if (p.session) return `${p.session.ref} ${p.session.title}`;
  if (p.company) return p.company.companyName;
  return section.heading;
}

/** "Earliest deadline and required flag from Invited speakers". */
function mergeLine(item: Pick<ViewItemJson, 'merge' | 'portals'>): string | null {
  if (!item.merge || item.portals.length < 2) return null;
  const { deadlineFrom, requiredFrom } = item.merge;
  if (deadlineFrom && requiredFrom) {
    return deadlineFrom === requiredFrom
      ? `Earliest deadline and required flag from ${deadlineFrom}`
      : `Earliest deadline from ${deadlineFrom} · required flag from ${requiredFrom}`;
  }
  if (deadlineFrom) return `Earliest deadline from ${deadlineFrom}`;
  if (requiredFrom) return `Required flag from ${requiredFrom}`;
  return null;
}

/** "View only, from Invited speakers": a profile field a portal locks. */
function lockText(field: ResolvedField | undefined): string | null {
  if (!field || field.level === 'edit' || !field.lockedBy) return null;
  const level = field.level === 'hidden' ? 'Hidden' : 'View only';
  return `${level}, from ${field.lockedBy.portalName}`;
}

function portalHref(portalId: string): string {
  return `/settings/portals/${portalId}`;
}

// A link to the portal editor. The phone hit box is the anchor; the pill
// face is the inner span, so a 44px floor doesn't inflate the pill.
function PortalTag(props: { portal: { id: string; name: string } }) {
  return (
    <Link className="chq-person-record-tag" to={portalHref(props.portal.id)}>
      <span className="chq-person-record-tag-face">{props.portal.name}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Participations
// ---------------------------------------------------------------------------

const COVERAGE_HREF = '/speakers?portal=none';

function PortalsCell(props: { p: ViewParticipationJson }) {
  const { p } = props;
  if (p.declined) {
    return <span className="chq-person-record-quiet">Declined, so in no portal</span>;
  }
  if (p.portals.length === 0) {
    return (
      <div className="chq-person-record-stack">
        <span className="chq-person-record-unmatched">Matches no portal</span>
        <span className="chq-person-record-quiet">{p.unmatchedReason ?? 'No portal rule covers it'}</span>
        <Link className="chq-link-button chq-person-record-coverage" to={COVERAGE_HREF}>
          Everyone not in a portal
        </Link>
      </div>
    );
  }
  return (
    <div className="chq-person-record-tags">
      {p.portals.map((portal) => (
        <PortalTag key={portal.id} portal={portal} />
      ))}
    </div>
  );
}

export function ParticipationsTable(props: { participations: ViewParticipationJson[] }) {
  return (
    <div className="chq-person-record-table" role="table" aria-label="Participations">
      <div className="chq-person-record-cols chq-person-record-cols-participations" role="row">
        <span role="columnheader">Participation</span>
        <span role="columnheader">How it arrived</span>
        <span role="columnheader">Portals it matched</span>
      </div>
      {props.participations.map((p) => (
        <div
          className="chq-person-record-row chq-person-record-row-participation"
          role="row"
          key={p.participation.key}
          data-declined={p.declined ? 'true' : undefined}
        >
          <span role="cell" className="chq-person-record-title">
            {p.label}
          </span>
          <span role="cell" className="chq-person-record-quiet">
            {arrivalLine(p)}
          </span>
          <span role="cell">
            <PortalsCell p={p} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Every item, and the portal that brought it
// ---------------------------------------------------------------------------

function BroughtBy(props: { item: ViewItemJson; lock: string | null }) {
  const { item, lock } = props;
  if (item.detached) {
    return <span className="chq-person-record-quiet">No longer in a portal · kept on the record</span>;
  }
  const merge = mergeLine(item);
  return (
    <div className="chq-person-record-stack">
      {item.portals.length > 1 ? (
        // one item from several portals shows once: one outlined tag that
        // names every portal, each name still a link to its editor
        <span className="chq-person-record-merged">
          {item.portals.map((portal, i) => (
            <Fragment key={portal.id}>
              {i > 0 ? (
                <span className="chq-person-record-merged-plus" aria-hidden="true">
                  +
                </span>
              ) : null}
              <Link className="chq-person-record-merged-link" to={portalHref(portal.id)}>
                {portal.name}
              </Link>
            </Fragment>
          ))}
        </span>
      ) : item.portals.length === 1 ? (
        <div className="chq-person-record-tags">
          <PortalTag portal={item.portals[0]!} />
        </div>
      ) : null}
      {item.direct ? (
        <span className="chq-person-record-quiet">{item.portals.length > 0 ? 'Also assigned directly' : 'Assigned directly'}</span>
      ) : null}
      {merge ? <span className="chq-person-record-quiet">{merge}</span> : null}
      {lock ? (
        <span className="chq-person-record-lock">
          <span className="chq-person-record-lock-word">Locked</span>
          <span className="chq-person-record-quiet">{lock}</span>
        </span>
      ) : null}
    </div>
  );
}

function ItemRow(props: {
  item: ViewItemJson;
  view: PersonViewJson;
  onReopen: ((item: ViewItemJson) => void) | null;
}) {
  const { item, view, onReopen } = props;
  const field = item.kind === 'bio' || item.kind === 'headshot' ? view.profileFields[item.kind] : undefined;
  const tone = statusTone(item);
  const canReopen = onReopen !== null && item.state === 'closed' && item.assignmentId !== null;
  return (
    <div className="chq-person-record-row chq-person-record-row-item" role="row" data-state={item.state}>
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-title">
        <span className="chq-person-record-title">{item.title}</span>
        {item.statusLine ? <span className="chq-person-record-sub">{item.statusLine}</span> : null}
      </span>
      <span role="cell" className="chq-person-record-cell-by">
        <BroughtBy item={item} lock={lockText(field)} />
      </span>
      {/* the deadline cell carries the item's open window: when it stays
          open until, or the Reopen that gives it one */}
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-due">
        <span className="chq-person-record-quiet">{item.dueDay !== null ? dayLabel(item.dueDay) : 'No deadline'}</span>
        {item.state === 'overdue_open' && item.openUntil !== null ? (
          <span className="chq-person-record-sub">Open until {dayLabel(item.openUntil)}</span>
        ) : null}
        {canReopen ? (
          <button type="button" className="chq-link-button chq-person-record-reopen" onClick={() => onReopen(item)}>
            Reopen
          </button>
        ) : null}
      </span>
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-status">
        <span className={STATUS_CLASS[tone]}>{statusWord(item)}</span>
      </span>
    </div>
  );
}

function deferredDeadline(d: DeferredItem): string {
  if (d.dueDay !== null) return dayLabel(d.dueDay);
  if (d.relativeDays !== null) return `${countOf(d.relativeDays, 'day')} after accepting`;
  return 'No deadline';
}

// What an unanswered invitation brings: nothing is assigned or due until
// they accept, and a relative deadline only starts then.
function DeferredRow(props: { item: DeferredItem; firstName: string }) {
  return (
    <div className="chq-person-record-row chq-person-record-row-item" role="row" data-state="deferred">
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-title">
        <span className="chq-person-record-title">{props.item.name}</span>
      </span>
      <span role="cell" className="chq-person-record-cell-by">
        <span className="chq-person-record-quiet">Arrives when {props.firstName} accepts</span>
      </span>
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-due">
        <span className="chq-person-record-quiet">{deferredDeadline(props.item)}</span>
      </span>
      <span role="cell" className="chq-person-record-stack chq-person-record-cell-status">
        <span className={STATUS_CLASS.quiet}>Waiting</span>
      </span>
    </div>
  );
}

interface ItemGroup {
  key: string;
  title: string;
  items: ViewItemJson[];
  deferred: DeferredItem[];
}

/** Profile first (shown once, however many portals bring it), then one
 * group per participation that has anything to show. */
export function itemGroups(view: PersonViewJson): ItemGroup[] {
  const groups: ItemGroup[] = [];
  if (view.profileItems.length > 0) {
    groups.push({ key: 'profile', title: 'Profile — shown once', items: view.profileItems, deferred: [] });
  }
  for (const section of view.sections as RecordSection[]) {
    const deferred = section.participation.participationStatus === 'invited' ? (section.deferredItems ?? []) : [];
    if (section.items.length === 0 && deferred.length === 0) continue;
    groups.push({ key: section.participation.key, title: sectionTitle(section), items: section.items, deferred });
  }
  return groups;
}

export function itemCount(groups: ItemGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length + g.deferred.length, 0);
}

export function ItemsTable(props: {
  view: PersonViewJson;
  groups: ItemGroup[];
  firstName: string;
  onReopen: ((item: ViewItemJson) => void) | null;
}) {
  return (
    <div className="chq-person-record-table" role="table" aria-label="Every item">
      <div className="chq-person-record-cols chq-person-record-cols-items" role="row">
        <span role="columnheader">Item</span>
        <span role="columnheader">Brought by</span>
        <span role="columnheader">Deadline</span>
        <span role="columnheader">Status</span>
      </div>
      {props.groups.map((g) => (
        <div role="rowgroup" key={g.key} aria-label={g.title}>
          <div className="chq-person-record-group" role="row">
            <span role="cell">{g.title}</span>
          </div>
          {g.items.map((item) => (
            <ItemRow key={item.key} item={item} view={props.view} onReopen={props.onReopen} />
          ))}
          {g.deferred.map((d) => (
            <DeferredRow key={`deferred:${d.name}`} item={d} firstName={props.firstName} />
          ))}
        </div>
      ))}
    </div>
  );
}
