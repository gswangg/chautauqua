// Event switcher + 'New event…' modal (w6-c, DEC-046; restyled w3-d, DEC-378/
// 379). Nav-mounted: lists GET /api/v1/events (shape at
// src/routes/api/events.ts:118), shows the current event by
// 'chq.currentEventId' (falling back to items[0], mirroring
// useCurrentEvent.ts), switching writes that key and reloads /admin. 'New
// event…' opens a modal posting POST /api/v1/events; server field errors
// (error.fields) are shown per-field per DEC-013's ApiError contract.

import { useEffect, useState, type FormEvent } from 'react';
import { apiList, apiPost, ApiError } from '../lib/api';
import { useEscapeKey } from '../lib/useEscapeKey';
import { useMe } from '../lib/useMe';
import {
  buildNewEventPayload,
  mergeFieldErrors,
  resolveCurrentEvent,
  validateNewEventForm,
  type NewEventForm,
  type NewEventFormErrors,
} from './eventSwitcherState';
import './event-switcher.css';

const STORAGE_KEY = 'chq.currentEventId';

interface EventListItem {
  id: string;
  name: string;
}

const EMPTY_FORM: NewEventForm = {
  name: '',
  slug: '',
  startDate: '',
  endDate: '',
  timezone: '',
  location: '',
};

function NewEventModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<NewEventForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<NewEventFormErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEscapeKey(!pending, onCancel);

  function setField<K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const localErrors = validateNewEventForm(form);
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setPending(true);
    setBanner(null);
    setErrors({});
    try {
      const created = await apiPost<{ id: string }>('/events', buildNewEventPayload(form));
      onCreated(created.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mergeFieldErrors({}, err.fields));
        setBanner(err.message);
      } else {
        setBanner('Failed to create event');
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="chq-scrim">
      <form className="chq-modal" role="dialog" aria-modal="true" aria-label="New event" onSubmit={submit}>
        <h2 className="chq-modal-title">New event</h2>
        {banner && <div className="chq-error-banner">{banner}</div>}

        <label className="chq-field">
          Name
          <input
            className="chq-input"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
          />
          {errors.name && <span className="chq-field-error">{errors.name}</span>}
        </label>
        <label className="chq-field">
          Slug
          <input
            className="chq-input"
            value={form.slug}
            onChange={(e) => setField('slug', e.target.value)}
            required
          />
          {errors.slug && <span className="chq-field-error">{errors.slug}</span>}
        </label>
        <label className="chq-field">
          Start date
          <input
            className="chq-input"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
            required
          />
          {errors.startDate && <span className="chq-field-error">{errors.startDate}</span>}
        </label>
        <label className="chq-field">
          End date
          <input
            className="chq-input"
            type="date"
            value={form.endDate}
            onChange={(e) => setField('endDate', e.target.value)}
            required
          />
          {errors.endDate && <span className="chq-field-error">{errors.endDate}</span>}
        </label>
        <label className="chq-field">
          Timezone
          <input
            className="chq-input"
            value={form.timezone}
            onChange={(e) => setField('timezone', e.target.value)}
            placeholder="America/Chicago"
            required
          />
          {errors.timezone && <span className="chq-field-error">{errors.timezone}</span>}
        </label>
        <label className="chq-field">
          Location (optional)
          <input className="chq-input" value={form.location} onChange={(e) => setField('location', e.target.value)} />
          {errors.location && <span className="chq-field-error">{errors.location}</span>}
        </label>

        <div className="chq-modal-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={pending}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

export function EventSwitcher() {
  const { me } = useMe();
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    apiList<EventListItem>('/events')
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load events'));
  }, []);

  const storedId = window.localStorage.getItem(STORAGE_KEY);
  const current = resolveCurrentEvent(items, storedId);
  const closeMenu = () => setMenuOpen(false);
  useEscapeKey(menuOpen, closeMenu);

  function switchTo(id: string) {
    closeMenu();
    if (id === current?.id) return;
    window.localStorage.setItem(STORAGE_KEY, id);
    window.location.assign('/admin');
  }

  function handleCreated(id: string) {
    window.localStorage.setItem(STORAGE_KEY, id);
    setShowNewEvent(false);
    window.location.assign('/admin/settings');
  }

  return (
    <div className="chq-eventswitcher">
      {error && <span className="chq-field-error">{error}</span>}
      {/* DEC-576: desktop header shows the current event as plain text
          (13px/600) beside a menu button, not the raw <select> this used
          to render — switching/create behaviour is unchanged, only the
          control. */}
      <span className="chq-eventswitcher-name">{current?.name ?? 'No events'}</span>
      <button
        type="button"
        className="chq-eventswitcher-menu-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Switch event"
        onClick={() => setMenuOpen((v) => !v)}
      >
        ▾
      </button>

      {menuOpen && (
        <div className="chq-eventswitcher-menu" role="menu" aria-label="Events">
          {items.length === 0 && <span className="chq-meta">No events</span>}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`chq-eventswitcher-menu-item${item.id === current?.id ? ' is-current' : ''}`}
              onClick={() => switchTo(item.id)}
            >
              {item.name}
            </button>
          ))}
          {/* DEC-608: creating an event is organizer-only server-side
              (POST /api/v1/events would 403 for any other role) -- a
              reviewer must never see a control whose only outcome is a
              rejected request. */}
          {me?.role === 'organizer' && (
            <button
              type="button"
              role="menuitem"
              className="chq-eventswitcher-menu-item"
              onClick={() => {
                closeMenu();
                setShowNewEvent(true);
              }}
            >
              New event…
            </button>
          )}
        </div>
      )}

      {showNewEvent && <NewEventModal onCancel={() => setShowNewEvent(false)} onCreated={handleCreated} />}
    </div>
  );
}
