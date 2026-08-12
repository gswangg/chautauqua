// Pure formatting helper for the DEC-051 calendar-invite chip shown per
// recipient in PreviewPane. Kept side-effect free (no DOM) so it's
// independently testable; startUtc/endUtc are ISO-8601 strings as the
// server sends them. DEC-494: formatted in the OWNING EVENT's timezone
// (never the viewer's ambient machine zone) so an organizer proofreading a
// notification sees the same wall-clock time the speaker will see.

import { formatDateTimeInZone } from '../../lib/dates';

export interface IcsChipInfo {
  startUtc: string;
  endUtc: string;
  room?: string | null;
  sequence: number;
  timeZone: string;
}

function formatLocal(iso: string, timeZone: string): string {
  return formatDateTimeInZone(iso, timeZone);
}

// ECMA-402 rejects combining dateStyle/timeStyle with timeZoneName in one
// Intl.DateTimeFormat call ("Invalid option : option"), so the short zone
// abbreviation (e.g. "PDT") is resolved with a second, minimal formatter
// and appended by hand.
function zoneAbbreviation(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'short', hour: 'numeric' }).formatToParts(new Date(iso));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timeZone;
}

/** Renders "<event-tz start> - <event-tz end> · <room|room TBD>[ · update #N]". */
export function formatIcsChip(ics: IcsChipInfo): string {
  const start = `${formatLocal(ics.startUtc, ics.timeZone)} ${zoneAbbreviation(ics.startUtc, ics.timeZone)}`;
  const end = formatLocal(ics.endUtc, ics.timeZone);
  const range = `${start} - ${end}`;
  const room = ics.room && ics.room.trim().length > 0 ? ics.room : 'room TBD';
  const parts = [range, room];
  if (ics.sequence > 0) {
    parts.push(`update #${ics.sequence}`);
  }
  return parts.join(' · ');
}
