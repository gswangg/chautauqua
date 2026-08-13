// Pure mapping helpers for SubmissionDetailPage (DEC-045): turn the
// SubmissionDetail.answers record (keyed by form_field id) into
// display-ready rows labeled via the event's CFP form fields. Locked
// built-in fields (title/description/...) never appear here — they arrive
// as real SubmissionDetail columns per DEC-016, not in `answers`.
import { formatAnswerValue } from './columns';
import type { FormField } from './types';

export interface CfpFormLike {
  id: string;
  fields: FormField[];
}

export interface AnswerRow {
  fieldId: string;
  label: string;
  displayValue: string;
}

/**
 * Resolve the field list to use for labeling a submission's answers. The
 * event's default CFP form is only meaningful if it's the exact form the
 * submission was submitted against (detail.formId) — otherwise there's no
 * reliable label source and every answer falls back to its raw key.
 */
export function resolveAnswerFields(form: CfpFormLike | null, formId: string | null): FormField[] {
  if (!form || !formId || form.id !== formId) return [];
  return form.fields;
}

/**
 * Build labeled rows for a submission's dynamic answers, sorted by the
 * matching field's position (author-defined order); answers with no
 * matching field (fall back to the raw key) sort after all matched ones,
 * in raw key order.
 */
export function buildAnswerRows(answers: Record<string, unknown>, fields: FormField[]): AnswerRow[] {
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  return Object.entries(answers)
    .map(([fieldId, value]) => {
      const field = fieldById.get(fieldId);
      return {
        fieldId,
        label: field?.label ?? fieldId,
        displayValue: formatAnswerValue(value),
        position: field?.position ?? Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.fieldId.localeCompare(b.fieldId);
    })
    .map(({ fieldId, label, displayValue }) => ({ fieldId, label, displayValue }));
}

// DEC-780: placement line, e.g. "Tue 12 May, 10:00–10:30 · Room 2A". day and
// startMin/endMin are already expressed in the owning event's timezone at
// the schema level (schedule_slot.day is 'YYYY-MM-DD', start/endMin are
// minutes-from-midnight, both in event-local time) — no further zone
// conversion happens client-side, unlike an epoch-ms instant. day is parsed
// against UTC-midnight (same day-not-instant contract as formatCalendarDate
// in src/lib/event-time.ts) so the viewer's ambient zone never shifts the
// calendar date. A null roomName (DEC-010: TBD is a real value) omits the
// ' · room' clause entirely rather than leaving a dangling separator.
export interface SlotLike {
  day: string;
  startMin: number;
  endMin: number;
  roomName: string | null;
}

function formatSlotMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatPlacementLine(slot: SlotLike): string {
  // en-US Intl formatting orders as "Tue, May 12" (month before day, comma
  // after weekday) -- the wanted grammar is "Tue 12 May" (day before
  // month, no comma), so weekday/day/month are read as separate parts and
  // assembled in that order rather than trusting the locale's combined
  // string.
  const [y, m, d] = slot.day.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(Date.UTC(y!, m! - 1, d!)));
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const dayLabel = `${weekday} ${day} ${month}`;
  const timeLabel = `${formatSlotMinutes(slot.startMin)}–${formatSlotMinutes(slot.endMin)}`;
  const base = `${dayLabel}, ${timeLabel}`;
  return slot.roomName ? `${base} · ${slot.roomName}` : base;
}
