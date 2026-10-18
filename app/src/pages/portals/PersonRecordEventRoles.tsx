// Person record: event roles. Press, Volunteer and the like are
// participations with no session or company, so this is where an
// organizer gives someone one (and where a rule like the Volunteers
// portal's "Role is Volunteer" finds them).
import { useState } from 'react';
import { apiDelete, apiPost, ApiError } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EVENT_ROLE_OPTIONS } from '../../../../src/domain/portals/participations';
import type { EventRoleRow } from './types';

export function EventRolesSection(props: {
  eventId: string;
  contactId: string;
  firstName: string;
  roles: EventRoleRow[];
  onChanged: (message: string) => void;
}) {
  const { eventId, contactId, roles } = props;
  const held = new Set(roles.map((r) => r.role));
  const addable = EVENT_ROLE_OPTIONS.filter((o) => !held.has(o.value));
  const [choice, setChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<EventRoleRow | null>(null);

  async function add() {
    if (choice === '') {
      setError('Choose a role to add.');
      return;
    }
    const label = EVENT_ROLE_OPTIONS.find((o) => o.value === choice)?.label ?? choice;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/events/${eventId}/event-roles`, { contactId, role: choice });
      setChoice('');
      props.onChanged(`${props.firstName} is now ${label}. Portals update in a moment.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The role was not added');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: EventRoleRow) {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/events/${eventId}/event-roles/${row.id}`);
      setRemoving(null);
      props.onChanged(`Removed ${row.roleLabel}. Portals update in a moment.`);
    } catch (err) {
      setRemoving(null);
      setError(err instanceof ApiError ? err.message : 'The role was not removed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chq-section" aria-label="Event roles">
      <div className="chq-section-head">
        <span className="chq-section-label">Event roles · {roles.length}</span>
      </div>
      <p className="chq-person-record-caption">Roles with no session or company, like Press or Volunteer. Portal rules can match them.</p>
      {error ? <div className="chq-error">{error}</div> : null}
      {roles.length > 0 ? (
        <ul className="chq-person-record-roles">
          {roles.map((r) => (
            <li className="chq-person-record-role" key={r.id}>
              <span className="chq-person-record-title">{r.roleLabel}</span>
              <button
                type="button"
                className="chq-link-button"
                onClick={() => setRemoving(r)}
                disabled={busy}
                aria-label={`Remove ${r.roleLabel}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {addable.length > 0 ? (
        <div className="chq-person-record-role-add">
          <select
            className="chq-select"
            aria-label="Role to add"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={busy}
          >
            <option value="">Choose a role</option>
            {addable.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void add()} disabled={busy}>
            Add a role
          </button>
        </div>
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${removing.roleLabel} from ${props.firstName}?`}
          body="Portals that match this role stop bringing its items. Finished work stays on the record."
          confirmLabel="Remove role"
          pending={busy}
          onConfirm={() => void remove(removing)}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </section>
  );
}
