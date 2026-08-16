/**
 * Scheduling engine (DEC-010): warn-never-block conflict detection + greedy
 * auto-schedule. Pure module — no node:/cloudflare imports (DEC-002).
 */

import { DEC_130, DEC_476, DEC_615, DEC_772 } from "../decisions";
import { plural } from "./count-copy";
void DEC_130;
void DEC_476;
void DEC_615;
void DEC_772;

/** DEC-772: extracts the integer minute duration from a parenthesised
 * "(N min)"/"(N mins)"/"(N minutes)" suffix on a session-format option
 * label, e.g. "Keynote (45 min)" -> 45. Case-insensitive. Returns null
 * when absent or non-positive — callers fall back to the event's default
 * duration, never invent a length. */
export function parseFormatDurationMin(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/\((\d+)\s*(?:min|mins|minutes)\)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** DEC-476: single source of truth for the day boundary in minutes. Every
 * schedule-slot writer and the auto-schedule bounds share this constant so
 * the two bounds cannot drift apart. */
export const MINUTES_PER_DAY = 1440;

// DEC-422 (wave-67 amendment): the per-event schedule-break ceiling --
// moved out of src/server/repo/breaks.ts (a drizzle-importing repo module
// the SPA cannot import) so BreaksPanel's add-break control can disclose
// it. Bounded scan + loud refusal on the read side (breaks.ts) is
// unchanged; only the declaration moved.
export const MAX_BREAKS_PER_EVENT = 200;

export interface PlacedSession {
  submissionId: string;
  roomId: string | null;
  day: string;
  startMin: number;
  endMin: number;
  speakerContactIds: string[];
}

export type ConflictKind = "room_overlap" | "speaker_overlap" | "break_overlap";

export interface Conflict {
  kind: ConflictKind;
  /** Exactly 2 ids for room_overlap/speaker_overlap; exactly 1 for
   * break_overlap (DEC-557 wave-71/69 amendments). */
  submissionIds: string[];
  day: string;
  roomId: string | null;
  speakerContactIds: string[];
  /** Set only on break_overlap; null on the pair kinds (explicit, matching
   * roomId/speakerContactIds' own explicit-null convention). */
  breakId: string | null;
  breakLabel: string | null;
}

/** DEC-557 (wave 69): an event-defined non-bookable window findConflicts
 * checks placed sessions against — the same fact autoSchedule/nextFreeSlot
 * already refuse to place into (BlockedInterval above), plus the id/label a
 * break_overlap conflict must carry. */
export interface ScheduleBlock {
  breakId: string;
  label: string;
  day: string;
  startMin: number;
  endMin: number;
}

/** DEC-557: label lookups used by describeConflict to render a Conflict as
 * prose. An unresolved id falls back to the raw id rather than blanking. */
export interface ConflictLabels {
  roomNameById: Map<string, string>;
  titleBySubmissionId: Map<string, string>;
  speakerNameByContactId: Map<string, string>;
}

/** DEC-557: the ONE place a Conflict becomes human-readable prose. Never
 * emits a raw id when the corresponding label map resolves it. */
export function describeConflict(c: Conflict, labels: ConflictLabels): string {
  const idA = c.submissionIds[0];
  if (idA === undefined) {
    throw new Error("describeConflict: submissionIds must carry at least one id");
  }
  const titleA = labels.titleBySubmissionId.get(idA) ?? idA;

  if (c.kind === "break_overlap") {
    return `"${titleA}" scheduled over the break "${c.breakLabel ?? c.breakId ?? "unknown break"}" on ${c.day}`;
  }

  const idB = c.submissionIds[1];
  if (idB === undefined) {
    throw new Error("describeConflict: room_overlap/speaker_overlap must carry two ids");
  }
  const titleB = labels.titleBySubmissionId.get(idB) ?? idB;

  if (c.kind === "room_overlap") {
    const roomName =
      (c.roomId !== null ? labels.roomNameById.get(c.roomId) : undefined) ??
      c.roomId ??
      "unknown room";
    return `Room "${roomName}" double-booked on ${c.day} between "${titleA}" and "${titleB}"`;
  }

  const speakerNames = c.speakerContactIds.map(
    (id) => labels.speakerNameByContactId.get(id) ?? id,
  );
  return `${plural(speakerNames.length, "Speaker")} ${speakerNames.join(", ")} double-booked on ${c.day} between "${titleA}" and "${titleB}"`;
}

/** DEC-615: closed vocabulary for why autoSchedule could not place a
 * session. The enum never carries prose — describeUnplaced is the ONE
 * renderer, mirroring describeConflict above. */
export type UnplacedReason =
  | "no_rooms_configured"
  | "duration_exceeds_day"
  | "no_free_slot"
  | "speaker_double_booked"
  // DEC-492 (wave 46 amendment): the placer found a slot for this session,
  // but the run's per-request write-burst cap (MAX_AUTO_SCHEDULE_PLACEMENTS)
  // was already exhausted by earlier placements — the tail is reported
  // here instead of silently discarded.
  | "write_cap_reached"
  // DEC-615 (wave 43 amendment): the session already carries a persisted
  // schedule_slot, but that slot's day falls outside the event's current
  // [startDate, endDate] window (DEC-318: unpublishable). The placer must
  // never touch it (onConflictDoNothing forbids overwriting an existing
  // schedule_slot row per DEC-552/DEC-492), so it is named here instead of
  // silently re-placed or silently dropped.
  | "slot_outside_event_range"
  // DEC-615 (wave 47 amendment): the accounting reconciliation in
  // runAutoSchedule found this id unplaced in the payload's SECOND read
  // (taken after the write) but not in this run's own reason list or its
  // read-time snapshot — a concurrent accept/unaccept/slot edit by another
  // producer changed the population mid-run. Not a bug: re-run to place it.
  | "changed_during_run";

export interface UnplacedSession {
  submissionId: string;
  reason: UnplacedReason;
}

/** DEC-615: label lookups describeUnplaced needs to render an UnplacedReason
 * as prose. An unresolved id falls back to the raw id rather than blanking,
 * matching describeConflict's convention. */
export interface UnplacedLabels {
  titleBySubmissionId: Map<string, string>;
  speakerNameByContactId: Map<string, string>;
}

/** DEC-615: the ONE place an UnplacedReason becomes human-readable prose.
 * Copy rule: name the constraint, promise nothing — never advice about
 * widening the day or adding rooms. */
export function describeUnplaced(
  reason: UnplacedReason,
  labels: UnplacedLabels,
  session: { submissionId: string; durationMin: number },
): string {
  const title = labels.titleBySubmissionId.get(session.submissionId) ?? session.submissionId;
  switch (reason) {
    case "no_rooms_configured":
      return `"${title}" not placed: no rooms are configured for this event`;
    case "duration_exceeds_day":
      return `"${title}" not placed: its ${session.durationMin}-minute duration exceeds the scheduling day`;
    case "no_free_slot":
      return `"${title}" not placed: no free ${session.durationMin}-minute slot in any room on any day`;
    case "speaker_double_booked":
      return `"${title}" not placed: every open slot conflicts with a speaker already booked elsewhere`;
    case "write_cap_reached":
      return `"${title}" not placed: this run's write cap was reached — re-run auto-schedule to place the rest`;
    case "slot_outside_event_range":
      return `"${title}" not placed: its scheduled day falls outside the event's date range — move it or extend the event's dates`;
    case "changed_during_run":
      return `"${title}" not placed: added or rescheduled while this run was in progress — run again to place it`;
  }
}

/** DEC-666: the ONE public-facing word for a session with no room. The
 * internal "tbd" map key (used to bucket unrooted sessions for the roomless
 * column, which always sorts last per DEC-563) is an implementation detail
 * — it must never leak into rendered markup as the literal "TBD". */
export const ROOM_TBA_LABEL = "To be announced";

/** DEC-666: the ONE place a nullable room name becomes public-facing prose.
 * Both the desktop grid's column header and the phone list's room field
 * call this so they can never drift apart. */
export function publicRoomLabel(roomName: string | null): string {
  return roomName ?? ROOM_TBA_LABEL;
}

function intersects(a: PlacedSession, b: PlacedSession): boolean {
  if (a.day !== b.day) return false;
  // Touching intervals (a.endMin === b.startMin) do NOT conflict.
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function intervalsOverlap(
  a: { startMin: number; endMin: number },
  b: { startMin: number; endMin: number },
): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

/** DEC-010 amendment (wave 66): an event-defined non-bookable window (a
 * lunch/coffee break — src/server/repo/breaks.ts) that autoSchedule and
 * nextFreeSlot must both refuse to place into. Day-scoped, minute-offset
 * like every other interval in this module. */
export interface BlockedInterval {
  day: string;
  startMin: number;
  endMin: number;
}

/** Buckets blocked intervals by day so the candidate-slot scan can test only
 * the current day's breaks. Absent/empty input yields an empty map — every
 * caller below already treats a missing bucket as "nothing blocked". */
export function buildBlockedIndex(
  blocked: BlockedInterval[],
): Map<string, { startMin: number; endMin: number }[]> {
  const index = new Map<string, { startMin: number; endMin: number }[]>();
  for (const b of blocked) {
    const bucket = index.get(b.day) ?? [];
    bucket.push({ startMin: b.startMin, endMin: b.endMin });
    index.set(b.day, bucket);
  }
  return index;
}

/** DEC-298: fail loudly on any termination-invariant violation shared by
 * every candidate-slot scan below (autoSchedule's grid loop and
 * nextFreeSlot's single-session scan alike). */
function assertScheduleBounds(dayStartMin: number, dayEndMin: number, gridMin: number): void {
  if (!Number.isInteger(gridMin) || gridMin <= 0) {
    throw new Error(`assertScheduleBounds: gridMin must be a positive integer, got ${gridMin}`);
  }
  if (!Number.isInteger(dayStartMin) || !Number.isInteger(dayEndMin)) {
    throw new Error("assertScheduleBounds: dayStartMin/dayEndMin must be integers");
  }
  if (dayEndMin <= dayStartMin) {
    throw new Error(
      `assertScheduleBounds: dayEndMin (${dayEndMin}) must exceed dayStartMin (${dayStartMin})`,
    );
  }
}

interface CandidateSlot {
  day: string;
  startMin: number;
  endMin: number;
  roomId: string;
}

/**
 * DEC-652: the ONE candidate-slot scan shared by autoSchedule's per-session
 * loop and nextFreeSlot's single-session lookup — same day/start/room
 * ordering, same room+speaker occupancy test, so a "next free slot" the UI
 * offers can never diverge from what autoSchedule itself would have placed.
 * Does not mutate the given indexes — callers own committing a placement.
 */
function scanForFreeSlot(
  session: { durationMin: number; speakerContactIds: string[] },
  rooms: string[],
  days: string[],
  dayStartMin: number,
  dayEndMin: number,
  gridMin: number,
  roomIndex: Map<string, { startMin: number; endMin: number }[]>,
  speakerIndex: Map<string, { startMin: number; endMin: number }[]>,
  blockedIndex: Map<string, { startMin: number; endMin: number }[]>,
): { slot: CandidateSlot | null; sawRoomAvailableCandidate: boolean } {
  if (rooms.length === 0 || session.durationMin > dayEndMin - dayStartMin) {
    return { slot: null, sawRoomAvailableCandidate: false };
  }

  let sawRoomAvailableCandidate = false;

  for (const day of days) {
    const blockedBucket = blockedIndex.get(day);

    for (
      let startMin = dayStartMin;
      startMin + session.durationMin <= dayEndMin;
      startMin += gridMin
    ) {
      const endMin = startMin + session.durationMin;
      const interval = { startMin, endMin };

      // DEC-010 amendment: a break is not a room-availability fact — skip
      // this start time entirely, without touching sawRoomAvailableCandidate,
      // so a session that only fits inside a break still reports the
      // pre-existing "no_free_slot" reason rather than a new one.
      if (blockedBucket?.some((b) => intervalsOverlap(b, interval))) continue;

      for (const roomId of rooms) {
        const roomKey = `${day}|${roomId}`;
        const roomBucket = roomIndex.get(roomKey);
        if (roomBucket?.some((i) => intervalsOverlap(i, interval))) continue;

        sawRoomAvailableCandidate = true;

        let speakerConflict = false;
        for (const contactId of session.speakerContactIds) {
          const speakerBucket = speakerIndex.get(`${day}|${contactId}`);
          if (speakerBucket?.some((i) => intervalsOverlap(i, interval))) {
            speakerConflict = true;
            break;
          }
        }
        if (speakerConflict) continue;

        return { slot: { day, startMin, endMin, roomId }, sawRoomAvailableCandidate };
      }
    }
  }

  return { slot: null, sawRoomAvailableCandidate };
}

function buildOccupancyIndexes(existing: PlacedSession[]): {
  roomIndex: Map<string, { startMin: number; endMin: number }[]>;
  speakerIndex: Map<string, { startMin: number; endMin: number }[]>;
} {
  const roomIndex = new Map<string, { startMin: number; endMin: number }[]>();
  const speakerIndex = new Map<string, { startMin: number; endMin: number }[]>();

  for (const p of existing) {
    if (p.roomId !== null) {
      const key = `${p.day}|${p.roomId}`;
      const bucket = roomIndex.get(key) ?? [];
      bucket.push({ startMin: p.startMin, endMin: p.endMin });
      roomIndex.set(key, bucket);
    }
    for (const contactId of p.speakerContactIds) {
      const key = `${p.day}|${contactId}`;
      const bucket = speakerIndex.get(key) ?? [];
      bucket.push({ startMin: p.startMin, endMin: p.endMin });
      speakerIndex.set(key, bucket);
    }
  }

  return { roomIndex, speakerIndex };
}

/**
 * Finds room and speaker overlap conflicts across the given placed sessions.
 * Room overlap only applies when both sessions have the same non-null room.
 * Speaker overlap applies when any speaker contact is shared, regardless of
 * room. Each unordered pair is reported at most once per kind.
 *
 * DEC-533: rather than an O(n^2) scan of every pair, bucket placements by
 * `${day}|${roomId}` and `${day}|${contactId}` (the same two indexes
 * `autoSchedule` builds above) and only test candidate pairs that share a
 * bucket — a room conflict requires the same room key, a speaker conflict
 * requires a shared contact key, so no true conflict can be missed. The
 * candidate pairs are then sorted ascending by original index (i, j) so the
 * emitted order — and therefore `submissionIds` order and interleaving of
 * `room_overlap`/`speaker_overlap` per pair — is byte-identical to the naive
 * double loop.
 */
export function findConflicts(placed: PlacedSession[], blocks: ScheduleBlock[] = []): Conflict[] {
  const conflicts: Conflict[] = [];
  const n = placed.length;
  if (n === 0) return conflicts;

  const roomBuckets = new Map<string, number[]>();
  const speakerBuckets = new Map<string, number[]>();

  for (let idx = 0; idx < n; idx++) {
    const p = placed[idx]!;
    if (p.roomId !== null) {
      const key = `${p.day}|room|${p.roomId}`;
      const bucket = roomBuckets.get(key) ?? [];
      bucket.push(idx);
      roomBuckets.set(key, bucket);
    }
    for (const contactId of p.speakerContactIds) {
      const key = `${p.day}|speaker|${contactId}`;
      const bucket = speakerBuckets.get(key) ?? [];
      bucket.push(idx);
      speakerBuckets.set(key, bucket);
    }
  }

  const candidatePairs = new Set<string>();
  const addPairs = (bucket: number[]) => {
    for (let x = 0; x < bucket.length; x++) {
      for (let y = x + 1; y < bucket.length; y++) {
        if (bucket[x] === bucket[y]) continue; // same placement listed twice in its own bucket (e.g. a duplicate speaker id)
        const i = Math.min(bucket[x]!, bucket[y]!);
        const j = Math.max(bucket[x]!, bucket[y]!);
        candidatePairs.add(`${i},${j}`);
      }
    }
  };
  for (const bucket of roomBuckets.values()) addPairs(bucket);
  for (const bucket of speakerBuckets.values()) addPairs(bucket);

  const pairs = [...candidatePairs]
    .map((s): [number, number] => {
      const [i, j] = s.split(",").map(Number);
      return [i!, j!];
    })
    .sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1]);

  for (const [i, j] of pairs) {
    const a = placed[i]!;
    const b = placed[j]!;
    if (!intersects(a, b)) continue;

    if (a.roomId !== null && b.roomId !== null && a.roomId === b.roomId) {
      conflicts.push({
        kind: "room_overlap",
        submissionIds: [a.submissionId, b.submissionId],
        day: a.day,
        roomId: a.roomId,
        speakerContactIds: [],
        breakId: null,
        breakLabel: null,
      });
    }

    const sharedSpeakers = a.speakerContactIds.filter((id) =>
      b.speakerContactIds.includes(id),
    );
    if (sharedSpeakers.length > 0) {
      conflicts.push({
        kind: "speaker_overlap",
        submissionIds: [a.submissionId, b.submissionId],
        day: a.day,
        roomId: null,
        speakerContactIds: sharedSpeakers,
        breakId: null,
        breakLabel: null,
      });
    }
  }

  // DEC-557 (wave 69 amendment): break conflicts are APPENDED after all pair
  // conflicts so DEC-533's emission order is preserved. A break blocks EVERY
  // room — emitted regardless of the session's room (including the
  // room-less TBD column) — reusing the SAME half-open interval predicate
  // (intervalsOverlap) the pair scan and scanForFreeSlot both use.
  for (const session of placed) {
    for (const block of blocks) {
      if (session.day !== block.day) continue;
      if (!intervalsOverlap(session, block)) continue;
      conflicts.push({
        kind: "break_overlap",
        submissionIds: [session.submissionId],
        day: session.day,
        roomId: session.roomId,
        speakerContactIds: [],
        breakId: block.breakId,
        breakLabel: block.label,
      });
    }
  }

  return conflicts;
}

