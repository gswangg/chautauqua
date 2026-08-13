// DEC-660: the ONLY module that crosses the app/ -> src/ boundary for the
// merge-field vocabulary. Every SPA consumer imports from here, never
// straight from ../../../src/mail/render or ../../../src/domain/compose,
// so there is exactly one place that names the crossing.
export {
  COMPOSE_MERGE_FIELDS,
  BULK_EMAIL_MERGE_FIELDS,
  SUBJECT_MERGE_FIELDS,
  MERGE_FIELD_SAMPLES,
} from '../../../src/mail/render';
export type { MergeField } from '../../../src/mail/render';
export { MAX_COMPOSE_RECIPIENTS } from '../../../src/domain/compose';
