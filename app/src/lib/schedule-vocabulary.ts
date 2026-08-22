// DEC-615 (wave 69 amendment): the ONE module that crosses the app/ -> src/
// boundary for the UnplacedReason vocabulary, same style as plural.ts's
// DEC-957 crossing and batch-caps.ts's DEC-422 crossing. Every SPA consumer
// imports from here, never straight from ../../../src/domain/schedule-copy
// or ../../../src/domain/schedule.
//
// DEC-895 (wave 33 amendment): also the crossing for nextFreeSlot itself —
// PhoneAgenda's clash-card resolution computes its own suggestion
// client-side (the SAME candidate scan buildConflictResolutionFor runs
// server-side, src/server/repo/overview/scheduling.ts) rather than round-
// tripping, so it needs the pure scan function and its shapes here too.
export {
  unplacedReasonLabel,
  conflictKindLabel,
  conflictMoveLabel,
  conflictMoveCaption,
} from '../../../src/domain/schedule-copy';
export { nextFreeSlot } from '../../../src/domain/schedule';
export type { UnplacedReason, ConflictKind, PlacedSession, BlockedInterval, NextFreeSlotInput } from '../../../src/domain/schedule';
