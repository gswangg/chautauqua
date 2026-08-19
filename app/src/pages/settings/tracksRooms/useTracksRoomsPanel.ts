// Tracks & rooms panel (w4-h, DEC-032; summary-first w3-c, DEC-747) state
// and handlers, split out of TracksRoomsPanel.tsx (custodian decomposition)
// so the render module stays a thin view over this hook. Endpoints
// unchanged: GET/POST /events/:id/tracks|rooms, PATCH/DELETE /tracks|rooms/:id.
//
// DEC-915: each existing row is a local DRAFT, not a live-wired input --
// typing writes nothing until an explicit Save; Cancel restores the loaded
// value; the drilled edit view carries a Done control back to the summary,
// matching EventSettingsPanel/ResourcesPanel/PeopleRolesPanel/ApiTokensPanel.
// DEC-916: submissionCount rides the tracks list response (one grouped
// server-side aggregate) -- no per-track follow-up request.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiDelete, apiList, apiPatch, apiPost, ApiError } from '../../../lib/api';
import { useCurrentEvent } from '../../../lib/useCurrentEvent';
import { validateRoomForm, validateTrackForm, type RoomForm, type RoomFormErrors, type TrackForm, type TrackFormErrors } from '../formState';
import { nextSwatch } from './trackSwatches';
import { EMPTY_ROOM, EMPTY_TRACK, roomBaseline, trackBaseline, type Room, type Track } from './types';

export function useTracksRoomsPanel(sectionKey: string) {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === sectionKey && searchParams.get('edit') === '1';
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

  function onSwatchCycle(trackId: string, draft: TrackForm) {
    setTrackDrafts((prev) => ({ ...prev, [trackId]: { ...draft, color: nextSwatch(draft.color) } }));
  }

  function onTrackNameChange(trackId: string, draft: TrackForm, value: string) {
    setTrackDrafts((prev) => ({ ...prev, [trackId]: { ...draft, name: value } }));
  }

  function onRoomNameChange(roomId: string, draft: RoomForm, value: string) {
    setRoomDrafts((prev) => ({ ...prev, [roomId]: { ...draft, name: value } }));
  }

  function onRoomCapacityChange(roomId: string, draft: RoomForm, value: string) {
    setRoomDrafts((prev) => ({ ...prev, [roomId]: { ...draft, capacity: value } }));
  }

  return {
    eventId,
    eventLoading,
    eventError,
    editing,
    tracks,
    rooms,
    error,
    newTrack,
    setNewTrack,
    newRoom,
    setNewRoom,
    trackFieldErrors,
    roomFieldErrors,
    trackDrafts,
    roomDrafts,
    trackRowErrors,
    roomRowErrors,
    savingTrackId,
    savingRoomId,
    trackDeleteBlockers,
    roomDeleteBlockers,
    pendingDelete,
    setPendingDelete,
    confirmingDiscard,
    setConfirmingDiscard,
    showAddTrack,
    setShowAddTrack,
    showAddRoom,
    setShowAddRoom,
    dirtyRowNames,
    handleDone,
    discardDirtyAndClose,
    isTrackDirty,
    isRoomDirty,
    addTrack,
    saveTrack,
    cancelTrack,
    deleteTrack,
    confirmDeleteTrack,
    addRoom,
    saveRoom,
    cancelRoom,
    deleteRoom,
    confirmDeleteRoom,
    onSwatchCycle,
    onTrackNameChange,
    onRoomNameChange,
    onRoomCapacityChange,
  };
}
