// Tracks & rooms panel (w4-h, DEC-032; summary-first w3-c, DEC-747): read
// view is two columns -- tracks with their submission counts, rooms with
// their capacities (docs/design/Chautauqua Settings.dc.html:103-126) --
// with 'Add' as the section's one drill action (SummarySection, DEC-728)
// into the existing add/rename/delete form. Endpoints unchanged:
// GET/POST /events/:id/tracks|rooms, PATCH/DELETE /tracks|rooms/:id.
//
// DEC-915: each existing row is a local DRAFT, not a live-wired input --
// typing writes nothing until an explicit Save; Cancel restores the loaded
// value; the drilled edit view carries a Done control back to the summary,
// matching EventSettingsPanel/ResourcesPanel/PeopleRolesPanel/ApiTokensPanel.
// DEC-916: submissionCount rides the tracks list response (one grouped
// server-side aggregate) -- no per-track follow-up request.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import {
  validateRoomForm,
  validateTrackForm,
  type RoomForm,
  type RoomFormErrors,
  type TrackForm,
  type TrackFormErrors,
} from './formState';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsFieldPair } from './SettingsEditForm';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { DEC_856, DEC_888 } from '../../../../src/decisions';
import { MAX_NAME_LENGTH } from '../../../../src/forms/validate';

// DEC-856 (wave 65 amendment): a refusal's fields map is read by SHAPE --
// name/color/capacity are the keys this panel's own controls own (the
// server's "Invalid track"/"Invalid room" vocabulary, src/routes/api/
// events.ts:416-536); any other key still renders, labelled "<key>:
// <message>", rather than being dropped or collapsed into err.message.
void DEC_856;
const TRACK_FIELD_KEYS: readonly string[] = ['name', 'color'];
const ROOM_FIELD_KEYS: readonly string[] = ['name', 'capacity'];

function unownedFieldEntries(
  errors: Record<string, string | undefined>,
  known: readonly string[],
): Array<[string, string]> {
  return Object.entries(errors).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !known.includes(entry[0]),
  );
}

// DEC-888: ONE enumeration supplies the swatch picker buttons, the new-
// track default (its first entry), and the .chq-color-swatch preview --
// so the palette a track can be given and the palette the picker offers
// can never desync. Colors drawn from the product palette, never an
// off-palette literal like the old raw <input type="color"> default.
// USER-FILED + frame 09--12 (v12): the redesigned track palette is the
// SYSTEM'S OWN tokens used categorically — the frame's three drawn swatches
// pixel-sample to exactly #4E5C31 / #1B1D17 / #8E8A7A (README §Colour rows
// Brand olive / Ink / the stone grey); two more README tokens extend the set
// for events with more tracks. Never a Tailwind stock colour, never a red.
export const TRACK_SWATCHES = [
  { value: '#4E5C31', label: 'Olive' },
  { value: '#1B1D17', label: 'Ink' },
  { value: '#8E8A7A', label: 'Stone' },
  { value: '#565A4B', label: 'Moss' },
  { value: '#BAB6A6', label: 'Sand' },
] as const;
void DEC_888;

// Cycle helpers for the swatch-as-control (frame 09--12): advance to the
// next palette entry; an unknown stored colour re-enters the palette at
// its first entry rather than throwing — the next save then persists a
// palette member.
function nextSwatch(current: string): string {
  const i = TRACK_SWATCHES.findIndex((s) => s.value === current);
  return TRACK_SWATCHES[(i + 1) % TRACK_SWATCHES.length]!.value;
}
function swatchLabel(current: string): string {
  return TRACK_SWATCHES.find((s) => s.value === current)?.label ?? 'Custom';
}

const SECTION_KEY = 'tracks-rooms';

interface Track {
  id: string;
  name: string;
  color: string | null;
  submissionCount: number;
}

interface Room {
  id: string;
  name: string;
  capacity: number | null;
  // DEC-896 amendment (wave 26): rides the /events/:id/rooms list response
  // (repo/events.ts listRoomsForEvent) so Remove can be disabled proactively
  // -- never a per-room follow-up request.
  sessionCount: number;
}

const EMPTY_TRACK: TrackForm = { name: '', color: TRACK_SWATCHES[0].value };
const EMPTY_ROOM: RoomForm = { name: '', capacity: '' };