/**
 * Live "N unplaced · M conflicts · P% placed" counter inputs. DEC-899: the
 * placed numerator/denominator are computed HERE (server-side), from the
 * same `placed` set and `totalAccepted` denominator every other field on
 * this summary already uses — never re-derived client-side, so the printed
 * percentage can never diverge from the counts sitting next to it.
 */
export function scheduleSummary(
  placed: PlacedSession[],
  totalAccepted: number,
  conflicts: Conflict[] = findConflicts(placed),
): { unplaced: number; conflicts: number; placed: number; total: number } {
  const placedIds = new Set(placed.map((p) => p.submissionId));
  return {
    unplaced: totalAccepted - placedIds.size,
    conflicts: conflicts.length,
    placed: placedIds.size,
    total: totalAccepted,
  };
}

export interface AutoScheduleSessionInput {
  submissionId: string;
  durationMin: number;
  track: string | null;
  speakerContactIds: string[];
}

export interface AutoScheduleInput {
  sessions: AutoScheduleSessionInput[];
  rooms: string[];
  days: string[];
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  existing: PlacedSession[];
  /** DEC-010 amendment: event-defined breaks (lunch, coffee) autoSchedule
   * must never place into. Absent is treated as no breaks. */
  blocked?: BlockedInterval[];
}

