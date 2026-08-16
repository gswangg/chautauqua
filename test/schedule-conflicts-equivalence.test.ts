import { describe, expect, it } from "vitest";
import {
  findConflicts,
  scheduleSummary,
  type Conflict,
  type PlacedSession,
} from "../src/domain/schedule";

/**
 * Naive reference implementation: a literal copy of the pre-DEC-533 double
 * loop over every pair. `findConflicts` in src/domain/schedule.ts must
 * produce byte-identical output to this for any input — same pairs, same
 * order, same kind, same detail strings.
 */
function naiveFindConflicts(placed: PlacedSession[]): Conflict[] {
  const conflicts: Conflict[] = [];

  const intersects = (a: PlacedSession, b: PlacedSession): boolean => {
    if (a.day !== b.day) return false;
    return a.startMin < b.endMin && b.startMin < a.endMin;
  };

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
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
  }

  return conflicts;
}

/** Deterministic seeded LCG so the corpus is reproducible across runs. */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function buildRandomCorpus(): PlacedSession[] {
  const rand = makeLcg(42);
  const days = ["2026-08-10", "2026-08-11", "2026-08-12"];
  const rooms = Array.from({ length: 12 }, (_, i) => `room-${i}`);
  const speakerPool = Array.from({ length: 200 }, (_, i) => `speaker-${i}`);

  const placements: PlacedSession[] = [];
  for (let i = 0; i < 400; i++) {
    const day = days[Math.floor(rand() * days.length)]!;
    const roomId = rand() < 0.1 ? null : rooms[Math.floor(rand() * rooms.length)]!;
    const startMin = Math.floor(rand() * 20) * 30; // 0..570 in 30-min steps
    const durationMin = 30 + Math.floor(rand() * 4) * 30; // 30..150
    const speakerCount = Math.floor(rand() * 4); // 0..3
    const speakerContactIds: string[] = [];
    for (let s = 0; s < speakerCount; s++) {
      speakerContactIds.push(speakerPool[Math.floor(rand() * speakerPool.length)]!);
    }
    placements.push({
      submissionId: `sub-${i}`,
      roomId,
      day,
      startMin,
      endMin: startMin + durationMin,
      speakerContactIds,
    });
  }
  return placements;
}

describe("findConflicts equivalence (DEC-533)", () => {
  it("matches the naive reference over a seeded pseudo-random corpus", () => {
    const corpus = buildRandomCorpus();
    expect(findConflicts(corpus)).toEqual(naiveFindConflicts(corpus));
  });

  it("matches the naive reference when every room is null", () => {
    const placements: PlacedSession[] = Array.from({ length: 20 }, (_, i) => ({
      submissionId: `s${i}`,
      roomId: null,
      day: "2026-08-10",
      startMin: 540,
      endMin: 600,
      speakerContactIds: [`speaker-${i % 3}`],
    }));
    expect(findConflicts(placements)).toEqual(naiveFindConflicts(placements));
  });

  it("yields 3 pairs for three mutually-overlapping sessions in one room", () => {
    const placements: PlacedSession[] = [
      { submissionId: "a", roomId: "room-a", day: "2026-08-10", startMin: 540, endMin: 660, speakerContactIds: [] },
      { submissionId: "b", roomId: "room-a", day: "2026-08-10", startMin: 570, endMin: 690, speakerContactIds: [] },
      { submissionId: "c", roomId: "room-a", day: "2026-08-10", startMin: 600, endMin: 720, speakerContactIds: [] },
    ];
    const conflicts = findConflicts(placements);
    expect(conflicts).toEqual(naiveFindConflicts(placements));
    expect(conflicts.filter((c) => c.kind === "room_overlap")).toHaveLength(3);
  });

  it("yields both room_overlap and speaker_overlap (room first) when a pair shares both", () => {
    const placements: PlacedSession[] = [
      {
        submissionId: "a",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 540,
        endMin: 600,
        speakerContactIds: ["speaker-1"],
      },
      {
        submissionId: "b",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 570,
        endMin: 630,
        speakerContactIds: ["speaker-1"],
      },
    ];
    const conflicts = findConflicts(placements);
    expect(conflicts).toEqual(naiveFindConflicts(placements));
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]?.kind).toBe("room_overlap");
    expect(conflicts[1]?.kind).toBe("speaker_overlap");
  });

  it("does not conflict on touching intervals", () => {
    const placements: PlacedSession[] = [
      {
        submissionId: "a",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 540,
        endMin: 600,
        speakerContactIds: ["speaker-1"],
      },
      {
        submissionId: "b",
        roomId: "room-a",
        day: "2026-08-10",
        startMin: 600,
        endMin: 660,
        speakerContactIds: ["speaker-1"],
      },
    ];
    const conflicts = findConflicts(placements);
    expect(conflicts).toEqual(naiveFindConflicts(placements));
    expect(conflicts).toEqual([]);
  });

  it("scheduleSummary.conflicts matches findConflicts(placed).length and accepts a precomputed array identically", () => {
    const corpus = buildRandomCorpus();
    const conflicts = findConflicts(corpus);
    const computed = scheduleSummary(corpus, corpus.length);
    expect(computed.conflicts).toBe(findConflicts(corpus).length);

    const withPrecomputed = scheduleSummary(corpus, corpus.length, conflicts);
    expect(withPrecomputed).toEqual(computed);
  });
});
