import type { CSSProperties, DragEvent } from 'react';
import type { AgendaConflict, AgendaSessionBase } from './types';
import { ConflictChip } from './ConflictChip';

export const AGENDA_DRAG_MIME = 'application/x-chq-submission-id';

interface SessionCardProps {
  session: AgendaSessionBase;
  conflicts: AgendaConflict[];
  /** DEC-571 amendment (wave 72): the frame prints duration inline on the
   * ref line, `DFC-033 · 10 min`, not as a dangling sibling paragraph
   * beside the card. Optional — placed grid cards don't pass it since the
   * grid geometry already encodes duration as the card's height. */
  durationMin?: number;
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
  /** DEC-903 (wave-63 amendment): while another session is armed for
   * click-to-place, a placed card's accessible name must state what
   * clicking it will actually do (place the ARMED session into this
   * card's own slot, possibly clashing) instead of the generic "click to
   * select, then choose a new slot" — callers compute the same wording the
   * twin cell button uses and pass it here as a full override. Undefined
   * when nothing is armed, leaving the default name untouched. */
  armedLabel?: string;
  /** DEC-903 (wave-63 amendment): fires `true` on this card's own
   * dragstart and `false` on its dragend, so a container (DayGrid) can
   * track which card is mid-drag without owning the dataTransfer payload
   * itself — SessionCard keeps the HTML5 DnD wiring, the parent only
   * observes the boolean. */
  onDragStateChange?: (dragging: boolean) => void;
}

/** Drag-drop AND keyboard-operable source card for a session (DEC-570/571):
 * the root is a real `<button>` so it's reachable by Tab and has an
 * accessible name, not just a `div[draggable]` invisible to the a11y tree.
 * The left accent is always the brand color; a conflicted card inverts to
 * ink/on-ink instead (DEC-367/369/571 — track identity is carried by the
 * track NAME rendered as text, never by a track color swatch). Draggable
 * via HTML5 DnD, carrying the submission id as plain text + a scoped MIME
 * type. */
export function SessionCard({ session, conflicts, durationMin, style, className, onDragOver, onDrop, onSelect, selected, placed, armedLabel, onDragStateChange }: SessionCardProps) {
  const conflicted = conflicts.some((c) => c.submissionIds.includes(session.submissionId));
  // The placement path is click-to-arm (DEC-570), but nothing in the a11y tree
  // said so — both sbek runs never found manual placement (mandate coverage
  // item #1). Selectable cards now state the action in their accessible name.
  // DEC-853: a card already on the grid is a MOVE, not a first placement —
  // "choose a new slot" rather than "choose a time slot". DEC-903 (wave-63
  // amendment): while something else is armed, `armedLabel` — the same
  // wording the twin cell button uses — replaces this whole computed name
  // rather than being appended to it, since the click's actual effect (place
  // the ARMED session here) has nothing to do with THIS card's own ref/title.
  const accessibleName =
    armedLabel ??
    `${session.ref}: ${session.title}${conflicted ? ' (conflict)' : ''}${
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
    onDragStateChange?.(true);
  }

  function handleDragEnd() {
    onDragStateChange?.(false);
  }

  return (
    <button
      type="button"
      className={`chq-session-card${conflicted ? ' chq-session-card-conflict' : ''}${selected ? ' chq-session-card-selected' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      aria-label={accessibleName}
      aria-pressed={selected ? true : undefined}
      data-submission-id={session.submissionId}
      data-conflict={conflicted ? 'true' : undefined}
    >
      <div className="chq-session-card-head">
        <div className="chq-session-card-ref">
          {durationMin != null ? `${session.ref} · ${durationMin} min` : session.ref}
        </div>
      </div>
      <div className="chq-session-card-title">{session.title}</div>
      {session.speakers.length > 0 && (
        <div className="chq-session-card-speakers">
          {session.speakers.map((s) => s.name).join(', ')}
        </div>
      )}
      <ConflictChip conflicts={conflicts} submissionId={session.submissionId} />
    </button>
  );
}
