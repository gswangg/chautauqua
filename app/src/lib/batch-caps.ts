// DEC-422 (wave-67 amendment): the ONLY module that crosses the app/ -> src/
// boundary for these per-event/per-form batch caps, same style as
// merge-fields.ts's DEC-660 crossing and file-caps.ts's DEC-660/DEC-160
// crossing. Every SPA consumer imports from here, never straight from
// ../../../src/domain/form-copy, ../../../src/domain/schedule,
// ../../../src/domain/evaluation or ../../../src/domain/saved-views.
export { MAX_FORM_FIELDS } from '../../../src/domain/form-copy';
export { MAX_BREAKS_PER_EVENT } from '../../../src/domain/schedule';
export { MAX_FIELD_OPTIONS } from '../../../src/domain/form-copy';
export { MAX_PLAN_CRITERIA, MIN_CRITERION_OPTIONS, MAX_CRITERION_OPTIONS } from '../../../src/domain/evaluation';
export { MAX_SAVED_VIEWS_PER_EVENT } from '../../../src/domain/saved-views';
// wave-77 amendment: MAX_TASK_ASSIGNEES is a batch cap (largest assignee set
// one task write may name), not a vocabulary -- it belongs in this crossing,
// not domain-caps.ts.
export { MAX_TASK_ASSIGNEES } from '../../../src/domain/task-kinds';
