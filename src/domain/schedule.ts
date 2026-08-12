/**
 * Scheduling engine (DEC-010): warn-never-block conflict detection + greedy
 * auto-schedule. Pure module — no node:/cloudflare imports (DEC-002).
 */

import { DEC_130, DEC_476 } from "../decisions";
void DEC_130;
void DEC_476;

/** DEC-476: single source of truth for the day boundary in minutes. Every
 * schedule-slot writer and the auto-schedule bounds share this constant so
 * the two bounds cannot drift apart. */
export const MINUTES_PER_DAY = 1440;

export interface PlacedSession {
  submissionId: string;
  roomId: string | null;
  day: string;
  startMin: number;
  endMin: number;
  speakerContactIds: string[];
}

export interface Conflict {
  kind: "room_overlap" | "speaker_overlap";
  submissionIds: [string, string];
  day: string;
  roomId: string | null;
  speakerContactIds: string[];
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
  const titleA =
    labels.titleBySubmissionId.get(c.submissionIds[0]) ?? c.submissionIds[0];
  const titleB =
    labels.titleBySubmissionId.get(c.submissionIds[1]) ?? c.submissionIds[1];

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
  return `Speaker(s) ${speakerNames.join(", ")} double-booked on ${c.day} between "${titleA}" and "${titleB}"`;
}

function intersects(a: PlacedSession, b: PlacedSession): boolean {
  if (a.day !== b.day) return false;
  // Touching intervals (a.endMin === b.startMin) do NOT conflict.
  return a.startMin < b.endMin && b.startMin < a.endMin;
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
export function findConflicts(placed: PlacedSession[]): Conflict[] {
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
      });
    }
  }

  return conflicts;
}

/**
 * Live "N unplaced · M conflicts" counter inputs.
 */
export function scheduleSummary(
  placed: PlacedSession[],
  totalAccepted: number,
  conflicts: Conflict[] = findConflicts(placed),
): { unplaced: number; conflicts: number } {
  const placedIds = new Set(placed.map((p) => p.submissionId));
  return {
    unplaced: totalAccepted - placedIds.size,
    conflicts: conflicts.length,
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
}

/**
 * Greedy auto-schedule per DEC-010: order sessions by duration descending
 * then track, place each into the earliest slot on the grid (scanning
 * days, then start times, then rooms in the given order) that produces
 * zero new conflicts against existing placements plus everything placed
 * so far. Sessions that fit nowhere are left out of the result — an
 * unplaced session is a valid state, never an error.
 */
export function autoSchedule(input: AutoScheduleInput): PlacedSession[] {
  const { sessions, rooms, days, dayStartMin, dayEndMin, gridMin, existing } =
    input;

  // DEC-298: fail loudly on any termination-invariant violation. The grid
  // scan below (startMin += gridMin) never terminates unless gridMin is a
  // positive integer and dayEndMin exceeds dayStartMin; this assertion is
  // the module's own guarantee against a hung isolate, independent of
  // whatever validation an upstream caller does or forgets to do.
  if (!Number.isInteger(gridMin) || gridMin <= 0) {
    throw new Error(`autoSchedule: gridMin must be a positive integer, got ${gridMin}`);
  }
  if (!Number.isInteger(dayStartMin) || !Number.isInteger(dayEndMin)) {
    throw new Error("autoSchedule: dayStartMin/dayEndMin must be integers");
  }
  if (dayEndMin <= dayStartMin) {
    throw new Error(
      `autoSchedule: dayEndMin (${dayEndMin}) must exceed dayStartMin (${dayStartMin})`,
    );
  }

  const ordered = [...sessions].sort((a, b) => {
    if (b.durationMin !== a.durationMin) return b.durationMin - a.durationMin;
    const trackA = a.track ?? "";
    const trackB = b.track ?? "";
    return trackA.localeCompare(trackB);
  });

  const placed: PlacedSession[] = [...existing];

  // Incremental occupancy indexes (DEC-130): avoid re-running findConflicts
  // over the full trial set for every candidate placement.
  const roomIndex = new Map<string, { startMin: number; endMin: number }[]>();
  const speakerIndex = new Map<
    string,
    { startMin: number; endMin: number }[]
  >();

  const overlaps = (
    a: { startMin: number; endMin: number },
    b: { startMin: number; endMin: number },
  ): boolean => a.startMin < b.endMin && b.startMin < a.endMin;

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

  for (const session of ordered) {
    let placedThisSession = false;

    for (const day of days) {
      if (placedThisSession) break;
      for (
        let startMin = dayStartMin;
        startMin + session.durationMin <= dayEndMin;
        startMin += gridMin
      ) {
        if (placedThisSession) break;
        const endMin = startMin + session.durationMin;
        const interval = { startMin, endMin };

        for (const roomId of rooms) {
          const roomKey = `${day}|${roomId}`;
          const roomBucket = roomIndex.get(roomKey);
          if (roomBucket?.some((i) => overlaps(i, interval))) continue;

          let speakerConflict = false;
          for (const contactId of session.speakerContactIds) {
            const speakerBucket = speakerIndex.get(`${day}|${contactId}`);
            if (speakerBucket?.some((i) => overlaps(i, interval))) {
              speakerConflict = true;
              break;
            }
          }
          if (speakerConflict) continue;

          const candidate: PlacedSession = {
            submissionId: session.submissionId,
            roomId,
            day,
            startMin,
            endMin,
            speakerContactIds: session.speakerContactIds,
          };

          placed.push(candidate);

          const roomBucketForKey = roomIndex.get(roomKey) ?? [];
          roomBucketForKey.push(interval);
          roomIndex.set(roomKey, roomBucketForKey);

          for (const contactId of session.speakerContactIds) {
            const speakerKey = `${day}|${contactId}`;
            const speakerBucketForKey = speakerIndex.get(speakerKey) ?? [];
            speakerBucketForKey.push(interval);
            speakerIndex.set(speakerKey, speakerBucketForKey);
          }

          placedThisSession = true;
          break;
        }
      }
    }
  }

  return placed;
}
