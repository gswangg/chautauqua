// DEC-900 (wave 60 amendment): the ONE module that crosses the app/ -> src/
// boundary for minutes-from-midnight clock formatting (same style as
// room-label.ts's DEC-666 and merge-fields.ts). Every SPA consumer imports
// clockHHMM/clockHMM from here, never straight from
// ../../../src/domain/clock, so there is exactly one implementation.
export { clockHHMM, clockHMM } from '../../../src/domain/clock';
