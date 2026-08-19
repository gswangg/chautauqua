// Tracks & rooms panel (w4-h, DEC-032; summary-first w3-c, DEC-747): read
// view is two columns -- tracks with their submission counts, rooms with
// their capacities (docs/design/Chautauqua Settings.dc.html:103-126) --
// with 'Add' as the section's one drill action (SummarySection, DEC-728)
// into the existing add/rename/delete form. Endpoints unchanged:
// GET/POST /events/:id/tracks|rooms, PATCH/DELETE /tracks|rooms/:id.
//
// Custodian decomposition: state/handlers live in
// ./tracksRooms/useTracksRoomsPanel, the swatch palette in
// ./tracksRooms/trackSwatches, shared types/baselines in
// ./tracksRooms/types, and the two edit-list rows in
// ./tracksRooms/TrackEditRow / ./tracksRooms/RoomEditRow. This module is
// the view that wires them together -- no behaviour change from the
// previous single-file version.
import { DelayedLoading } from '../../components/DelayedLoading';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { plural } from '../../lib/plural';
import { SummarySection } from './SummarySection';
import { SettingsEditForm, SettingsField, SettingsFieldPair } from './SettingsEditForm';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { MAX_NAME_LENGTH } from '../../../../src/forms/validate';
import { RoomEditRow } from './tracksRooms/RoomEditRow';
import { TrackEditRow } from './tracksRooms/TrackEditRow';
import { TRACK_SWATCHES, nextSwatch, swatchLabel } from './tracksRooms/trackSwatches';
import { roomBaseline, trackBaseline, unownedFieldEntries, ROOM_FIELD_KEYS, TRACK_FIELD_KEYS } from './tracksRooms/types';
import { useTracksRoomsPanel } from './tracksRooms/useTracksRoomsPanel';
import { DEC_385, DEC_728, DEC_919 } from '../../../../src/decisions';
import './settings-drill-rows.css';

void DEC_385; // new page-local sheet, settings-drill-rows.css
void DEC_728; // the 390 drill frame's own controls, not a second tap
void DEC_919; // phone-only sibling, desktop head link hidden at phone

export { TRACK_SWATCHES };

const SECTION_KEY = 'tracks-rooms';

export function TracksRoomsPanel() {
  const {
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
    toggleAddTrack,
    showAddRoom,
    toggleAddRoom,
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
  } = useTracksRoomsPanel(SECTION_KEY);

  const readValue = (
    <div className="chq-settings-tracks-rooms-grid">
      <div className="chq-settings-tracks-rooms-col" aria-label="Tracks">
        {/* w4-e/DEC-375: phone-only caption (docs/design/Chautauqua
            Settings.dc.html:347-390 draws a 2px-ruled 'TRACKS'/'N' caption
            above the read list) -- hidden at desktop, where the two-column
            grid carries no caption row of its own (frozen). */}
        <div className="chq-settings-tracks-rooms-phone-caption">
          <span>Tracks</span>
          <span>{tracks.length}</span>
        </div>
        {tracks.length === 0 ? <p className="chq-settings-empty">No tracks yet.</p> : null}
        {tracks.map((track) => (
          <div key={track.id} className="chq-settings-tracks-rooms-row">
            <span>{track.name}</span>
            <span className="chq-settings-tracks-rooms-count">{track.submissionCount} submissions</span>
          </div>
        ))}
      </div>
      <div className="chq-settings-tracks-rooms-col" aria-label="Rooms">
        <div className="chq-settings-tracks-rooms-phone-caption">
          <span>Rooms</span>
          <span>{rooms.length}</span>
        </div>
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
              className="chq-settings-section-action chq-link-button chq-settings-drillrow-head-hide"
              onClick={toggleAddTrack}
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
            {tracks.map((track) => (
              <TrackEditRow
                key={track.id}
                track={track}
                draft={trackDrafts[track.id] ?? trackBaseline(track)}
                dirty={isTrackDirty(track)}
                rowErrors={trackRowErrors[track.id] ?? {}}
                saving={savingTrackId === track.id}
                deleteBlockers={trackDeleteBlockers[track.id] ?? {}}
                onSwatchCycle={onSwatchCycle}
                onNameChange={onTrackNameChange}
                onSave={(t) => void saveTrack(t)}
                onCancel={cancelTrack}
                onDelete={(t) => void deleteTrack(t)}
              />
            ))}
          </ul>
          {/* docs/design/Chautauqua Settings.dc.html:367 `border:1px
              dashed #BAB6A6; border-radius:6px; min-height:44px;
              font-size:13px; font-weight:700; color:#4E5C31` -- the
              phone-only sibling of the head "Add a track" link above
              (DEC-919 wave-99 amendment); same handler, so opening it
              opens the exact same form below. */}
          <button
            type="button"
            className="chq-settings-drillrow-add"
            onClick={toggleAddTrack}
          >
            Add a track
          </button>
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
              className="chq-settings-section-action chq-link-button chq-settings-drillrow-head-hide"
              onClick={toggleAddRoom}
            >
              Add a room
            </button>
          </div>
          <ul className="chq-settings-edit-list">
            {rooms.map((room) => (
              <RoomEditRow
                key={room.id}
                room={room}
                draft={roomDrafts[room.id] ?? roomBaseline(room)}
                dirty={isRoomDirty(room)}
                rowErrors={roomRowErrors[room.id] ?? {}}
                saving={savingRoomId === room.id}
                deleteBlockers={roomDeleteBlockers[room.id] ?? {}}
                onNameChange={onRoomNameChange}
                onCapacityChange={onRoomCapacityChange}
                onSave={(r) => void saveRoom(r)}
                onCancel={cancelRoom}
                onDelete={(r) => void deleteRoom(r)}
              />
            ))}
          </ul>
          {/* docs/design/Chautauqua Settings.dc.html:382 `border:1px
              dashed #BAB6A6; border-radius:6px; min-height:44px;
              font-size:13px; font-weight:700; color:#4E5C31` -- the
              phone-only sibling of the head "Add a room" link above
              (DEC-919 wave-99 amendment); same handler, so opening it
              opens the exact same form below. */}
          <button
            type="button"
            className="chq-settings-drillrow-add"
            onClick={toggleAddRoom}
          >
            Add a room
          </button>
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
              {dirtyRowNames().join(', ')} {plural(dirtyRowNames().length, 'has', 'have')} unsaved edits. Each row
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
