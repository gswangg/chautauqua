// One drilled-edit-list row for a room, split out of TracksRoomsPanel.tsx
// (custodian decomposition) -- pure rendering, all state lives in the
// useTracksRoomsPanel hook and is threaded through as props.
import { MAX_NAME_LENGTH } from '../../../../../src/forms/validate';
import { ErrorSummary, countHeading } from '../../../components/ErrorSummary';
import type { RoomForm, RoomFormErrors } from '../formState';
import { ROOM_FIELD_KEYS, unownedFieldEntries, type Room } from './types';

export interface RoomEditRowProps {
  room: Room;
  draft: RoomForm;
  dirty: boolean;
  rowErrors: RoomFormErrors;
  saving: boolean;
  deleteBlockers: Record<string, string>;
  onNameChange: (roomId: string, draft: RoomForm, value: string) => void;
  onCapacityChange: (roomId: string, draft: RoomForm, value: string) => void;
  onSave: (room: Room) => void;
  onCancel: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export function RoomEditRow({
  room,
  draft,
  dirty,
  rowErrors,
  saving,
  deleteBlockers,
  onNameChange,
  onCapacityChange,
  onSave,
  onCancel,
  onDelete,
}: RoomEditRowProps) {
  // DEC-896 amendment (wave 26): a room with scheduled sessions
  // cannot be removed -- disabled, not hidden, reason on the row.
  const inUse = room.sessionCount > 0;
  const rowUnowned = unownedFieldEntries(rowErrors, ROOM_FIELD_KEYS);
  const rowSummaryProblems = [
    rowErrors.name ? { anchorId: `chq-room-name-${room.id}`, label: rowErrors.name } : null,
    rowErrors.capacity ? { anchorId: `chq-room-capacity-${room.id}`, label: rowErrors.capacity } : null,
  ].filter((p): p is { anchorId: string; label: string } => p !== null);
  return (
    <li className="chq-settings-edit-row chq-settings-room-edit-row">
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
          onChange={(e) => onNameChange(room.id, draft, e.target.value)}
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
          onChange={(e) => onCapacityChange(room.id, draft, e.target.value)}
          aria-label={`Capacity for ${room.name}`}
          aria-invalid={rowErrors.capacity ? 'true' : undefined}
        />
      </span>
      <span className="chq-settings-edit-row-meta" />
      <span className="chq-settings-edit-row-actions">
        {dirty ? (
          <>
            <button type="button" className="chq-link-button" onClick={() => onSave(room)} disabled={saving}>
              Save
            </button>
            <button type="button" className="chq-link-button" onClick={() => onCancel(room)} disabled={saving}>
              Cancel
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="chq-link-button"
          onClick={() => onDelete(room)}
          disabled={inUse}
          title={inUse ? 'A room with scheduled sessions cannot be removed' : undefined}
        >
          Remove
        </button>
      </span>
      {inUse ? <p className="chq-settings-row-hint">Has scheduled sessions — cannot be removed</p> : null}
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
      {Object.entries(deleteBlockers).map(([key, value]) => (
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
}
