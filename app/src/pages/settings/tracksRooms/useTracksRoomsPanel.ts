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
import { DEC_941 } from '../../../../../src/decisions';

void DEC_941; // closing the drill-in retires the add forms; an unsaved add draft arms the discard confirm

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

  // DEC-941 wave-107 amendment: closing the drill-in retires the add-a-
  // track/add-a-room pass entirely, whichever exit closeEdit is reached
  // through -- Done-with-nothing-dirty and Done-with-discard both funnel
  // through closeEdit, so both get this for free. Reuses toggleAddTrack/
  // toggleAddRoom's own per-form reset expressions rather than writing a
  // third copy of that vocabulary (DEC-613).
  function retireAddForms() {
    setTrackFieldErrors({});
    setNewTrack(EMPTY_TRACK);
    setShowAddTrack(false);
    setRoomFieldErrors({});
    setNewRoom(EMPTY_ROOM);
    setShowAddRoom(false);
  }

  function closeEdit() {
    retireAddForms();
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

  // DEC-941 wave-107 amendment: a typed-but-not-yet-added new track/room
  // contributes nothing to dirtyRowNames (it has no saved name to compare
  // against), so an unsaved add draft is its own arming condition -- the
  // mirror of "a confirm with no arming is the mirror of a delete with no
  // confirm". Named (where a name was typed) so the confirm body can name
  // the same scope the handler is about to drop.
  function unsavedAddDraftNames(): string[] {
    const names: string[] = [];
    if (newTrack.name !== EMPTY_TRACK.name || newTrack.color !== EMPTY_TRACK.color) {
      names.push(newTrack.name.trim().length > 0 ? newTrack.name : 'the new track');
    }
    if (newRoom.name !== EMPTY_ROOM.name || newRoom.capacity !== EMPTY_ROOM.capacity) {
      names.push(newRoom.name.trim().length > 0 ? newRoom.name : 'the new room');
    }
    return names;
  }

  function hasUnsavedAddDraft(): boolean {
    return unsavedAddDraftNames().length > 0;
  }

  function handleDone() {
    if (dirtyRowNames().length > 0 || hasUnsavedAddDraft()) {
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

  /** DEC-856 wave-72 ("the rule is per error STATE, not per panel: a
   * component holding two error states owes each one its own clear"): the ONE
   * way the add-a-track form opens or closes, whichever control triggers it
   * (the desktop section-head link or the phone add row). Closing it retires
   * that form's whole attempt — the refusal AND the draft it was about — so
   * re-opening can never re-render a refusal describing an attempt the
   * organiser already walked away from. Both call sites previously did a bare
   * `setShowAddTrack((v) => !v)`, which cleared neither: hide then re-show
   * redisplayed "Required" over an empty field, a refusal about nothing.
   * PeopleRolesPanel.closeInviteDialog's idiom, applied per form.
   *
   * It touches the TRACK form's state and nothing else. The room form's
   * refusal is a different error state and owes its own clear (below), never
   * one driven from here — a control erasing a refusal about a control it
   * does not own is the same silence in the other direction. */
  function toggleAddTrack() {
    if (showAddTrack) {
      setTrackFieldErrors({});
      setNewTrack(EMPTY_TRACK);
    }
    setShowAddTrack((visible) => !visible);
  }

  /** The room half of toggleAddTrack, same rule, same isolation. */
  function toggleAddRoom() {
    if (showAddRoom) {
      setRoomFieldErrors({});
      setNewRoom(EMPTY_ROOM);
    }
    setShowAddRoom((visible) => !visible);
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
    // The raw setters are deliberately NOT exported: toggleAddTrack/
    // toggleAddRoom are the only way to flip these, so no view call site can
    // reopen a form over its own stale refusal.
    showAddTrack,
    toggleAddTrack,
    showAddRoom,
    toggleAddRoom,
    dirtyRowNames,
    unsavedAddDraftNames,
    hasUnsavedAddDraft,
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
