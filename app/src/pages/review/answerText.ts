// DEC-561: renders an arbitrary CFP custom-answer value (session or speaker
// side) as human text for the reviewer's Scorecard. Kept dependency-free so
// it stays unit-testable without a DOM.

const EM_DASH = '—';

export function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return EM_DASH;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => formatAnswerValue(v)).join(', ');
  return JSON.stringify(value);
}