/**
 * Greedy auto-schedule per DEC-010: order sessions by duration descending
 * then track, place each into the earliest slot on the grid (scanning
 * days, then start times, then rooms in the given order) that produces
 * zero new conflicts against existing placements plus everything placed
 * so far. Sessions that fit nowhere are left out of `placed` — an
 * unplaced session is a valid state, never an error — and instead appear
 * in `unplaced` with a reason (DEC-615).
 */
export function autoSchedule(input: AutoScheduleInput): {
  placed: PlacedSession[];
  unplaced: UnplacedSession[];
} {
  const { sessions, rooms, days, dayStartMin, dayEndMin, gridMin, existing, blocked } =
    input;

  // DEC-298: fail loudly on any termination-invariant violation — see
  // assertScheduleBounds.
  assertScheduleBounds(dayStartMin, dayEndMin, gridMin);

  const blockedIndex = buildBlockedIndex(blocked ?? []);

  const ordered = [...sessions].sort((a, b) => {
    if (b.durationMin !== a.durationMin) return b.durationMin - a.durationMin;
    const trackA = a.track ?? "";
    const trackB = b.track ?? "";
    const trackCmp = trackA.localeCompare(trackB);
    if (trackCmp !== 0) return trackCmp;
    return a.submissionId.localeCompare(b.submissionId);
  });

  const placed: PlacedSession[] = [...existing];

  // Incremental occupancy indexes (DEC-130): avoid re-running findConflicts
  // over the full trial set for every candidate placement.
  const { roomIndex, speakerIndex } = buildOccupancyIndexes(existing);

  const unplaced: UnplacedSession[] = [];

  for (const session of ordered) {
    // DEC-615: these two global conditions short-circuit the scan (matching
    // scanForFreeSlot's own no-op behaviour when rooms is empty or the
    // duration can never fit) but earn their own named reason instead of
    // falling through to the generic 'no_free_slot'.
    if (rooms.length === 0) {
      unplaced.push({ submissionId: session.submissionId, reason: "no_rooms_configured" });
      continue;
    }
    if (session.durationMin > dayEndMin - dayStartMin) {
      unplaced.push({ submissionId: session.submissionId, reason: "duration_exceeds_day" });
      continue;
    }

    // DEC-615/DEC-652: the ONE candidate-slot scan, shared with
    // nextFreeSlot — see scanForFreeSlot.
    const { slot, sawRoomAvailableCandidate } = scanForFreeSlot(
      session,
      rooms,
      days,
      dayStartMin,
      dayEndMin,
      gridMin,
      roomIndex,
      speakerIndex,
      blockedIndex,
    );

    if (!slot) {
      unplaced.push({
        submissionId: session.submissionId,
        reason: sawRoomAvailableCandidate ? "speaker_double_booked" : "no_free_slot",
      });
      continue;
    }

    const candidate: PlacedSession = {
      submissionId: session.submissionId,
      roomId: slot.roomId,
      day: slot.day,
      startMin: slot.startMin,
      endMin: slot.endMin,
      speakerContactIds: session.speakerContactIds,
    };
    placed.push(candidate);

    const roomKey = `${slot.day}|${slot.roomId}`;
    const roomBucketForKey = roomIndex.get(roomKey) ?? [];
    roomBucketForKey.push({ startMin: slot.startMin, endMin: slot.endMin });
    roomIndex.set(roomKey, roomBucketForKey);

    for (const contactId of session.speakerContactIds) {
      const speakerKey = `${slot.day}|${contactId}`;
      const speakerBucketForKey = speakerIndex.get(speakerKey) ?? [];
      speakerBucketForKey.push({ startMin: slot.startMin, endMin: slot.endMin });
      speakerIndex.set(speakerKey, speakerBucketForKey);
    }
  }

  return { placed, unplaced };
}

