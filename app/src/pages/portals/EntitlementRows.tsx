// The "count × format × minutes" row editor (Portals frame, flow 5, the
// Edit tier modal): a tier's entitlements, and a sponsor's own extras on
// top of its tier. Formats come from the CFP's session formats; a format
// that states its length ("Workshop (120 min)") sets the minutes the way
// the server and the scheduler read it (formatMinutes, the scheduler's own
// parser), and only a format with no length offers a length select.
import { formatMinutes, formatNoun } from '../../../../src/domain/sponsors';
import { MAX_ENTITLEMENT_COUNT, MAX_ENTITLEMENT_ROWS } from '../../lib/domain-caps';
import type { Entitlement, EntitlementInput } from './types';

export interface EntitlementDraft {
  // local React key; `id` is the saved row's id, kept so the sessions
  // holding it keep their slots
  key: string;
  id?: string;
  count: number;
  format: string;
  minutes: number | null;
}

// Lengths offered for a format that doesn't state one.
const LENGTH_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

let draftSeq = 0;
function nextKey(): string {
  draftSeq += 1;
  return `row-${draftSeq}`;
}

export function draftsFrom(rows: Pick<Entitlement, 'id' | 'count' | 'format' | 'minutes'>[]): EntitlementDraft[] {
  return rows.map((r) => ({ key: nextKey(), id: r.id, count: r.count, format: r.format, minutes: r.minutes }));
}

export function draftsToInput(rows: EntitlementDraft[]): EntitlementInput[] {
  return rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), count: r.count, format: r.format, minutes: r.minutes }));
}

/** A stable fingerprint, to tell an edited list from the saved one. */
export function draftsSignature(rows: EntitlementDraft[]): string {
  return JSON.stringify(draftsToInput(rows));
}

export function newDraft(formats: string[]): EntitlementDraft {
  const format = formats[0] ?? '';
  return { key: nextKey(), count: 1, format, minutes: formatMinutes(format) };
}

/** The option label for a format: its noun ("Talk"), unless two formats
 * share that noun, when the full label tells them apart. */
function formatOptionLabel(format: string, all: string[]): string {
  const noun = formatNoun(format, true);
  const clash = all.filter((f) => formatNoun(f, true) === noun).length > 1;
  return clash ? format : noun;
}

interface EntitlementRowsProps {
  idPrefix: string;
  rows: EntitlementDraft[];
  formats: string[];
  onChange: (rows: EntitlementDraft[]) => void;
  disabled?: boolean;
}

export function EntitlementRows({ idPrefix, rows, formats, onChange, disabled = false }: EntitlementRowsProps) {
  function update(key: string, patch: Partial<EntitlementDraft>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function changeFormat(row: EntitlementDraft, format: string) {
    // a format that states its length sets it; one that doesn't keeps
    // whatever length the row already had
    update(row.key, { format, minutes: formatMinutes(format) ?? row.minutes });
  }

  const counts = Array.from({ length: MAX_ENTITLEMENT_COUNT }, (_, i) => i + 1);

  return (
    <div className="chq-entitlement-rows">
      {rows.map((row, i) => {
        // a saved row whose format has since left the CFP stays choosable
        const options = formats.includes(row.format) || row.format === '' ? formats : [row.format, ...formats];
        const stated = formatMinutes(row.format);
        const n = i + 1;
        return (
          <div className="chq-entitlement-row" key={row.key}>
            <select
              id={`${idPrefix}-count-${n}`}
              className="chq-select"
              aria-label={`Row ${n} count`}
              value={row.count}
              disabled={disabled}
              onChange={(e) => update(row.key, { count: Number(e.target.value) })}
            >
              {counts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              id={`${idPrefix}-format-${n}`}
              className="chq-select"
              aria-label={`Row ${n} session type`}
              value={row.format}
              disabled={disabled}
              onChange={(e) => changeFormat(row, e.target.value)}
            >
              {options.map((f) => (
                <option key={f} value={f}>
                  {formatOptionLabel(f, options)}
                </option>
              ))}
            </select>
            {stated !== null ? (
              <span className="chq-entitlement-length" title="Set by the format">
                {stated} min
              </span>
            ) : (
              <select
                id={`${idPrefix}-minutes-${n}`}
                className="chq-select"
                aria-label={`Row ${n} length`}
                value={row.minutes ?? ''}
                disabled={disabled}
                onChange={(e) => update(row.key, { minutes: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">Any length</option>
                {[...new Set([...(row.minutes !== null ? [row.minutes] : []), ...LENGTH_CHOICES])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
              </select>
            )}
            <button
              type="button"
              className="chq-link-button chq-entitlement-remove"
              aria-label={`Remove row ${n}`}
              disabled={disabled}
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            >
              Remove
            </button>
          </div>
        );
      })}
      {formats.length > 0 && rows.length < MAX_ENTITLEMENT_ROWS ? (
        <button
          type="button"
          className="chq-link-button chq-entitlement-add"
          disabled={disabled}
          onClick={() => onChange([...rows, newDraft(formats)])}
        >
          Add a session type
        </button>
      ) : null}
    </div>
  );
}
