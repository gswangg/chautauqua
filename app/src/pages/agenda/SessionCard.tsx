import type { CSSProperties, DragEvent } from 'react';
import type { AgendaConflict, AgendaSessionBase, AgendaTrack } from './types';
import { ConflictChip } from './ConflictChip';

export const AGENDA_DRAG_MIME = 'application/x-chq-submission-id';

interface SessionCardProps {
  session: AgendaSessionBase;
  tracks: AgendaTrack[];
  conflicts: AgendaConflict[];
  style?: CSSProperties;
  className?: string;
  /** Placed cards fully cover the day-grid cells beneath them (DEC-021
   * warn-never-block: an organizer must be able to drop a session directly
   * onto an already-occupied slot to intentionally create a room/speaker
   * conflict, since the conflict is only a warning, never a block). Without
   * these, the browser resolves the drop target to this card's own DOM
   * node instead of the grid cell underneath, and — because this card had
   * no onDrop handler — the drop was silently swallowed (verified via a
   * live browser drag: dropping a session directly onto an already-placed
   * card was a complete no-op, so a drag-drop conflict could never
   * actually be created through the UI). DayGrid passes its own
   * onDragOver/onDrop through so an occupied card is just as valid a drop
   * target as an empty cell. */
  onDragOver?: (e: DragEvent<HTMLButtonElement>) => void;
  onDrop?: (e: DragEvent<HTMLButtonElement>) => void;
  /** Shows the ⋮⋮ drag affordance in the card header (the unscheduled
   * tray's list-of-cards presentation; placed day-grid cards omit it). */
  dragHandle?: boolean;
  /** Keyboard/click placement path (DEC-570): clicking a card arms it
   * (nothing armed) or places the currently-armed session into this card's
   * slot (something armed). Optional so read-only presentations of a card
   * are unaffected. */
  onSelect?: () => void;
  /** True while this card is the currently-armed placement source. */
  selected?: boolean;
  /** True for cards already on the day grid (DEC-853): the click-to-select
   * gesture on these cards MOVES the session to a different slot, not an
   * initial placement — the accessible name says so. Unscheduled-tray cards
   * omit this (undefined), keeping the "choose a time slot" wording for a
   * first placement. */
  placed?: boolean;
}

/** Drag-drop AND keyboard-operable source card for a session (DEC-570/571):
 * the root is a real `<button>` so it's reachable by Tab and has an
 * accessible name, not just a `div[draggable]` invisible to the a11y tree.
 * The left accent is always the brand color; a conflicted card inverts to
 * ink/on-ink instead (DEC-367/369/571 — track identity is carried by the
 * track NAME rendered as text, never by a track color swatch). Draggable
 * via HTML5 DnD, carrying the submission id as plain text + a scoped MIME
 * type. */
export function SessionCard({ session, tracks, conflicts, style, className, onDragOver, onDrop, dragHandle, onSelect, selected, placed }: SessionCardProps) {
  const conflicted = conflicts.some((c) => c.submissionIds.includes(session.submissionId));
  const trackNames = tracks.filter((t) => session.trackIds.includes(t.id)).map((t) => t.name);
  // The placement path is click-to-arm (DEC-570), but nothing in the a11y tree
  // said so — both sbek runs never found manual placement (mandate coverage
  // item #1). Selectable cards now state the action in their accessible name.
  // DEC-853: a card already on the grid is a MOVE, not a first placement —
  // "choose a new slot" rather than "choose a time slot".
  const accessibleName = `${session.ref}: ${session.title}${conflicted ? ' (conflict)' : ''}${
    onSelect ? (placed ? ' — click to select, then choose a new slot' : ' — click to select, then choose a time slot') : ''
  }`;

  function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData(AGENDA_DRAG_MIME, session.submissionId);
    e.dataTransfer.setData('text/plain', session.submissionId);
    if ('startMin' in session && 'endMin' in session) {
      const placed = session as unknown as { startMin: number; endMin: number };
      e.dataTransfer.setData('application/x-chq-duration-min', String(placed.endMin - placed.startMin));
    }
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <button
      type="button"
      className={`chq-session-card${conflicted ? ' chq-session-card-conflict' : ''}${selected ? ' chq-session-card-selected' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      draggable
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      aria-label={accessibleName}
      aria-pressed={selected ? true : undefined}
      data-submission-id={session.submissionId}
      data-conflict={conflicted ? 'true' : undefined}
    >
      <div className="chq-session-card-head">
        <div className="chq-session-card-ref">{session.ref}</div>
        {dragHandle && (
          <span className="chq-session-card-handle" aria-hidden="true">
            ⋮⋮
          </span>
        )}
      </div>
      <div className="chq-session-card-title">{session.title}</div>
      {trackNames.length > 0 && (
        <div className="chq-session-card-tracks">{trackNames.join(', ')}</div>
      )}
      {session.speakers.length > 0 && (
        <div className="chq-session-card-speakers">
          {session.speakers.map((s) => s.name).join(', ')}
        </div>
      )}
      <ConflictChip conflicts={conflicts} submissionId={session.submissionId} />
    </button>
  );
}
