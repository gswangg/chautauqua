// DEC-615 (wave 69 amendment): the ONE renderer for UnplacedReason short
// labels, mirroring describeConflict's role for AgendaConflict in
// schedule.ts. Pure, no node:/cloudflare imports. Exhaustive switch with NO
// default branch — a future UnplacedReason member must break this build
// rather than silently render "undefined" in the organiser-visible toast
// (see Agenda.tsx's auto-schedule summary).
import type { ConflictKind, UnplacedReason } from "./schedule";
import { capitalizeFirst, plural, spellCount } from "./count-copy";
import { clockHMM } from "./clock";
import { DEC_895 } from "../decisions";

void DEC_895;

export function unplacedReasonLabel(reason: UnplacedReason): string {
  switch (reason) {
    case "no_rooms_configured":
      return "no rooms configured";
    case "duration_exceeds_day":
      return "longer than the day";
    case "no_free_slot":
      return "no free slot available";
    case "speaker_double_booked":
      return "speaker already booked elsewhere";
    case "write_cap_reached":
      return "this run's write cap reached";
    case "slot_outside_event_range":
      return "scheduled day outside the event range";
    case "changed_during_run":
      return "changed since this run started";
  }
}

// DEC-615 (wave 71 amendment): moved verbatim from
// app/src/pages/agenda/ConflictChip.tsx so SSR/domain callers (and the
// Overview worklist) can reach it without importing a component file — same
// crossing shape as unplacedReasonLabel above. See ConflictChip.tsx and
// AgendaWorkSection.tsx for the two current SPA callers.
export function conflictKindLabel(kind: ConflictKind, count = 2): string {
  if (kind === "speaker_overlap") return "Speaker double-booked";
  if (kind === "break_overlap") return "Scheduled over a break";
  return `${numberWord(count)} ${plural(count, "session")} in one room`;
}

// DEC-925 (amendment, wave 52): spells its count via the shared
// src/domain/count-copy.ts spellCount (0-10 word, numeral above), then
// capitalizes for the chip's sentence-head position -- the same
// capitalize-the-result pattern root.tsx and ErrorSummary.tsx use.
function numberWord(n: number): string {
  return capitalizeFirst(spellCount(n));
}

// DEC-895 (wave 33): the ONE renderer for a conflict-resolution "move it"
// control's label — shared by Overview's buildConflictResolutionFor (desktop
// worklist) and PhoneAgenda's client-side clash-card resolution (DEC-895
// wave 33), so the two surfaces never drift into two spellings of the same
// suggestion. Mirrors buildConflictResolutionFor's prior inline template.
export function conflictMoveLabel(ref: string, startMin: number): string {
  return `Move ${ref} to ${clockHMM(startMin)}`;
}

// DEC-895 (wave 33): the caption under a conflict-resolution control,
// naming the room the suggested slot was found in — see
// AgendaWorkSection.tsx's "Next free slot in {roomName}" caption and
// PhoneAgenda's clash-card control.
export function conflictMoveCaption(roomName: string): string {
  return `Next free slot in ${roomName}`;
}
