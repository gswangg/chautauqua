// Event switcher + 'New event…' modal (w6-c, DEC-046; restyled w3-d, DEC-378/
// 379). Nav-mounted: lists GET /api/v1/events (shape at
// src/routes/api/events.ts:118), shows the current event by
// 'chq.currentEventId' (falling back to items[0], mirroring
// useCurrentEvent.ts), switching writes that key and reloads /admin. 'New
// event…' opens a modal posting POST /api/v1/events; server field errors
// (error.fields) are shown per-field per DEC-013's ApiError contract.

import { useEffect, useState, type FormEvent } from 'react';
import { apiPost, ApiError } from '../lib/api';
import { loadEventsOnce, type EventListItem } from '../lib/useCurrentEvent';
import { useMenu } from '../lib/useMenu';
import { useMe } from '../lib/useMe';
import { DateField } from './DateField';
import { FormRow, FormRowPair, ModalFrame } from './ModalFrame';
import {
  buildNewEventPayload,
  mergeFieldErrors,
  resolveCurrentEvent,
  validateNewEventForm,
  defaultTimezone,
  type NewEventForm,
  type NewEventFormErrors,
} from './eventSwitcherState';
import { MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '../lib/text-caps';
import './event-switcher.css';

const STORAGE_KEY = 'chq.currentEventId';

// Post-eval polish: Time zone is `required` and now opens with the
// browser's own zone rather than an empty field wearing a placeholder that
// reads as a default -- so the native "Please fill out this field" bubble
// can no longer fire on a field that looks answered. Built per-open (not a
// module const) so the value is resolved when the modal mounts.
function newEventForm(): NewEventForm {
  return {
    name: '',
    slug: '',
    startDate: '',
    endDate: '',
    timezone: defaultTimezone(),
    location: '',
  };
}

function NewEventModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<NewEventForm>(newEventForm);
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
    <ModalFrame
      as="form"
      onSubmit={submit}
      title="New event"
      subtitle="You land in its settings afterwards"
      onClose={onCancel}
      closeDisabled={pending}
      actions={
        <>
          <button type="submit" className="chq-btn chq-btn-primary chq-eventswitcher-create-btn" disabled={pending}>
            Create the event
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </>
      }
    >
      {banner && <div className="chq-error-banner">{banner}</div>}

      <FormRow label="Name" htmlFor="new-event-name" error={errors.name}>
        <input
          id="new-event-name"
          className="chq-input"
          maxLength={MAX_NAME_LENGTH}
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="DevFlow Conf 2028"
          required
        />
      </FormRow>
      <FormRow label="Slug" htmlFor="new-event-slug" error={errors.slug}>
        <input
          id="new-event-slug"
          className="chq-input"
          maxLength={MAX_NAME_LENGTH}
          value={form.slug}
          onChange={(e) => setField('slug', e.target.value)}
          placeholder="devflow-conf-2028"
          required
        />
      </FormRow>
      {/* Per the mock: STARTS / ENDS / TIME ZONE / VENUE (eval-findings 25).
          DEC-897: Starts/Ends is ONE range row -- the paired geometry is
          what makes close-before-open validation legible. */}
      <FormRowPair>
        <FormRow label="Starts" htmlFor="new-event-start" error={errors.startDate}>
          <DateField
            id="new-event-start"
            value={form.startDate}
            onChange={(next) => setField('startDate', next)}
            required
          />
        </FormRow>
        <FormRow label="Ends" htmlFor="new-event-end" error={errors.endDate}>
          {/* DEC-370 amendment (wave 5): the Ends placeholder is a distinct
              date from Starts' "11 May 2028" -- a matching pair reads as a
              copy-paste default rather than an example. */}
          <DateField
            id="new-event-end"
            value={form.endDate}
            onChange={(next) => setField('endDate', next)}
            placeholder="13 May 2028"
            required
          />
        </FormRow>
      </FormRowPair>
      <FormRow label="Time zone" htmlFor="new-event-timezone" error={errors.timezone}>
        <input
          id="new-event-timezone"
          className="chq-input"
          maxLength={MAX_NAME_LENGTH}
          value={form.timezone}
          onChange={(e) => setField('timezone', e.target.value)}
          placeholder="America/Chicago"
          required
        />
      </FormRow>
      {/* DEC-370 amendment (wave 5): "Venue" drops the ' · optional' suffix
          and the "Optional" placeholder -- the field is already skippable
          (no `required`); a bare descriptive placeholder never restates
          that fact a second way. */}
      <FormRow label="Venue" htmlFor="new-event-location" error={errors.location}>
        <input
          id="new-event-location"
          className="chq-input"
          maxLength={MAX_TEXT_LENGTH}
          value={form.location}
          onChange={(e) => setField('location', e.target.value)}
          placeholder="Ferry Building, San Francisco"
        />
      </FormRow>
    </ModalFrame>
  );
}

export function EventSwitcher() {
  const { me, loading } = useMe();
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // DEC-978: GET /api/v1/events is requireOrganizer server-side -- a gate
    // must not act while identity is still loading, and a reviewer session
    // must never issue this request at all (it would 403 on first paint).
    if (loading || me?.role !== 'organizer') return;
    // DEC-856: clear at the start of the read that can replace it.
    setError(null);
    // DEC-024 amendment (wave 51): the shared cache means the page pays
    // one /events round trip even when useCurrentEvent is also mounted.
    loadEventsOnce()
      .then((items) => setItems(items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load events'));
  }, [me, loading]);

  const storedId = window.localStorage.getItem(STORAGE_KEY);
  const current = resolveCurrentEvent(items, storedId);
  const closeMenu = () => setMenuOpen(false);
  const { containerRef, onPanelKeyDown } = useMenu(menuOpen, closeMenu);

  // DEC-978: a reviewer is confined to /review (App.tsx) and has no event
  // to switch -- the control's only action (switching/creating events) is
  // impossible for that role, so it should not exist, mirroring the
  // conditional-and-quiet rule already applied to 'New event…' above.
  if (!loading && me?.role !== 'organizer') return null;

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
    <div className="chq-eventswitcher" ref={containerRef}>
      {error && <span className="chq-field-error">{error}</span>}
      {/* DEC-576: desktop header shows the current event as plain text
          (13px/600) beside a menu button, not the raw <select> this used
          to render — switching/create behaviour is unchanged, only the
          control. */}
      {/* w6-h (DEC-369 amendment): the focusable control is the name+caret
          GROUP, not a bare 24x23 button around the caret glyph alone -- a
          focus ring on the glyph-only button read as stray ink around no
          visible control. One button, >=44px tall, carries the whole
          group so the ring frames what a sighted user sees as "the
          control". Open/close/select behaviour (menuOpen, switchTo) is
          unchanged; only what's focusable/clickable moved. */}
      <button
        type="button"
        className="chq-eventswitcher-menu-btn"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Switch event"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span className="chq-eventswitcher-name">{current?.name ?? 'No events'}</span>
        <span className="chq-eventswitcher-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {menuOpen && (
        <div className="chq-eventswitcher-menu" role="menu" aria-label="Events" onKeyDown={onPanelKeyDown}>
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
