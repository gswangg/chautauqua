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
import { DEC_888 } from '../../../../src/decisions';

// DEC-888: ONE enumeration supplies the swatch picker buttons, the new-
// track default (its first entry), and the .chq-color-swatch preview --
// so the palette a track can be given and the palette the picker offers
// can never desync. Colors drawn from the product palette, never an
// off-palette literal like the old raw <input type="color"> default.
export const TRACK_SWATCHES = [
  { value: '#4338ca', label: 'Indigo' },
  { value: '#0f766e', label: 'Teal' },
  { value: '#b45309', label: 'Amber' },
  { value: '#be123c', label: 'Rose' },
  { value: '#4d7c0f', label: 'Olive' },
  { value: '#1d4ed8', label: 'Blue' },
] as const;
void DEC_888;

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
    const errors = validateTrackForm(newTrack);
    setTrackFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/tracks`, {
        name: newTrack.name,
        color: newTrack.color || null,
      });
      setNewTrack(EMPTY_TRACK);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add track');
    }
  }

  async function saveTrack(track: Track) {
    if (!eventId) return;
    const draft = trackDrafts[track.id];
    if (!draft) return;
    const errors = validateTrackForm(draft);
    setTrackRowErrors((prev) => ({ ...prev, [track.id]: errors }));
    if (Object.keys(errors).length > 0) return;
    setSavingTrackId(track.id);
    try {
      await apiPatch(`/tracks/${track.id}`, { name: draft.name, color: draft.color || null });
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save track');
    } finally {
      setSavingTrackId(null);
    }
  }

  function cancelTrack(track: Track) {
    setTrackDrafts((prev) => ({ ...prev, [track.id]: trackBaseline(track) }));
    setTrackRowErrors((prev) => ({ ...prev, [track.id]: {} }));
  }

  async function deleteTrack(track: Track) {
    if (!eventId) return;
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
    }
  }

  async function addRoom() {
    if (!eventId) return;
    const errors = validateRoomForm(newRoom);
    setRoomFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await apiPost(`/events/${eventId}/rooms`, {
        name: newRoom.name,
        capacity: newRoom.capacity.trim().length > 0 ? Number(newRoom.capacity) : null,
      });
      setNewRoom(EMPTY_ROOM);
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add room');
    }
  }

  async function saveRoom(room: Room) {
    if (!eventId) return;
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
      reload(eventId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save room');
    } finally {
      setSavingRoomId(null);
    }
  }

  function cancelRoom(room: Room) {
    setRoomDrafts((prev) => ({ ...prev, [room.id]: roomBaseline(room) }));
    setRoomRowErrors((prev) => ({ ...prev, [room.id]: {} }));
  }

  async function deleteRoom(room: Room) {
    if (!eventId) return;
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
              <button type="button" className="chq-btn chq-btn-primary" onClick={closeEdit}>
                Done
              </button>
            ),
          }}
        >
          <h3 className="chq-section-label">Tracks</h3>
          <ul className="chq-settings-edit-list">
            {tracks.map((track) => {
              const draft = trackDrafts[track.id] ?? trackBaseline(track);
              const dirty = isTrackDirty(track);
              const rowErrors = trackRowErrors[track.id] ?? {};
              const saving = savingTrackId === track.id;
              // DEC-896 amendment (wave 26): a track with submissions cannot be
              // removed -- disabled, not hidden, with the reason on the row.
              const inUse = track.submissionCount > 0;
              return (
                <li key={track.id} className="chq-settings-edit-row">
                  <span className="chq-settings-edit-row-value">
                    <span
                      className="chq-color-swatch"
                      style={{ background: draft.color }}
                      aria-hidden="true"
                    />
                    <input
                      className="chq-input"
                      value={draft.name}
                      onChange={(e) =>
                        setTrackDrafts((prev) => ({ ...prev, [track.id]: { ...draft, name: e.target.value } }))
                      }
                      aria-label={`Track name for ${track.name}`}
                    />
                    <div
                      className="chq-swatch-picker"
                      role="radiogroup"
                      aria-label={`Track color for ${track.name}`}
                    >
                      {TRACK_SWATCHES.map((swatch) => (
                        <button
                          key={swatch.value}
                          type="button"
                          role="radio"
                          className="chq-color-swatch chq-swatch-picker-option"
                          style={{ background: swatch.value }}
                          aria-checked={draft.color === swatch.value}
                          aria-label={swatch.label}
                          onClick={() =>
                            setTrackDrafts((prev) => ({ ...prev, [track.id]: { ...draft, color: swatch.value } }))
                          }
                        />
                      ))}
                    </div>
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
                  {rowErrors.name ? <span role="alert">{rowErrors.name}</span> : null}
                  {rowErrors.color ? <span role="alert">{rowErrors.color}</span> : null}
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
          <SettingsField label="New track name" htmlFor="chq-new-track-name" width="name">
            <input
              id="chq-new-track-name"
              className="chq-input"
              placeholder="New track name"
              value={newTrack.name}
              onChange={(e) => setNewTrack({ ...newTrack, name: e.target.value })}
            />
          </SettingsField>
          <div className="chq-settings-row">
            <div className="chq-swatch-picker" role="radiogroup" aria-label="Track color">
              {TRACK_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  role="radio"
                  className="chq-color-swatch chq-swatch-picker-option"
                  style={{ background: swatch.value }}
                  aria-checked={newTrack.color === swatch.value}
                  aria-label={swatch.label}
                  onClick={() => setNewTrack({ ...newTrack, color: swatch.value })}
                />
              ))}
            </div>
            <button type="button" className="chq-btn chq-btn-primary" onClick={() => void addTrack()}>
              Add track
            </button>
            {trackFieldErrors.name ? <span role="alert">{trackFieldErrors.name}</span> : null}
            {trackFieldErrors.color ? <span role="alert">{trackFieldErrors.color}</span> : null}
          </div>

          <h3 className="chq-section-label">Rooms</h3>
          <ul className="chq-settings-edit-list">
            {rooms.map((room) => {
              const draft = roomDrafts[room.id] ?? roomBaseline(room);
              const dirty = isRoomDirty(room);
              const rowErrors = roomRowErrors[room.id] ?? {};
              const saving = savingRoomId === room.id;
              // DEC-896 amendment (wave 26): a room with scheduled sessions
              // cannot be removed -- disabled, not hidden, reason on the row.
              const inUse = room.sessionCount > 0;
              return (
                <li key={room.id} className="chq-settings-edit-row">
                  <span className="chq-settings-edit-row-value">
                    <input
                      className="chq-input"
                      value={draft.name}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({ ...prev, [room.id]: { ...draft, name: e.target.value } }))
                      }
                      aria-label={`Room name for ${room.name}`}
                    />
                  </span>
                  <span className="chq-settings-edit-row-meta">
                    <input
                      className="chq-input"
                      placeholder="Capacity"
                      value={draft.capacity}
                      onChange={(e) =>
                        setRoomDrafts((prev) => ({ ...prev, [room.id]: { ...draft, capacity: e.target.value } }))
                      }
                      aria-label={`Capacity for ${room.name}`}
                    />
                  </span>
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
                  {rowErrors.name ? <span role="alert">{rowErrors.name}</span> : null}
                  {rowErrors.capacity ? <span role="alert">{rowErrors.capacity}</span> : null}
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
          <SettingsFieldPair>
            <SettingsField label="New room name" htmlFor="chq-new-room-name" width="name">
              <input
                id="chq-new-room-name"
                className="chq-input"
                placeholder="New room name"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              />
            </SettingsField>
            <SettingsField label="Seats" htmlFor="chq-new-room-capacity" width="seats">
              <input
                id="chq-new-room-capacity"
                className="chq-input"
                placeholder="Capacity"
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
              />
            </SettingsField>
          </SettingsFieldPair>
          <div className="chq-settings-row">
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void addRoom()}>
              Add room
            </button>
            {roomFieldErrors.name ? <span role="alert">{roomFieldErrors.name}</span> : null}
            {roomFieldErrors.capacity ? <span role="alert">{roomFieldErrors.capacity}</span> : null}
          </div>
        </SettingsEditForm>
      </SummarySection>
    </>
  );
}
