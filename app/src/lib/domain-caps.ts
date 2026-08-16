// DEC-660/DEC-180 (wave-55 amendment): the ONLY module that crosses the
// app/ -> src/ boundary for these caps, same style as merge-fields.ts's
// DEC-660 crossing, file-caps.ts's DEC-660/DEC-160 crossing, batch-caps.ts's
// DEC-422 crossing, and text-caps.ts's DEC-660 crossing. Every SPA consumer
// imports these caps from here, never straight from ../../../src/domain/*,
// so there is exactly one place that names the crossing.
export { MAX_SEGMENT_RULES, MAX_IMPORT_CSV_BYTES, MAX_IMPORT_ROWS } from '../../../src/domain/contacts';
export { MAX_EMAIL_LENGTH } from '../../../src/domain/email';
export { MAX_TASK_INSTRUCTIONS_LENGTH } from '../../../src/domain/task-copy';
export { PIPELINE_RATIONALE_MAX_LEN } from '../../../src/domain/pipeline-fit';
export { HEADSHOT_DOWNSCALE_EDGE_PX, HEADSHOT_DOWNSCALE_QUALITY } from '../../../src/domain/files';
export { MAX_CRITERION_GUIDANCE_LENGTH } from '../../../src/domain/evaluation';
