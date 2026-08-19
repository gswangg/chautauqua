import { Fragment, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { describeCondition, fieldsByIdMap } from './condition';
import { kindLabel, type EventTrack, type FormField } from './types';
// The FE form-builder module reads the SAME short-name test and length cap
// the API/pure core validate against (../../../../src/forms) so the
// builder's captions can never drift from the rule that actually enforces
// them -- e.g. the Abstract caption below always names the REAL
// MAX_LONG_TEXT_LENGTH, never a hand-copied number.
import { lockedFieldName, LOCKED_ABSTRACT_MAX_LENGTH } from '../../../../src/forms/types';
import { MAX_LONG_TEXT_LENGTH } from '../../../../src/forms/validate';
import { countOf } from '../../lib/plural';
import type { FormFieldRole } from './types';

// DEC-592/DEC-762/DEC-755 (wave 10, task w10-b): the builder's "Format"
// display label is keyed on the field's role (form_field.role), not its id
// -- role is the ONE matcher for the two well-known CFP fields, an event's
// session-format field can carry any id.
const DISPLAY_LABEL_OVERRIDES: Partial<Record<FormFieldRole, string>> = {
  session_format: 'Format',
};

/** Thousands-grouped integer, e.g. 20000 -> "20,000". A plain regex rather
 * than toLocaleString/Intl (banned outside lib/dates.ts, DEC-963) -- this
 * is a character-count grouping, not a locale-sensitive date/number. */
function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

interface FieldListProps {
  fields: FormField[];
  tracks: EventTrack[];
  busy: boolean;
  onEdit: (field: FormField) => void;
  onDelete: (field: FormField) => void;
  onMove: (field: FormField, direction: -1 | 1) => void;
}

// DEC-008/DEC-050: first_name/last_name/email are three separate locked
// FormField rows on the wire, but the mock renders them as a single quiet
// "Speaker name and email" row -- grouping is presentational only, it
// never touches field ids/positions/locked-field rules.
const SPEAKER_GROUP_NAMES = new Set(['first_name', 'last_name', 'email']);

// ONE named map (eval-findings item 51) for the remaining built-in
// captions -- 'description' is handled separately below (its caption
// names the REAL imported length cap, never a hardcoded number), and
// first_name/last_name/email collapse into the single speaker-group row
// above rather than appearing here.
const BUILT_IN_CAPTIONS: Record<string, string> = {
  title: 'Shown on every public page',
  job_title: "Shown on the speaker's public profile",
  company: "Shown on the speaker's public profile",
  bio: "Shown on the speaker's public profile",
};

interface DisplayRow {
  key: string;
  /** The field onEdit/onDelete/onMove act on; for the collapsed speaker
   * group this is the first (lowest-position) of the three grouped fields. */
  field: FormField;
  label: string;
  caption?: string;
  condition?: string;
  kindText: string;
  builtIn: boolean;
  /** True only for the synthesized Track row (below): it is a VIEW of the
   * event's tracks the public CFP already asks (TrackChoices in
   * src/routes/public/submit-views.tsx), never a real form_field row -- no
   * drag handle, no Edit/Delete, just a quiet link into the place tracks
   * are actually changed (Settings > Tracks & rooms). */
  viewOnly?: boolean;
  viewLink?: { to: string; label: string };
}

/** Kinds whose caption, when the field has no helpText of its own, states
 * how many options the field offers -- built from the field's own `options`
 * array (never a hand-maintained label), so it can never drift from the
 * options the field actually stores. */
const OPTION_COUNT_KINDS = new Set(['dropdown', 'checkbox']);

function optionCountCaption(field: FormField): string | undefined {
  if (!OPTION_COUNT_KINDS.has(field.kind)) return undefined;
  const count = field.options?.length ?? 0;
  return countOf(count, 'option');
}

/** A custom (non-locked) long_text field with no helpText of its own still
 * declares the budget that actually enforces it (DEC-124 amendment: "every
 * control" names its cap) -- the SPA wire type carries no per-field
 * `maximum` override, so this always names the shared MAX_LONG_TEXT_LENGTH
 * validate.ts falls back to. The locked Abstract row is handled separately
 * above with its own imported LOCKED_ABSTRACT_MAX_LENGTH, never this
 * generic fallback. */
function longTextCapCaption(field: FormField): string | undefined {
  if (field.kind !== 'long_text') return undefined;
  return `Up to ${formatThousands(MAX_LONG_TEXT_LENGTH)} characters`;
}

// DEC-008 amendment (w45-e): the public CFP renders a REQUIRED single-choice
// Track question (TrackChoices, src/routes/public/submit-views.tsx) whenever
// the event has tracks -- sourced from the event's tracks, never from a
// form_field row. The builder synthesizes the SAME row here, purely as a
// VIEW: no field id is minted, no PATCH/POST is ever issued for it, it is
// not editable/deletable/reorderable, and it carries a quiet link into the
// place tracks are actually changed (Settings > Tracks & rooms) instead of
// Edit/Delete. Gated on tracks.length > 0 to mirror DEC-301 (a form with no
// tracks configured offers no Track fieldset on the public side either).
function buildTrackRow(tracks: EventTrack[]): DisplayRow {
  const trackField: FormField = {
    id: '__track__',
    section: 'session',
    kind: 'dropdown',
    label: 'Track',
    required: true,
    position: -1,
    options: tracks.map((t) => t.name),
    locked: true,
  };
  return {
    key: 'built-in-track',
    field: trackField,
    label: 'Track',
    caption: optionCountCaption(trackField),
    kindText: kindLabel('dropdown'),
    builtIn: true,
    viewOnly: true,
    // frame-04 anatomy (w5-h): the link IS the row's Edit affordance (its
    // target stays the Settings tracks editor, since a track's real fields
    // live there, not in FieldModal) -- "Manage in Settings" no longer
    // stands in for the row's whole Edit/Delete pair.
    viewLink: { to: '/settings?section=tracks-rooms&edit=1', label: 'Edit' },
  };
}

/** Projects the form's raw field list into the mock's row anatomy: the
 * three locked speaker-identity fields collapse into one "Speaker name and
 * email" row, 'description' renders as "Abstract" with the real imported
 * length cap plus a synthesized Track row immediately after it (frame 04's
 * Title -> Abstract -> Track order), and the rest of the DEC-008 locked
 * built-ins get a quiet caption from BUILT_IN_CAPTIONS instead of a LOCKED
 * pill. Every other field (custom, non-locked) keeps its own label/kind/
 * required and its caption is its own helpText, per field, with the
 * conditional-visibility summary rendered as a second line when a rule
 * exists. */
function buildRows(fields: FormField[], tracks: EventTrack[]): DisplayRow[] {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const fieldsById = fieldsByIdMap(fields);
  const rows: DisplayRow[] = [];
  let speakerGroupRendered = false;

  for (const field of ordered) {
    const shortName = field.locked ? (lockedFieldName(field.id) ?? field.id) : null;

    if (shortName && SPEAKER_GROUP_NAMES.has(shortName)) {
      if (speakerGroupRendered) continue;
      speakerGroupRendered = true;
      rows.push({
        key: 'built-in-speaker-name-email',
        field,
        label: 'Speaker name and email',
        caption: 'Creates or matches a contact',
        kindText: 'Built in',
        builtIn: true,
      });
      continue;
    }

    if (shortName === 'description') {
      rows.push({
        key: field.id,
        field,
        label: 'Abstract',
        caption: `Up to ${formatThousands(LOCKED_ABSTRACT_MAX_LENGTH)} characters`,
        kindText: kindLabel(field.kind),
        builtIn: true,
      });
      if (tracks.length > 0) {
        rows.push(buildTrackRow(tracks));
      }
      continue;
    }

    if (shortName && BUILT_IN_CAPTIONS[shortName]) {
      rows.push({
        key: field.id,
        field,
        label: field.label,
        caption: BUILT_IN_CAPTIONS[shortName],
        kindText: kindLabel(field.kind),
        builtIn: true,
      });
      continue;
    }

    rows.push({
      key: field.id,
      field,
      label: (field.role && DISPLAY_LABEL_OVERRIDES[field.role]) ?? field.label,
      caption: field.helpText || optionCountCaption(field) || longTextCapCaption(field),
      condition: field.rule ? describeCondition(field.rule, fieldsById) : undefined,
      kindText: kindLabel(field.kind),
      builtIn: field.locked,
    });
  }

  return rows;
}

/** Ordered field list for the form builder (eval-findings item 51 / DEC-715
 * row-anatomy rebuild): one-line rows -- handle, field name + one-line
 * caption, kind, REQUIRED/OPTIONAL, Edit/Delete inline at the right. The
 * drag handle is a real <button> (DEC-715): the ONE reorder affordance on
 * the row, operable by pointer (click focuses it) and keyboard
 * (ArrowUp/ArrowDown call the existing onMove(field, -1|1) contract) --
 * there are no separate up/down buttons. */
export function FieldList({ fields, tracks, busy, onEdit, onDelete, onMove }: FieldListProps) {
  // Frame-04 anatomy (w5-h): every SPEAKER-section field (the collapsed
  // "Speaker name and email" row plus the three DEC-321 profile extras --
  // job_title/company/bio) folds under a "You" group, trailing every
  // SESSION-section question (Title/Abstract/Track/custom talk fields) --
  // rather than interleaving by raw position, which let a talk question
  // land after the speaker-profile rows whenever its position number was
  // higher than job_title/company/bio's. Grouping is presentational only:
  // `rows` stays the ONE flat array both the drag-drop index math and the
  // render loop below share, just reordered.
  const allRows = buildRows(fields, tracks);
  const sessionRows = allRows.filter((r) => r.field.section !== 'speaker');
  const speakerRows = allRows.filter((r) => r.field.section === 'speaker');
  const rows = [...sessionRows, ...speakerRows];
  // The row currently under a dragged field (DEC-903 visible insertion
  // point) -- cleared on drop/leave, never persisted past the drag gesture.
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Drag-drop reorder (same contract as DayGrid.tsx): dragstart stamps the
  // dragged field's id on text/plain, dragover marks a valid drop target,
  // drop reads the id back, finds both rows' indices, and calls the SAME
  // onMove(field, delta) the keyboard path already uses -- one reorder write
  // path, so the optimistic update/rollback in FormsPage stays written once.
  function handleDragStart(event: DragEvent, row: DisplayRow) {
    if (busy || row.field.locked) return;
    event.dataTransfer.setData('text/plain', row.field.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent, row: DisplayRow) {
    if (busy || row.field.locked) return;
    event.preventDefault();
    if (dragOverKey !== row.key) setDragOverKey(row.key);
  }

  function handleDragLeave(row: DisplayRow) {
    setDragOverKey((current) => (current === row.key ? null : current));
  }

  function handleDrop(event: DragEvent, targetRow: DisplayRow, targetIndex: number) {
    setDragOverKey(null);
    if (busy || targetRow.field.locked) return;
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain');
    if (!draggedId) return;
    const sourceIndex = rows.findIndex((r) => r.field.id === draggedId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const sourceRow = rows[sourceIndex]!;
    const delta = targetIndex - sourceIndex;
    onMove(sourceRow.field, delta > 0 ? 1 : -1);
  }

  return (
    <div className="chq-forms-field-list" role="list">
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index === sessionRows.length && speakerRows.length > 0 && (
            <div className="chq-forms-field-group-header" role="presentation">
              You
            </div>
          )}
          <div
            role="listitem"
            className={[
              'chq-forms-field-row',
              row.builtIn ? 'chq-forms-field-locked' : null,
              dragOverKey === row.key ? 'chq-forms-field-row-drop-target' : null,
            ]
              .filter(Boolean)
              .join(' ')}
            onDragOver={(event) => handleDragOver(event, row)}
            onDragLeave={() => handleDragLeave(row)}
            onDrop={(event) => handleDrop(event, row, index)}
          >
            {/* frame-04 anatomy (w5-h): every row, the synthesized Track
                view included, gets the SAME ⋮⋮ handle -- Track's is simply
                disabled (there is no real position to drag; its rows are a
                view over the event's tracks, not a form_field). One handle
                shape for every row, never a second inert placeholder
                markup. */}
            <button
              type="button"
              className="chq-forms-field-drag"
              aria-label={`Reorder ${row.label} (position ${index + 1} of ${rows.length})`}
              disabled={busy || row.field.locked}
              draggable={!(busy || row.field.locked)}
              onDragStart={(event) => handleDragStart(event, row)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  onMove(row.field, -1);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  onMove(row.field, 1);
                }
              }}
            >
              ⋮⋮
            </button>

            <div className="chq-forms-field-label">
              <span className="chq-forms-field-label-text">{row.label}</span>
              {row.caption && <span className="chq-forms-field-help">{row.caption}</span>}
              {row.condition && <span className="chq-forms-field-condition">{row.condition}</span>}
              {/* v12 phone frame (docs/design/Chautauqua Submissions.dc.html:479
                  `<span style="font-size:12px; color:#565A4B">{{ f.type }} · {{ f.req }}</span>`):
                  a SECOND markup, not a text swap over the desktop kind/required
                  columns (DEC-390 phone-selector precedent) -- hidden at desktop,
                  shown in place of the desktop kind/required/help/condition lines
                  once forms.css's 700px block collapses them below the row's own
                  measure. */}
              <span className="chq-forms-field-phone-meta">
                {row.kindText} · {row.field.required ? 'Required' : 'Optional'}
              </span>
            </div>

            <span className="chq-forms-field-kind">{row.kindText}</span>

            <span className={row.field.required ? 'chq-forms-field-required' : 'chq-forms-field-optional'}>
              {row.field.required ? 'Required' : 'Optional'}
            </span>

            <div className="chq-forms-field-actions">
              {row.viewOnly && row.viewLink ? (
                // frame-04 anatomy (w5-h): Track keeps the row's real
                // Edit/Delete PAIR -- an active Edit link (its target is
                // the Settings tracks editor, where a track's own fields
                // live) alongside a greyed Delete, matching every other
                // built-in row instead of one link standing in for both.
                <>
                  <Link to={row.viewLink.to} className="chq-btn chq-btn-tertiary">
                    {row.viewLink.label}
                  </Link>
                  <button type="button" className="chq-btn chq-btn-tertiary" disabled>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  {/* frame-04 anatomy (w5-h): a built-in/locked row's Edit
                      stays active (green) -- only Delete greys out, since
                      DEC-016 locked fields are non-removable, not
                      non-editable. */}
                  <button
                    type="button"
                    className="chq-btn chq-btn-tertiary"
                    disabled={busy}
                    onClick={() => onEdit(row.field)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="chq-btn chq-btn-tertiary"
                    disabled={busy || row.field.locked}
                    onClick={() => onDelete(row.field)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
