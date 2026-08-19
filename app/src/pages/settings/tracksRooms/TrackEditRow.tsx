// One drilled-edit-list row for a track, split out of TracksRoomsPanel.tsx
// (custodian decomposition) -- pure rendering, all state lives in the
// useTracksRoomsPanel hook and is threaded through as props.
import { MAX_NAME_LENGTH } from '../../../../../src/forms/validate';
import { ErrorSummary, countHeading } from '../../../components/ErrorSummary';
import type { TrackForm, TrackFormErrors } from '../formState';
import { swatchLabel } from './trackSwatches';
import { TRACK_FIELD_KEYS, unownedFieldEntries, type Track } from './types';

export interface TrackEditRowProps {
  track: Track;
  draft: TrackForm;
  dirty: boolean;
  rowErrors: TrackFormErrors;
  saving: boolean;
  deleteBlockers: Record<string, string>;
  onSwatchCycle: (trackId: string, draft: TrackForm) => void;
  onNameChange: (trackId: string, draft: TrackForm, value: string) => void;
  onSave: (track: Track) => void;
  onCancel: (track: Track) => void;
  onDelete: (track: Track) => void;
}

export function TrackEditRow({
  track,
  draft,
  dirty,
  rowErrors,
  saving,
  deleteBlockers,
  onSwatchCycle,
  onNameChange,
  onSave,
  onCancel,
  onDelete,
}: TrackEditRowProps) {
  // DEC-896 amendment (wave 26): a track with submissions cannot be
  // removed -- disabled, not hidden, with the reason on the row.
  const inUse = track.submissionCount > 0;
  const rowUnowned = unownedFieldEntries(rowErrors, TRACK_FIELD_KEYS);
  const rowSummaryProblems = [
    rowErrors.name ? { anchorId: `chq-track-name-${track.id}`, label: rowErrors.name } : null,
    rowErrors.color ? { anchorId: `chq-track-color-${track.id}`, label: rowErrors.color } : null,
  ].filter((p): p is { anchorId: string; label: string } => p !== null);
  return (
    <li className="chq-settings-edit-row chq-settings-track-edit-row">
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
          onClick={() => onSwatchCycle(track.id, draft)}
        />
        <input
          id={`chq-track-name-${track.id}`}
          className={rowErrors.name ? 'chq-input chq-field-invalid' : 'chq-input'}
          value={draft.name}
          onChange={(e) => onNameChange(track.id, draft, e.target.value)}
          aria-label={`Track name for ${track.name}`}
          aria-invalid={rowErrors.name ? 'true' : undefined}
          maxLength={MAX_NAME_LENGTH}
        />
      </span>
      <span className="chq-settings-edit-row-meta">{track.submissionCount} submissions</span>
      <span className="chq-settings-edit-row-actions">
        {dirty ? (
          <>
            <button type="button" className="chq-link-button" onClick={() => onSave(track)} disabled={saving}>
              Save
            </button>
            <button type="button" className="chq-link-button" onClick={() => onCancel(track)} disabled={saving}>
              Cancel
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="chq-link-button"
          onClick={() => onDelete(track)}
          disabled={inUse}
          title={inUse ? 'A track in use cannot be removed — retire it instead' : undefined}
        >
          Remove
        </button>
      </span>
      {inUse ? <p className="chq-settings-row-hint">In use — retire it instead of removing</p> : null}
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
