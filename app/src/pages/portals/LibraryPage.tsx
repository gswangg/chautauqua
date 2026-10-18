// Settings · Portals › Libraries (Portals frame, flow 2 note): every item in
// the event's library, by type -- what it is about, its instructions, file
// limits, the portals that list it, and whether it is also assigned
// directly on Speakers. Tasks, forms, file requests and share kits are
// edited here (the change reaches every portal that lists them); a
// resource is shown to everyone, or only through the portals that list it.
// Deadlines, required and grace are a portal's, set in its editor.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { PageSkeleton } from '../../components/PageSkeleton';
import { apiPatch, ApiError } from '../../lib/api';
import { countOf } from '../../lib/plural';
import { useCachedGet } from '../../lib/useCachedRead';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { limitSentence } from '../../../../src/domain/portals/file-types';
import { LIBRARY_TABS } from './AddFromLibraryModal';
import { EditLibraryItemModal } from './EditLibraryItemModal';
import { NewLibraryItemModal } from './NewLibraryItemModal';
import { SettingsSubPage } from './SettingsSubPage';
import { libraryEntryKey } from './portalDraft';
import type { LibraryEntry, LibraryListing } from './types';
import './portal-editor.css';
import './library.css';

const BACK = { label: 'Portals', to: '/settings/portals' };
const SUMMARY_CHARS = 160;

type Visibility = 'everyone' | 'portal';

function summary(text: string | null): string | null {
  if (!text || text.trim() === '') return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > SUMMARY_CHARS ? `${flat.slice(0, SUMMARY_CHARS - 1).trimEnd()}…` : flat;
}

function visibilityOf(entry: LibraryEntry): Visibility {
  return entry.visibility ?? 'everyone';
}

function isTask(entry: LibraryEntry): entry is LibraryEntry & { ref: { taskId: string } } {
  return 'taskId' in entry.ref;
}

function isResource(entry: LibraryEntry): entry is LibraryEntry & { ref: { resourceId: string } } {
  return 'resourceId' in entry.ref;
}

