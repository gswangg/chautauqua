// Pure formatting helper for the DEC-051 calendar-invite chip shown per
// recipient in PreviewPane. Kept side-effect free (no DOM) so it's
// independently testable; startUtc/endUtc are ISO-8601 strings as the
// server sends them, formatted in the browser's local timezone.

export interface IcsChipInfo {
  startUtc: string;
  endUtc: string;
  room?: string | null;
  sequence: number;
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Renders "<local start> - <local end> · <room|room TBD>[ · update #N]". */
export function formatIcsChip(ics: IcsChipInfo): string {
  const range = `${formatLocal(ics.startUtc)} - ${formatLocal(ics.endUtc)}`;
  const room = ics.room && ics.room.trim().length > 0 ? ics.room : 'room TBD';
  const parts = [range, room];
  if (ics.sequence > 0) {
    parts.push(`update #${ics.sequence}`);
  }
  return parts.join(' · ');
}
