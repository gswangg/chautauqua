// DEC-615 (wave 69 amendment): the ONE module that crosses the app/ -> src/
// boundary for the UnplacedReason vocabulary, same style as plural.ts's
// DEC-957 crossing and batch-caps.ts's DEC-422 crossing. Every SPA consumer
// imports from here, never straight from ../../../src/domain/schedule-copy
// or ../../../src/domain/schedule.
export { unplacedReasonLabel } from '../../../src/domain/schedule-copy';
export type { UnplacedReason } from '../../../src/domain/schedule';