export interface NextFreeSlotInput {
  session: { durationMin: number; speakerContactIds: string[] };
  rooms: string[];
  days: string[];
  dayStartMin: number;
  dayEndMin: number;
  gridMin: number;
  existing: PlacedSession[];
  /** DEC-010 amendment: event-defined breaks (lunch, coffee) a suggested
   * slot must never land inside. Absent is treated as no breaks. */
  blocked?: BlockedInterval[];
}

/**
 * DEC-652: the ONE place Overview §04's "Place at 11:30" / "Move DFC-047 to
 * 11:30" suggestions are computed — reuses scanForFreeSlot, the SAME
 * candidate-slot enumeration and room/speaker conflict test autoSchedule
 * runs, so a suggestion the UI offers is always a slot autoSchedule itself
 * would have chosen. `existing` should exclude the session being placed (a
 * conflict's "later" entry moving must not see itself as an occupant).
 * Returns null when nothing fits — the UI must never invent a time.
 */
export function nextFreeSlot(
  input: NextFreeSlotInput,
): { day: string; startMin: number; roomId: string } | null {
  const { session, rooms, days, dayStartMin, dayEndMin, gridMin, existing, blocked } = input;

  assertScheduleBounds(dayStartMin, dayEndMin, gridMin);

  const { roomIndex, speakerIndex } = buildOccupancyIndexes(existing);
  const blockedIndex = buildBlockedIndex(blocked ?? []);
  const { slot } = scanForFreeSlot(
    session,
    rooms,
    days,
    dayStartMin,
    dayEndMin,
    gridMin,
    roomIndex,
    speakerIndex,
    blockedIndex,
  );
  if (!slot) return null;
  return { day: slot.day, startMin: slot.startMin, roomId: slot.roomId };
}
