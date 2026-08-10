// Event switcher + 'New event…' modal (w6-c, DEC-046). Nav-mounted: lists
// GET /api/v1/events (shape at src/routes/api/events.ts:118), shows the
// current event by 'chq.currentEventId' (falling back to items[0], mirroring
// useCurrentEvent.ts), switching writes that key and reloads /admin. 'New
// event…' opens a modal posting POST /api/v1/events; server field errors
// (error.fields) are shown per-field per DEC-013's ApiError contract.

import { useEffect, useState, type FormEvent } from 'react';
import { apiList, apiPost, ApiError } from '../lib/api';
import {
  buildNewEventPayload,
  mergeFieldErrors,
  resolveCurrentEvent,
  validateNewEventForm,
  type NewEventForm,
  type NewEventFormErrors,
} from './eventSwitcherState';

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
    <div className="chq-modal-overlay" role="dialog" aria-modal="true" aria-label="New event">
      <form className="chq-modal" onSubmit={submit}>
        <h2>New event</h2>
        {banner && <div className="chq-error-banner">{banner}</div>}

        <label>
          Name
          <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
          {errors.name && <span className="chq-field-error">{errors.name}</span>}
        </label>
        <label>
          Slug
          <input value={form.slug} onChange={(e) => setField('slug', e.target.value)} required />
          {errors.slug && <span className="chq-field-error">{errors.slug}</span>}
        </label>
        <label>
          Start date
          <input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} required />
          {errors.startDate && <span className="chq-field-error">{errors.startDate}</span>}
        </label>
        <label>
          End date
          <input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} required />
          {errors.endDate && <span className="chq-field-error">{errors.endDate}</span>}
        </label>
        <label>
          Timezone
          <input
            value={form.timezone}
            onChange={(e) => setField('timezone', e.target.value)}
            placeholder="America/Chicago"
            required
          />
          {errors.timezone && <span className="chq-field-error">{errors.timezone}</span>}
        </label>
        <label>
          Location (optional)
          <input value={form.location} onChange={(e) => setField('location', e.target.value)} />
          {errors.location && <span className="chq-field-error">{errors.location}</span>}
        </label>

        <div className="chq-modal-actions">
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" disabled={pending}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

export function EventSwitcher() {
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);

  useEffect(() => {
    apiList<EventListItem>('/events')
      .then((res) => setItems(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load events'));
  }, []);

  const storedId = window.localStorage.getItem(STORAGE_KEY);
  const current = resolveCurrentEvent(items, storedId);

  function switchTo(id: string) {
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
    <div className="chq-event-switcher">
      {error && <span className="chq-field-error">{error}</span>}
      <select
        aria-label="Current event"
        value={current?.id ?? ''}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setShowNewEvent(true);
            return;
          }
          switchTo(e.target.value);
        }}
      >
        {items.length === 0 && <option value="">No events</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        <option value="__new__">New event…</option>
      </select>

      {showNewEvent && <NewEventModal onCancel={() => setShowNewEvent(false)} onCreated={handleCreated} />}
    </div>
  );
}
