// Add from the library (Portals frame, flow 2, e2-x7): the event's library
// by type, searchable. Items already in this portal are checked and stay
// checked; the button counts only the new ones. "New item" saves a new
// library item and adds it too. Nothing is saved to the portal until the
// editor's Review and save.
import { useRef, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { EmptyState } from '../../components/EmptyState';
import { ModalFrame } from '../../components/ModalFrame';
import { useCachedGet } from '../../lib/useCachedRead';
import { MAX_LIBRARY_TITLE } from '../../lib/domain-caps';
import { countOf } from '../../lib/plural';
import { NewLibraryItemModal, type CreatedLibraryItem } from './NewLibraryItemModal';
import { draftItemFromLibrary, libraryEntryKey, type DraftItem } from './portalDraft';
import type { LibraryEntry, LibraryListing } from './types';

export type LibraryTab = LibraryEntry['type'];

export const LIBRARY_TABS: { type: LibraryTab; label: string }[] = [
  { type: 'task', label: 'Tasks' },
  { type: 'form', label: 'Forms' },
  { type: 'file_request', label: 'File requests' },
  { type: 'share_kit', label: 'Share kits' },
  { type: 'resource', label: 'Resources' },
  { type: 'built_in', label: 'Built in' },
];

/** A just-created library item as a draft item for this portal. */
export function draftItemFromCreated(item: CreatedLibraryItem): DraftItem {
  return draftItemFromLibrary({
    ref: item.taskId ? { taskId: item.taskId } : { resourceId: item.resourceId ?? '' },
    type: item.type,
    title: item.title,
    scope: item.scope,
    instructions: null,
    formId: item.formId,
    acceptedTypes: null,
    maxSizeMb: null,
    maxFiles: null,
    usedBy: [],
    direct: false,
    hint: '',
  });
}

interface AddFromLibraryModalProps {
  eventId: string;
  portalName: string;
  inPortal: ReadonlySet<string>;
  onAdd: (items: DraftItem[]) => void;
  onClose: () => void;
}

export function AddFromLibraryModal({ eventId, portalName, inPortal, onAdd, onClose }: AddFromLibraryModalProps) {
  const { data, loading, error } = useCachedGet<LibraryListing>(`/events/${eventId}/library`, 'The library could not be loaded.');
  const [tab, setTab] = useState<LibraryTab | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  // set once a new item is saved: closing the new-item dialog then closes this one too
  const created = useRef(false);

  const entries = data?.entries ?? [];
  const q = query.trim().toLowerCase();
  const matching = q === '' ? entries : entries.filter((e) => e.title.toLowerCase().includes(q));
  // a type with nothing in the library offers no tab
  const tabs = LIBRARY_TABS.filter((t) => entries.some((e) => e.type === t.type));
  const current = tab && tabs.some((t) => t.type === tab) ? tab : (tabs[0]?.type ?? 'task');
  const rows = matching.filter((e) => e.type === current);
  const pickedEntries = entries.filter((e) => picked.has(libraryEntryKey(e)));

  function toggle(key: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (creating) {
    return (
      <NewLibraryItemModal
        eventId={eventId}
        mode="portal"
        portalName={portalName}
        onCreated={(item) => {
          created.current = true;
          onAdd([...pickedEntries.map(draftItemFromLibrary), draftItemFromCreated(item)]);
        }}
        onClose={() => (created.current ? onClose() : setCreating(false))}
      />
    );
  }

  return (
    <ModalFrame
      title="Add items"
      subtitle={portalName}
      onClose={onClose}
      modalClassName="chq-portal-modal chq-portal-library-modal"
      actions={
        <>
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            disabled={picked.size === 0}
            onClick={() => {
              onAdd(pickedEntries.map(draftItemFromLibrary));
              onClose();
            }}
          >
            {picked.size === 0 ? 'Add items' : `Add ${countOf(picked.size, 'item')}`}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <div className="chq-portal-library-body">
        <input
          className="chq-input chq-portal-library-search"
          type="search"
          aria-label="Search the library"
          placeholder="Search the library…"
          value={query}
          maxLength={MAX_LIBRARY_TITLE}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && !data ? <DelayedLoading label="Loading the library…" /> : null}
        {error ? (
          <p className="chq-error" role="alert">
            {error}
          </p>
        ) : null}
        {data ? (
          <>
            <div className="chq-portal-tabs" role="tablist" aria-label="Library type">
              {tabs.map((t) => {
                const n = matching.filter((e) => e.type === t.type).length;
                return (
                  <button
                    key={t.type}
                    type="button"
                    role="tab"
                    aria-selected={current === t.type}
                    className="chq-portal-tab"
                    onClick={() => setTab(t.type)}
                  >
                    {q === '' ? t.label : `${t.label} · ${n}`}
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" aria-label={tabs.find((t) => t.type === current)?.label ?? 'Library'}>
              {rows.length === 0 ? (
                q !== '' ? (
                  <EmptyState variant="filtered" what="Nothing here matches." reason={`No ${tabs.find((t) => t.type === current)?.label.toLowerCase() ?? 'items'} match “${query.trim()}”.`} escape={{ label: 'Clear the search', onClick: () => setQuery('') }} />
                ) : (
                  <EmptyState variant="fresh" what="The library is empty." action={{ label: 'New item', onClick: () => setCreating(true) }} />
                )
              ) : (
                <ul className="chq-portal-library-list">
                  {rows.map((entry) => {
                    const key = libraryEntryKey(entry);
                    const already = inPortal.has(key);
                    const scopeWord = entry.scope === 'participation' ? 'Participation' : 'Person';
                    return (
                      <li key={key} className="chq-portal-library-row">
                        <label className="chq-checkbox-label chq-portal-library-option">
                          <input
                            type="checkbox"
                            className="chq-check"
                            checked={already || picked.has(key)}
                            disabled={already}
                            onChange={() => toggle(key)}
                          />
                          <span className="chq-portal-library-text">
                            <span className="chq-portal-library-title">{entry.title}</span>
                            <span className="chq-portal-library-sub">{already ? `${scopeWord} · in this portal` : entry.hint}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button type="button" className="chq-link-button chq-portal-library-new" onClick={() => setCreating(true)}>
              New item
            </button>
          </>
        ) : null}
      </div>
    </ModalFrame>
  );
}