export function LibraryPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const libraryPath = useMemo(() => (eventId ? `/events/${eventId}/library` : null), [eventId]);
  const { data, loading, error } = useCachedGet<LibraryListing>(libraryPath, 'The library could not be loaded.');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<(LibraryEntry & { ref: { taskId: string } }) | null>(null);
  const [pendingVisibility, setPendingVisibility] = useState<Record<string, Visibility>>({});
  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // a visibility change shows at once; the refetched listing confirms it
  useEffect(() => {
    if (!data) return;
    setPendingVisibility((prev) => {
      const next = { ...prev };
      for (const e of data.entries) if (isResource(e) && next[libraryEntryKey(e)] === visibilityOf(e)) delete next[libraryEntryKey(e)];
      return next;
    });
  }, [data]);

  async function setVisibility(entry: LibraryEntry & { ref: { resourceId: string } }, visibility: Visibility) {
    if (!eventId) return;
    const key = libraryEntryKey(entry);
    setRowError(null);
    setPendingVisibility((prev) => ({ ...prev, [key]: visibility }));
    try {
      await apiPatch(`/events/${eventId}/library/resources/${entry.ref.resourceId}`, { visibility });
    } catch (err) {
      setPendingVisibility((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setRowError({ key, message: err instanceof ApiError ? err.message : 'The change could not be saved.' });
    }
  }

  const newButton = (
    <button type="button" className="chq-btn chq-btn-primary" onClick={() => setCreating(true)} disabled={!data}>
      New item
    </button>
  );

  if (eventLoading || (loading && !data && !error)) {
    return (
      <SettingsSubPage sectionKey="portal" back={BACK} title="Libraries">
        <PageSkeleton variant="list" label="Loading the library…" />
      </SettingsSubPage>
    );
  }

  if (eventError || !eventId || (error && !data)) {
    return (
      <SettingsSubPage sectionKey="portal" back={BACK} title="Libraries">
        <p className="chq-error" role="alert">
          {eventError ?? error ?? 'No event selected.'}
        </p>
      </SettingsSubPage>
    );
  }

  if (!data) return null;
  const groups = LIBRARY_TABS.map((t) => ({ ...t, entries: data.entries.filter((e) => e.type === t.type) })).filter((g) => g.entries.length > 0);

  return (
    <SettingsSubPage
      sectionKey="portal"
      back={BACK}
      title="Libraries"
      subtitle="Items portals can give. Deadlines, required and grace are set per portal, in its editor."
      actions={newButton}
    >
      <div className="chq-library">
        {error ? (
          <p className="chq-error" role="alert">
            {error}
          </p>
        ) : null}
        {groups.length === 0 ? (
          <EmptyState variant="fresh" what="The library is empty." action={{ label: 'New item', onClick: () => setCreating(true) }} />
        ) : null}
        {groups.map((g) => (
          <section key={g.type} className="chq-portal-section" aria-labelledby={`library-${g.type}`}>
            <div className="chq-section-head">
              <span className="chq-section-label" id={`library-${g.type}`}>
                {g.label} · {g.entries.length}
              </span>
            </div>
            <ul className="chq-library-list">
              {g.entries.map((entry) => {
                const key = libraryEntryKey(entry);
                const text = summary(entry.instructions);
                const vis = pendingVisibility[key] ?? visibilityOf(entry);
                return (
                  <li key={key} className="chq-library-row">
                    <div className="chq-library-main">
                      <span className="chq-library-title">
                        {entry.title}
                        {entry.direct && entry.type !== 'resource' ? <span className="chq-library-tag">Assigned directly</span> : null}
                      </span>
                      <span className="chq-library-meta">
                        {entry.type === 'built_in'
                          ? entry.hint
                          : entry.type === 'resource'
                            ? 'A page participants read'
                            : entry.scope === 'participation'
                              ? 'About the session or company'
                              : 'About the person'}
                        {entry.type === 'file_request' ? ` · ${limitSentence(entry.acceptedTypes, entry.maxSizeMb)}${(entry.maxFiles ?? 1) > 1 ? `, ${countOf(entry.maxFiles ?? 1, 'file')}` : ''}` : ''}
                      </span>
                      {text ? <span className="chq-library-text">{text}</span> : null}
                      <span className="chq-library-used">
                        {entry.usedBy.length === 0 ? (
                          'In no portal yet'
                        ) : (
                          <>
                            Used by{' '}
                            {entry.usedBy.map((p, i) => (
                              <span key={p.id}>
                                {i > 0 ? ', ' : ''}
                                <Link className="chq-library-portal" to={`/settings/portals/${p.id}`}>
                                  {p.name}
                                </Link>
                              </span>
                            ))}
                          </>
                        )}
                      </span>
                      {rowError?.key === key ? (
                        <span className="chq-error" role="alert">
                          {rowError.message}
                        </span>
                      ) : null}
                    </div>
                    <div className="chq-library-side">
                      {isTask(entry) ? (
                        <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setEditing(entry)} aria-label={`Edit ${entry.title}`}>
                          Edit
                        </button>
                      ) : null}
                      {isResource(entry) ? (
                        <span className="chq-portal-seg chq-library-visibility" role="group" aria-label={`Who sees ${entry.title}`}>
                          <button type="button" className="chq-portal-seg-btn" aria-pressed={vis === 'everyone'} onClick={() => void setVisibility(entry, 'everyone')}>
                            Everyone
                          </button>
                          <button type="button" className="chq-portal-seg-btn" aria-pressed={vis === 'portal'} onClick={() => void setVisibility(entry, 'portal')}>
                            Only portals that list it
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {creating ? (
        <NewLibraryItemModal
          eventId={eventId}
          mode="library"
          onCreated={(item) => setToast(`${item.title} added to the library`)}
          onClose={() => setCreating(false)}
        />
      ) : null}

      {editing ? (
        <EditLibraryItemModal
          eventId={eventId}
          entry={editing}
          onSaved={(title) => {
            setEditing(null);
            setToast(`${title} saved`);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {toast ? (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
    </SettingsSubPage>
  );
}
