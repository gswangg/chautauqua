// DEC-615 (wave 69 amendment): the ONE renderer for UnplacedReason short
// labels, mirroring describeConflict's role for AgendaConflict in
// schedule.ts. Pure, no node:/cloudflare imports. Exhaustive switch with NO
// default branch — a future UnplacedReason member must break this build
// rather than silently render "undefined" in the organiser-visible toast
// (see Agenda.tsx's auto-schedule summary).
import type { UnplacedReason } from "./schedule";

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