/** Draft baseline for a track row -- same transform applied every time so
 * the dirty check (draft vs this baseline) never drifts from the loaded
 * record (a null color maps to the picker's own default, consistently). */
function trackBaseline(track: Track): TrackForm {
  return { name: track.name, color: track.color ?? TRACK_SWATCHES[0].value };
}

function roomBaseline(room: Room): RoomForm {
  return { name: room.name, capacity: room.capacity !== null ? String(room.capacity) : '' };
}

export function TracksRoomsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [tracks, setTracks] = useState<Track[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [newTrack, setNewTrack] = useState<TrackForm>(EMPTY_TRACK);
  const [newRoom, setNewRoom] = useState<RoomForm>(EMPTY_ROOM);
  const [trackFieldErrors, setTrackFieldErrors] = useState<TrackFormErrors>({});
  const [roomFieldErrors, setRoomFieldErrors] = useState<RoomFormErrors>({});

  // DEC-915: local draft per existing row, keyed by id -- typing here never
  // touches the network. Populated (once per row) from the loaded record;
  // an already-present entry survives an incidental reload (e.g. saving a
  // different row) so mid-typing state in one row is never clobbered by a
  // fetch triggered by another.
  const [trackDrafts, setTrackDrafts] = useState<Record<string, TrackForm>>({});
  const [roomDrafts, setRoomDrafts] = useState<Record<string, RoomForm>>({});
  const [trackRowErrors, setTrackRowErrors] = useState<Record<string, TrackFormErrors>>({});
  const [roomRowErrors, setRoomRowErrors] = useState<Record<string, RoomFormErrors>>({});
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  // DEC-931: a delete refusal's ApiError.fields names the blocking rows --
  // rendered as a list under the failing row instead of the bare message.
  const [trackDeleteBlockers, setTrackDeleteBlockers] = useState<Record<string, Record<string, string>>>({});
  const [roomDeleteBlockers, setRoomDeleteBlockers] = useState<Record<string, Record<string, string>>>({});

  // DEC-941: Remove is irreversible, so it opens the shared ConfirmDialog
  // naming the track/room first -- the DELETE only fires from the dialog's
  // own confirm control, never straight off the row button.
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'track'; track: Track } | { kind: 'room'; room: Room } | null>(
    null,
  );
  // G13 fix (frame 09--12, DESIGN-RULINGS error rules 8/11): Done must
  // never silently revert a dirty row -- when any row edit is unsaved,
  // Done opens a confirm NAMING what will be discarded; only the dialog's
  // own primary discards and leaves. The per-row save model itself is the
  // blessed model (DEVIATIONS §5 pending adjudication) and is unchanged.
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  // w4-e/DEC-815 amendment: the add form is revealed from a tertiary action
  // on the section head, not shown open-by-default with a filled primary --
  // one filled primary per view (the footer's Done/Save) is the invariant.
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);

  function reload(id: string) {
    apiList<Track>(`/events/${id}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
    apiList<Room>(`/events/${id}/rooms`)
      .then((res) => setRooms(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rooms'));
  }

  useEffect(() => {
    if (!eventId) return;
    reload(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    setTrackDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const track of tracks) {
        if (!(track.id in next)) {
          next[track.id] = trackBaseline(track);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tracks]);

  useEffect(() => {
    setRoomDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const room of rooms) {
        if (!(room.id in next)) {
          next[room.id] = roomBaseline(room);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rooms]);

  function closeEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  // The rows whose unsaved edits Done would otherwise lose -- named (by
  // their saved names) in the discard confirm.
  function dirtyRowNames(): string[] {
    return [
      ...tracks.filter((track) => isTrackDirty(track)).map((track) => track.name),
      ...rooms.filter((room) => isRoomDirty(room)).map((room) => room.name),
    ];
  }

  function handleDone() {
    if (dirtyRowNames().length > 0) {
      setConfirmingDiscard(true);
      return;
    }
    closeEdit();
  }

  function discardDirtyAndClose() {
    setTrackDrafts((prev) => {
      const next = { ...prev };
      for (const track of tracks) next[track.id] = trackBaseline(track);
      return next;
    });
    setRoomDrafts((prev) => {
      const next = { ...prev };
      for (const room of rooms) next[room.id] = roomBaseline(room);
      return next;
    });
    setTrackRowErrors({});
    setRoomRowErrors({});
    setConfirmingDiscard(false);
    closeEdit();
  }

  function isTrackDirty(track: Track): boolean {
    const draft = trackDrafts[track.id];
    if (!draft) return false;
    const base = trackBaseline(track);
    return draft.name !== base.name || draft.color !== base.color;
  }

  function isRoomDirty(room: Room): boolean {
    const draft = roomDrafts[room.id];
    if (!draft) return false;
    const base = roomBaseline(room);
    return draft.name !== base.name || draft.capacity !== base.capacity;
  }

  async function addTrack() {
    if (!eventId) return;
    setError(undefined);
    const errors = validateTrackForm(newTrack);
    setTrackFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/tracks`, {
        name: newTrack.name,
        color: newTrack.color || null,
      });
      setNewTrack(EMPTY_TRACK);
      setTrackFieldErrors({});
      reload(eventId);
    } catch (err) {
      // DEC-856: a fields map is never collapsed to err.message -- name/
      // color route to their own control below, anything else renders
      // labelled beside the form.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setTrackFieldErrors(err.fields as TrackFormErrors);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to add track');
      }
    }
  }

  async function saveTrack(track: Track) {
    if (!eventId) return;
    setError(undefined);
    const draft = trackDrafts[track.id];
    if (!draft) return;
    const errors = validateTrackForm(draft);
    setTrackRowErrors((prev) => ({ ...prev, [track.id]: errors }));
    if (Object.keys(errors).length > 0) return;
    setSavingTrackId(track.id);
    try {
      await apiPatch(`/tracks/${track.id}`, { name: draft.name, color: draft.color || null });
      setTrackRowErrors((prev) => ({ ...prev, [track.id]: {} }));
      reload(eventId);
    } catch (err) {
      // DEC-856: keyed by row id, so a refusal editing track N never marks
      // another row.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setTrackRowErrors((prev) => ({ ...prev, [track.id]: err.fields as TrackFormErrors }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save track');
      }
    } finally {
      setSavingTrackId(null);
    }
  }

  function cancelTrack(track: Track) {
    setTrackDrafts((prev) => ({ ...prev, [track.id]: trackBaseline(track) }));
    setTrackRowErrors((prev) => ({ ...prev, [track.id]: {} }));
  }

  function deleteTrack(track: Track) {
    setPendingDelete({ kind: 'track', track });
  }

  async function confirmDeleteTrack(track: Track) {
    if (!eventId) return;
    setError(undefined);
    try {
      await apiDelete(`/tracks/${track.id}`);
      setTrackDeleteBlockers((prev) => ({ ...prev, [track.id]: {} }));
      reload(eventId);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setTrackDeleteBlockers((prev) => ({ ...prev, [track.id]: err.fields! }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to delete track');
      }
    } finally {
      setPendingDelete(null);
    }
  }

  async function addRoom() {
    if (!eventId) return;
    setError(undefined);
    const errors = validateRoomForm(newRoom);
    setRoomFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/rooms`, {
        name: newRoom.name,
        capacity: newRoom.capacity.trim().length > 0 ? Number(newRoom.capacity) : null,
      });
      setNewRoom(EMPTY_ROOM);
      setRoomFieldErrors({});
      reload(eventId);
    } catch (err) {
      // DEC-856: a fields map is never collapsed to err.message -- name/
      // capacity route to their own control below, anything else renders
      // labelled beside the form.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setRoomFieldErrors(err.fields as RoomFormErrors);
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to add room');
      }
    }
  }

  async function saveRoom(room: Room) {
    if (!eventId) return;
    setError(undefined);
    const draft = roomDrafts[room.id];
    if (!draft) return;
    const errors = validateRoomForm(draft);
    setRoomRowErrors((prev) => ({ ...prev, [room.id]: errors }));
    if (Object.keys(errors).length > 0) return;
    setSavingRoomId(room.id);
    try {
      await apiPatch(`/rooms/${room.id}`, {
        name: draft.name,
        capacity: draft.capacity.trim().length > 0 ? Number(draft.capacity) : null,
      });
      setRoomRowErrors((prev) => ({ ...prev, [room.id]: {} }));
      reload(eventId);
    } catch (err) {
      // DEC-856: keyed by row id, so a refusal editing room N never marks
      // another row.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setRoomRowErrors((prev) => ({ ...prev, [room.id]: err.fields as RoomFormErrors }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save room');
      }
    } finally {
      setSavingRoomId(null);
    }
  }

  function cancelRoom(room: Room) {
    setRoomDrafts((prev) => ({ ...prev, [room.id]: roomBaseline(room) }));
    setRoomRowErrors((prev) => ({ ...prev, [room.id]: {} }));
  }

  function deleteRoom(room: Room) {
    setPendingDelete({ kind: 'room', room });
  }

  async function confirmDeleteRoom(room: Room) {
    if (!eventId) return;
    setError(undefined);
    try {
      await apiDelete(`/rooms/${room.id}`);
      setRoomDeleteBlockers((prev) => ({ ...prev, [room.id]: {} }));
      reload(eventId);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setRoomDeleteBlockers((prev) => ({ ...prev, [room.id]: err.fields! }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to delete room');
      }
    } finally {
      setPendingDelete(null);
    }
  }

  const readValue = (
    <div className="chq-settings-tracks-rooms-grid">
      <div className="chq-settings-tracks-rooms-col" aria-label="Tracks">
        {tracks.length === 0 ? <p className="chq-settings-empty">No tracks yet.</p> : null}
        {tracks.map((track) => (
          <div key={track.id} className="chq-settings-tracks-rooms-row">
            <span>{track.name}</span>
            <span className="chq-settings-tracks-rooms-count">{track.submissionCount} submissions</span>
          </div>
        ))}
      </div>
      <div className="chq-settings-tracks-rooms-col" aria-label="Rooms">
        {rooms.length === 0 ? <p className="chq-settings-empty">No rooms yet.</p> : null}
        {rooms.map((room) => (
          <div key={room.id} className="chq-settings-tracks-rooms-row">
            <span>{room.name}</span>
            <span className="chq-settings-tracks-rooms-count">
              {room.capacity !== null ? `${room.capacity} seats` : 'No capacity set'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const trackAddSummaryProblems = [
    trackFieldErrors.name ? { anchorId: 'chq-new-track-name', label: trackFieldErrors.name } : null,
    trackFieldErrors.color ? { anchorId: 'chq-new-track-color', label: trackFieldErrors.color } : null,
  ].filter((p): p is { anchorId: string; label: string } => p !== null);
  const trackAddUnowned = unownedFieldEntries(trackFieldErrors, TRACK_FIELD_KEYS);

  const roomAddSummaryProblems = [
    roomFieldErrors.name ? { anchorId: 'chq-new-room-name', label: roomFieldErrors.name } : null,
    roomFieldErrors.capacity ? { anchorId: 'chq-new-room-capacity', label: roomFieldErrors.capacity } : null,
  ].filter((p): p is { anchorId: string; label: string } => p !== null);
  const roomAddUnowned = unownedFieldEntries(roomFieldErrors, ROOM_FIELD_KEYS);

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Tracks and rooms"
        rows={[{ label: '', value: readValue, rowClassName: 'chq-settings-row-full' }]}
        actionLabel="Add"
        editing={editing}
      >
        <SettingsEditForm
          onSubmit={(e) => e.preventDefault()}
          consequence="A track in use cannot be removed — retire it. Seats are advisory: the agenda flags over-capacity but never blocks."
          footer={{
            primary: (
              <button type="button" className="chq-btn chq-btn-primary" onClick={handleDone}>
                Done
              </button>
            ),
          }}
        >
          <div className="chq-settings-section-head">
            <h3 className="chq-section-label">Tracks &middot; {tracks.length}</h3>
            <button
              type="button"
              className="chq-settings-section-action chq-link-button"
              onClick={() => setShowAddTrack((v) => !v)}
            >
              Add a track
            </button>
          </div>
          {/* DEC-888 (wave 64 amendment): one caption for the section, not
              one per row -- names what the colour is for. */}
          <p className="chq-settings-section-caption">
            The colour is how a track reads on the agenda and the public pages.
          </p>
          <ul className="chq-settings-edit-list">
            {tracks.map((track) => {
              const draft = trackDrafts[track.id] ?? trackBaseline(track);
              const dirty = isTrackDirty(track);
              const rowErrors = trackRowErrors[track.id] ?? {};
              const saving = savingTrackId === track.id;
              // DEC-896 amendment (wave 26): a track with submissions cannot be
              // removed -- disabled, not hidden, with the reason on the row.
              const inUse = track.submissionCount > 0;
              const rowUnowned = unownedFieldEntries(rowErrors, TRACK_FIELD_KEYS);
              const rowSummaryProblems = [
                rowErrors.name ? { anchorId: `chq-track-name-${track.id}`, label: rowErrors.name } : null,
                rowErrors.color ? { anchorId: `chq-track-color-${track.id}`, label: rowErrors.color } : null,
              ].filter((p): p is { anchorId: string; label: string } => p !== null);
              return (
                <li key={track.id} className="chq-settings-edit-row chq-settings-track-edit-row">
                  {rowSummaryProblems.length > 0 ? (
                    <ErrorSummary
                      heading={countHeading(rowSummaryProblems.length, 'before this track can be saved')}
                      problems={rowSummaryProblems}
                    />
                  ) : null}
                  <span className="chq-settings-edit-row-value">
                    {/* Frame 09--12: the swatch sits LEFT of the name and IS
                        the control — no separate picker row (DESIGN-RULINGS
                        "belongs beside the name rather than in a separate
                        picker"). Selecting cycles the token palette in
                        place, so nothing appears or resizes on pick. */}
                    <button
                      id={`chq-track-color-${track.id}`}
                      type="button"
                      className="chq-color-swatch chq-swatch-cycle"
                      style={{ background: draft.color }}
                      aria-label={`Track colour for ${track.name}: ${swatchLabel(draft.color)}. Select to change.`}
                      onClick={() =>
                        setTrackDrafts((prev) => ({ ...prev, [track.id]: { ...draft, color: nextSwatch(draft.color) } }))
                      }
                    />
                    <input
                      id={`chq-track-name-${track.id}`}
                      className={rowErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
                      value={draft.name}
                      onChange={(e) =>
                        setTrackDrafts((prev) => ({ ...prev, [track.id]: { ...draft, name: e.target.value } }))
                      }
                      aria-label={`Track name for ${track.name}`}
                      aria-invalid={rowErrors.name ? 'true' : undefined}
                      maxLength={MAX_NAME_LENGTH}
                    />
                  </span>
                  <span className="chq-settings-edit-row-meta">{track.submissionCount} submissions</span>
                  <span className="chq-settings-edit-row-actions">
                    {dirty ? (
                      <>
                        <button
                          type="button"
                          className="chq-link-button"
                          onClick={() => void saveTrack(track)}
                          disabled={saving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="chq-link-button"
                          onClick={() => cancelTrack(track)}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="chq-link-button"
                      onClick={() => void deleteTrack(track)}
                      disabled={inUse}
                      title={inUse ? 'A track in use cannot be removed — retire it instead' : undefined}
                    >
                      Remove
                    </button>
                  </span>
                  {inUse ? (
                    <p className="chq-settings-row-hint">In use — retire it instead of removing</p>
                  ) : null}
                  {rowErrors.name ? (
                    <span role="alert" className="chq-field-error">
                      {rowErrors.name}
                    </span>
                  ) : null}
                  {rowErrors.color ? (
                    <span role="alert" className="chq-field-error">
                      {rowErrors.color}
                    </span>
                  ) : null}
                  {rowUnowned.map(([key, message]) => (
                    <span key={key} role="alert" className="chq-field-error">
                      {`${key}: ${message}`}
                    </span>
                  ))}
                  {Object.entries(trackDeleteBlockers[track.id] ?? {}).map(([key, value]) => (
                    <div key={key} role="alert" className="chq-settings-delete-blockers">
                      <p>Can&apos;t delete — referenced by {key}:</p>
                      <ul>
                        {value.split('; ').map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
          {showAddTrack ? (
            <>
              {trackAddSummaryProblems.length > 0 ? (
                <ErrorSummary
                  heading={countHeading(trackAddSummaryProblems.length, 'before this track can be added')}
                  problems={trackAddSummaryProblems}
                />
              ) : null}
              <SettingsField label="New track name" htmlFor="chq-new-track-name" width="name">
                <input
                  id="chq-new-track-name"
                  className={trackFieldErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
                  placeholder="New track name"
                  value={newTrack.name}
                  onChange={(e) => setNewTrack({ ...newTrack, name: e.target.value })}
                  aria-invalid={trackFieldErrors.name ? 'true' : undefined}
                  maxLength={MAX_NAME_LENGTH}
                />
              </SettingsField>
              <div className="chq-settings-row">
                <button
                  id="chq-new-track-color"
                  type="button"
                  className="chq-color-swatch chq-swatch-cycle"
                  style={{ background: newTrack.color }}
                  aria-label={`Track colour: ${swatchLabel(newTrack.color)}. Select to change.`}
                  onClick={() => setNewTrack({ ...newTrack, color: nextSwatch(newTrack.color) })}
                />
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void addTrack()}>
                  Add track
                </button>
                {trackFieldErrors.name ? (
                  <span role="alert" className="chq-field-error">
                    {trackFieldErrors.name}
                  </span>
                ) : null}
                {trackFieldErrors.color ? (
                  <span role="alert" className="chq-field-error">
                    {trackFieldErrors.color}
                  </span>
                ) : null}
                {trackAddUnowned.map(([key, message]) => (
                  <span key={key} role="alert" className="chq-field-error">
                    {`${key}: ${message}`}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          <div className="chq-settings-section-head">
            <h3 className="chq-section-label">Rooms &middot; {rooms.length}</h3>
            <button
              type="button"
              className="chq-settings-section-action chq-link-button"
              onClick={() => setShowAddRoom((v) => !v)}
            >
              Add a room
            </button>
          </div>
          <ul className="chq-settings-edit-list">
            {rooms.map((room) => {
              const draft = roomDrafts[room.id] ?? roomBaseline(room);
              const dirty = isRoomDirty(room);
              const rowErrors = roomRowErrors[room.id] ?? {};
              const saving = savingRoomId === room.id;
              // DEC-896 amendment (wave 26): a room with scheduled sessions
              // cannot be removed -- disabled, not hidden, reason on the row.
              const inUse = room.sessionCount > 0;
              const rowUnowned = unownedFieldEntries(rowErrors, ROOM_FIELD_KEYS);
              const rowSummaryProblems = [
                rowErrors.name ? { anchorId: `chq-room-name-${room.id}`, label: rowErrors.name } : null,
                rowErrors.capacity ? { anchorId: `chq-room-capacity-${room.id}`, label: rowErrors.capacity } : null,
              ].filter((p): p is { anchorId: string; label: string } => p !== null);
              return (
                <li key={room.id} className="chq-settings-edit-row chq-settings-room-edit-row">
                  {rowSummaryProblems.length > 0 ? (
                    <ErrorSummary
                      heading={countHeading(rowSummaryProblems.length, 'before this room can be saved')}
                      problems={rowSummaryProblems}
                    />
                  ) : null}
                  <span className="chq-settings-edit-row-value">
                    <input
                      id={`chq-room-name-${room.id}`}
                      className={rowErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
                      value={draft.name}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({ ...prev, [room.id]: { ...draft, name: e.target.value } }))
                      }
                      aria-label={`Room name for ${room.name}`}
                      aria-invalid={rowErrors.name ? 'true' : undefined}
                      maxLength={MAX_NAME_LENGTH}
                    />
                  </span>
                  <span className="chq-settings-edit-row-seats">
                    <input
                      id={`chq-room-capacity-${room.id}`}
                      className={rowErrors.capacity ? 'chq-input chq-field-invalid' : 'chq-input'}
                      placeholder="Capacity"
                      value={draft.capacity}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({ ...prev, [room.id]: { ...draft, capacity: e.target.value } }))
                      }
                      aria-label={`Capacity for ${room.name}`}
                      aria-invalid={rowErrors.capacity ? 'true' : undefined}
                    />
                  </span>
                  <span className="chq-settings-edit-row-meta" />
                  <span className="chq-settings-edit-row-actions">
                    {dirty ? (
                      <>
                        <button
                          type="button"
                          className="chq-link-button"
                          onClick={() => void saveRoom(room)}
                          disabled={saving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="chq-link-button"
                          onClick={() => cancelRoom(room)}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="chq-link-button"
                      onClick={() => void deleteRoom(room)}
                      disabled={inUse}
                      title={inUse ? 'A room with scheduled sessions cannot be removed' : undefined}
                    >
                      Remove
                    </button>
                  </span>
                  {inUse ? (
                    <p className="chq-settings-row-hint">Has scheduled sessions — cannot be removed</p>
                  ) : null}
                  {rowErrors.name ? (
                    <span role="alert" className="chq-field-error">
                      {rowErrors.name}
                    </span>
                  ) : null}
                  {rowErrors.capacity ? (
                    <span role="alert" className="chq-field-error">
                      {rowErrors.capacity}
                    </span>
                  ) : null}
                  {rowUnowned.map(([key, message]) => (
                    <span key={key} role="alert" className="chq-field-error">
                      {`${key}: ${message}`}
                    </span>
                  ))}
                  {Object.entries(roomDeleteBlockers[room.id] ?? {}).map(([key, value]) => (
                    <div key={key} role="alert" className="chq-settings-delete-blockers">
                      <p>Can&apos;t delete — referenced by {key}:</p>
                      <ul>
                        {value.split('; ').map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
          {showAddRoom ? (
            <>
              {roomAddSummaryProblems.length > 0 ? (
                <ErrorSummary
                  heading={countHeading(roomAddSummaryProblems.length, 'before this room can be added')}
                  problems={roomAddSummaryProblems}
                />
              ) : null}
              <SettingsFieldPair>
                <SettingsField label="New room name" htmlFor="chq-new-room-name" width="name">
                  <input
                    id="chq-new-room-name"
                    className={roomFieldErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
                    placeholder="New room name"
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    aria-invalid={roomFieldErrors.name ? 'true' : undefined}
                    maxLength={MAX_NAME_LENGTH}
                  />
                </SettingsField>
                <SettingsField label="Seats" htmlFor="chq-new-room-capacity" width="seats">
                  <input
                    id="chq-new-room-capacity"
                    className={roomFieldErrors.capacity ? 'chq-input chq-field-invalid' : 'chq-input'}
                    placeholder="Capacity"
                    value={newRoom.capacity}
                    onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                    aria-invalid={roomFieldErrors.capacity ? 'true' : undefined}
                  />
                </SettingsField>
              </SettingsFieldPair>
              <div className="chq-settings-row">
                <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void addRoom()}>
                  Add room
                </button>
                {roomFieldErrors.name ? (
                  <span role="alert" className="chq-field-error">
                    {roomFieldErrors.name}
                  </span>
                ) : null}
                {roomFieldErrors.capacity ? (
                  <span role="alert" className="chq-field-error">
                    {roomFieldErrors.capacity}
                  </span>
                ) : null}
                {roomAddUnowned.map(([key, message]) => (
                  <span key={key} role="alert" className="chq-field-error">
                    {`${key}: ${message}`}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </SettingsEditForm>
      </SummarySection>

      {confirmingDiscard && (
        <ConfirmDialog
          title="Discard unsaved edits?"
          body={
            <p>
              {dirtyRowNames().join(', ')} {dirtyRowNames().length === 1 ? 'has' : 'have'} unsaved edits. Each row
              saves with its own Save control — leaving now discards these edits and keeps the saved values.
            </p>
          }
          confirmLabel="Discard the edits"
          onConfirm={discardDirtyAndClose}
          onCancel={() => setConfirmingDiscard(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.kind === 'track' ? 'Remove this track?' : 'Remove this room?'}
          body={
            <p>
              {pendingDelete.kind === 'track' ? pendingDelete.track.name : pendingDelete.room.name} will be removed.
              This cannot be undone.
            </p>
          }
          confirmLabel={pendingDelete.kind === 'track' ? 'Remove track' : 'Remove room'}
          onConfirm={() =>
            void (pendingDelete.kind === 'track'
              ? confirmDeleteTrack(pendingDelete.track)
              : confirmDeleteRoom(pendingDelete.room))
          }
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
