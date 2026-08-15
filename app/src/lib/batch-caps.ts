// DEC-422 (wave-67 amendment): the ONLY module that crosses the app/ -> src/
// boundary for these two per-event/per-form batch caps, same style as
// merge-fields.ts's DEC-660 crossing and file-caps.ts's DEC-660/DEC-160
// crossing. Every SPA consumer imports from here, never straight from
// ../../../src/domain/form-copy or ../../../src/domain/schedule.
export { MAX_FORM_FIELDS } from '../../../src/domain/form-copy';
export { MAX_BREAKS_PER_EVENT } from '../../../src/domain/schedule';
export { MAX_PLAN_CRITERIA } from '../../../src/domain/evaluation';
