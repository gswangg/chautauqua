/**
 * Scheduling engine (DEC-010): warn-never-block conflict detection + greedy
 * auto-schedule. Pure module — no node:/cloudflare imports (DEC-002).
 */

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
  detail: string;
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
 */
export function findConflicts(placed: PlacedSession[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]!;
      const b = placed[j]!;
      if (!intersects(a, b)) continue;

      if (a.roomId !== null && b.roomId !== null && a.roomId === b.roomId) {
        conflicts.push({
          kind: "room_overlap",
          submissionIds: [a.submissionId, b.submissionId],
          detail: `Room "${a.roomId}" double-booked on ${a.day} between submissions ${a.submissionId} and ${b.submissionId}`,
        });
      }

      const sharedSpeakers = a.speakerContactIds.filter((id) =>
        b.speakerContactIds.includes(id),
      );
      if (sharedSpeakers.length > 0) {
        conflicts.push({
          kind: "speaker_overlap",
          submissionIds: [a.submissionId, b.submissionId],
          detail: `Speaker(s) ${sharedSpeakers.join(", ")} double-booked on ${a.day} between submissions ${a.submissionId} and ${b.submissionId}`,
        });
      }
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
): { unplaced: number; conflicts: number } {
  const placedIds = new Set(placed.map((p) => p.submissionId));
  return {
    unplaced: totalAccepted - placedIds.size,
    conflicts: findConflicts(placed).length,
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

  const ordered = [...sessions].sort((a, b) => {
    if (b.durationMin !== a.durationMin) return b.durationMin - a.durationMin;
    const trackA = a.track ?? "";
    const trackB = b.track ?? "";
    return trackA.localeCompare(trackB);
  });

  const placed: PlacedSession[] = [...existing];

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

        for (const roomId of rooms) {
          const candidate: PlacedSession = {
            submissionId: session.submissionId,
            roomId,
            day,
            startMin,
            endMin,
            speakerContactIds: session.speakerContactIds,
          };

          const trial = [...placed, candidate];
          const newConflicts = findConflicts(trial).filter((c) =>
            c.submissionIds.includes(session.submissionId),
          );

          if (newConflicts.length === 0) {
            placed.push(candidate);
            placedThisSession = true;
            break;
          }
        }
      }
    }
  }

  return placed;
}
