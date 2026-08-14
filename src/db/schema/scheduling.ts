// Scheduling tables: tracks, rooms, and schedule slots. Split out of the
// former monolithic src/db/schema.ts (contention-hotspot decomposition;
// behavior-preserving).

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { id, createdAt, updatedAt } from "./common";

export const track = sqliteTable(
  "track",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    position: integer("position").notNull().default(0),
    // DEC-612: namespaced "<source>:<their id>" ref for idempotent import
    // re-runs; nullable, SQLite treats NULLs as distinct.
    externalRef: text("external_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    track_event_id_idx: index("track_event_id_idx").on(t.eventId),
    // DEC-612: external_ref uniqueness scoped to the row's own owner.
    track_event_id_external_ref_idx: uniqueIndex("track_event_id_external_ref_idx").on(
      t.eventId,
      t.externalRef,
    ),
  }),
);

export const room = sqliteTable(
  "room",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    name: text("name").notNull(),
    capacity: integer("capacity"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    room_event_id_idx: index("room_event_id_idx").on(t.eventId),
  }),
);

export const scheduleSlot = sqliteTable(
  "schedule_slot",
  {
    id: id(),
    submissionId: text("submission_id").notNull(),
    // nullable room: "TBD is a real value" — DEC-010
    roomId: text("room_id"),
    // 'YYYY-MM-DD' in event timezone
    day: text("day").notNull(),
    // minutes-from-midnight in event timezone
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    schedule_slot_submission_id_idx: uniqueIndex("schedule_slot_submission_id_idx").on(t.submissionId),
    schedule_slot_room_id_idx: index("schedule_slot_room_id_idx").on(t.roomId),
    schedule_slot_day_idx: index("schedule_slot_day_idx").on(t.day),
  }),
);

// DEC-022 amendment (wave 63): the public agenda's "spanning quiet rule"
// primitive — a lunch/coffee break block, never a submission (see the HARD
// BOUNDARY note on src/server/repo/breaks.ts: no ref, no speaker, no track,
// no ics UID, no room, no feed row). Deliberately NOT a schedule_slot row:
// a break has no submissionId to key the slot's own unique index on, and
// giving it one would make every consumer of schedule_slot (auto-schedule,
// conflict detection, the ics feed) reason about a fake submission.
export const scheduleBreak = sqliteTable(
  "schedule_break",
  {
    id: id(),
    eventId: text("event_id").notNull(),
    // 'YYYY-MM-DD' in event timezone — same string schedule_slot.day uses.
    day: text("day").notNull(),
    label: text("label").notNull(),
    location: text("location"),
    // minutes-from-midnight in event timezone
    startMin: integer("start_min").notNull(),
    durationMin: integer("duration_min").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    schedule_break_event_id_day_idx: index("schedule_break_event_id_day_idx").on(t.eventId, t.day),
  }),
);
