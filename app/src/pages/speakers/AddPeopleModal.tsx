// "Add people" on the task view (multi-portal decision 77): hand-pick
// roster people who don't hold this task yet and give it to them directly.
// Only people who have confirmed are listed: an invited speaker gets tasks
// once they accept, as everywhere else on Speakers.
// Portals give a task to everyone they cover; this is the other way in, one
// person or a few at a time. The roster is the Speakers grid's own (people
// on an accepted session), read up to the same MAX_TASK_ASSIGNEES ceiling
// the assign door accepts.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ModalFrame } from '../../components/ModalFrame';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiPost, ApiError } from '../../lib/api';
import { MAX_TASK_ASSIGNEES } from '../../lib/batch-caps';
import { countOf, plural } from '../../lib/plural';
import { MAX_NAME_LENGTH } from '../../lib/text-caps';
import type { OnboardingGridResponse } from './types';
import { isActiveParticipant } from '../../../../src/domain/acceptance';

interface Candidate {
  contactId: string;
  name: string;
  company: string | null;
}

type Roster =
  | { kind: 'loading' }
  | { kind: 'ready'; candidates: Candidate[]; unconfirmed: number; total: number; listed: number }
  | { kind: 'error' };

export function AddPeopleModal(props: {
  taskId: string;
  eventId: string;
  taskTitle: string;
  holderIds: ReadonlySet<string>;
  onClose: () => void;
  onAdded: (count: number) => void;
}) {
  const { taskId, eventId, holderIds } = props;
  const [roster, setRoster] = useState<Roster>({ kind: 'loading' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<OnboardingGridResponse>(`/events/${eventId}/onboarding?page=1&perPage=${MAX_TASK_ASSIGNEES}`)
      .then((res) => {
        if (cancelled) return;
        const open = res.rows.filter((r) => !holderIds.has(r.contact.id));
        const confirmed = open.filter((r) => r.contact.participations.some((p) => isActiveParticipant(p.inviteStatus)));
        const candidates = confirmed.map((r) => ({ contactId: r.contact.id, name: r.contact.name, company: r.contact.company }));
        setRoster({ kind: 'ready', candidates, unconfirmed: open.length - confirmed.length, total: res.total, listed: res.rows.length });
      })
      .catch((err) => {
        if (cancelled) return;
        setRoster({ kind: 'error' });
        setLoadError(err instanceof ApiError ? err.message : 'The roster could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, holderIds]);

  const shown = useMemo(() => {
    if (roster.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    if (q === '') return roster.candidates;
    return roster.candidates.filter((c) => c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q));
  }, [roster, query]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chosen.size === 0) {
      setError('Choose at least one person.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/tasks/${taskId}/assign`, { contactIds: [...chosen] });
      props.onAdded(chosen.size);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields?.contactIds ?? err.message) : 'Adding people failed');
      setSaving(false);
    }
  }

  function toggle(contactId: string, on: boolean) {
    setChosen((current) => {
      const next = new Set(current);
      if (on) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
  }

  return (
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="Add people"
      subtitle={`Give ${props.taskTitle} to people by name. Portals keep giving it to everyone they cover.`}
      onClose={props.onClose}
      closeDisabled={saving}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving || roster.kind !== 'ready' || roster.candidates.length === 0}>
            {saving ? 'Adding…' : chosen.size > 0 ? `Add ${countOf(chosen.size, 'person', 'people')}` : 'Add people'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={props.onClose} disabled={saving}>
            Cancel
          </button>
        </>
      }
    >
      {error ? (
        <div className="chq-error" role="alert">
          {error}
        </div>
      ) : null}
      {roster.kind === 'loading' ? <DelayedLoading label="Loading the roster…" /> : null}
      {loadError ? (
        <div className="chq-error" role="alert">
          {loadError}
        </div>
      ) : null}
      {roster.kind === 'ready' && roster.candidates.length === 0 && roster.unconfirmed === 0 ? (
        <p className="chq-meta">Everyone on the roster already has this task.</p>
      ) : null}
      {roster.kind === 'ready' && roster.candidates.length > 0 ? (
        <div className="chq-speakers-modal-field">
          <label className="chq-speakers-modal-label" htmlFor="add-people-find">
            Find a person
          </label>
          <input
            id="add-people-find"
            className="chq-input"
            type="search"
            maxLength={MAX_NAME_LENGTH}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or company"
          />
          <div className="chq-speakers-audience-list" role="group" aria-label="People on the roster">
            {shown.map((c) => (
              <label key={c.contactId} className="chq-check-label">
                <input
                  className="chq-check"
                  type="checkbox"
                  checked={chosen.has(c.contactId)}
                  onChange={(e) => toggle(c.contactId, e.target.checked)}
                />
                {c.company ? `${c.name} · ${c.company}` : c.name}
              </label>
            ))}
            {shown.length === 0 ? <p className="chq-meta">Nobody matches &ldquo;{query.trim()}&rdquo;.</p> : null}
          </div>
          {roster.total > roster.listed ? (
            <p className="chq-meta">
              Listing the first {roster.listed} of {roster.total} people on the roster. Anyone else can be given this task from
              their record (Give an item).
            </p>
          ) : null}
        </div>
      ) : null}
      {roster.kind === 'ready' && roster.unconfirmed > 0 ? (
        <p className="chq-meta">
          Not listed: {countOf(roster.unconfirmed, 'person', 'people')} who {plural(roster.unconfirmed, 'hasn’t', 'haven’t')}{' '}
          confirmed yet. They can be added once they do.
        </p>
      ) : null}
    </ModalFrame>
  );
}
