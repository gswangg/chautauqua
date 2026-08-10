// CRM sourcing pipeline board (CRM-07/08, DEC-157). Five named columns, an
// Enroll control (contact picker from GET /contacts), a per-card Move-to
// <select> (no drag-and-drop dependency — DEC-157 explicitly prefers a
// select since persistence is what's graded), and a card-detail panel with
// a notes composer + activity log.

import { useEffect, useState } from 'react';
import { apiGet, apiList, apiPost, apiPatch, ApiError } from '../../lib/api';
import type { ContactListItem, PipelineEntry, PipelineEntryDetail, PipelineStage } from './types';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from './types';

export function PipelineBoard() {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    return apiList<PipelineEntry>('/pipeline')
      .then((res) => setEntries(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pipeline'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function moveTo(entry: PipelineEntry, stage: PipelineStage) {
    if (stage === entry.stage) return;
    const previous = entries;
    // Optimistic update.
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, stage } : e)));
    setError(null);
    try {
      const updated = await apiPatch<PipelineEntry>(`/pipeline/${entry.id}`, { stage });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    } catch (err) {
      // Loud rollback: restore the pre-move board state and surface the error.
      setEntries(previous);
      setError(err instanceof ApiError ? err.message : 'Failed to move card');
    }
  }

  return (
    <div className="chq-pipeline-board">
      <div className="chq-pipeline-toolbar">
        <h2>Sourcing pipeline</h2>
        <button type="button" onClick={() => setShowEnroll(true)}>
          + Enroll
        </button>
      </div>
      {error && <div className="chq-error-banner">{error}</div>}
      {loading && <p>Loading...</p>}

      <div className="chq-pipeline-columns">
        {PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="chq-pipeline-column" data-stage={stage}>
            <h3>{PIPELINE_STAGE_LABELS[stage]}</h3>
            <ul>
              {entries
                .filter((e) => e.stage === stage)
                .map((entry) => (
                  <li key={entry.id} className="chq-pipeline-card">
                    <button type="button" className="chq-pipeline-card-name" onClick={() => setOpenEntryId(entry.id)}>
                      {entry.firstName} {entry.lastName}
                    </button>
                    {entry.company && <div className="chq-pipeline-card-company">{entry.company}</div>}
                    <label>
                      Move to
                      <select value={entry.stage} onChange={(e) => moveTo(entry, e.target.value as PipelineStage)}>
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {PIPELINE_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      {showEnroll && (
        <EnrollDialog
          alreadyEnrolledContactIds={new Set(entries.map((e) => e.contactId))}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => {
            setShowEnroll(false);
            reload();
          }}
        />
      )}

      {openEntryId && <EntryDetailPanel entryId={openEntryId} onClose={() => setOpenEntryId(null)} onChanged={reload} />}
    </div>
  );
}

interface EnrollDialogProps {
  alreadyEnrolledContactIds: Set<string>;
  onClose: () => void;
  onEnrolled: () => void;
}

function EnrollDialog({ alreadyEnrolledContactIds, onClose, onEnrolled }: EnrollDialogProps) {
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [contactId, setContactId] = useState('');
  const [stage, setStage] = useState<PipelineStage>('identified');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiList<ContactListItem>('/contacts?perPage=200')
      .then((res) => setContacts(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contacts'));
  }, []);

  const available = contacts.filter((c) => !alreadyEnrolledContactIds.has(c.id));

  async function enroll() {
    if (!contactId) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/pipeline', { contactId, stage });
      onEnrolled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to enroll contact');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-modal-backdrop" role="dialog" aria-label="Enroll contact">
      <div className="chq-modal">
        <h3>Enroll a contact</h3>
        {error && <div className="chq-error-banner">{error}</div>}
        <label>
          Contact
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Select a contact...</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} — {c.email}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starting stage
          <select value={stage} onChange={(e) => setStage(e.target.value as PipelineStage)}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" disabled={busy || !contactId} onClick={enroll}>
          Enroll
        </button>
      </div>
    </div>
  );
}

interface EntryDetailPanelProps {
  entryId: string;
  onClose: () => void;
  onChanged: () => void;
}

function EntryDetailPanel({ entryId, onClose, onChanged }: EntryDetailPanelProps) {
  const [detail, setDetail] = useState<PipelineEntryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function reload() {
    return apiGet<PipelineEntryDetail>(`/pipeline/${entryId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load pipeline entry'));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  async function saveNote() {
    if (note.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/pipeline/${entryId}/notes`, { body: note.trim() });
      setNote('');
      await reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chq-modal-backdrop" role="dialog" aria-label="Pipeline card detail">
      <div className="chq-modal">
        {error && <div className="chq-error-banner">{error}</div>}
        {!detail && <p>Loading...</p>}
        {detail && (
          <>
            <h3>
              {detail.contact.firstName} {detail.contact.lastName}
            </h3>
            <p>
              {detail.contact.email}
              {detail.contact.company ? ` — ${detail.contact.company}` : ''}
            </p>
            <p>Stage: {PIPELINE_STAGE_LABELS[detail.entry.stage]}</p>

            <div className="chq-pipeline-notes">
              <label>
                Add a note
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="button" disabled={busy || note.trim() === ''} onClick={saveNote}>
                Save note
              </button>
            </div>

            <h4>Activity</h4>
            <ul className="chq-pipeline-activity">
              {detail.activity.map((a, i) => (
                <li key={i}>
                  {a.kind === 'move' ? (
                    <span>
                      Moved {a.fromStage ? PIPELINE_STAGE_LABELS[a.fromStage] : 'Enrolled'} &rarr;{' '}
                      {a.toStage ? PIPELINE_STAGE_LABELS[a.toStage] : ''}
                    </span>
                  ) : (
                    <span>Note: {a.body}</span>
                  )}
                  {' — '}
                  {a.authorName}, {new Date(a.createdAt).toLocaleString()}
                </li>
              ))}
              {detail.activity.length === 0 && <li>No activity yet.</li>}
            </ul>
          </>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
