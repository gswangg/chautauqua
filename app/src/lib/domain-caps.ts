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
// Multi-portal sponsorships (Settings · Sponsorships, the sponsor-session
// queue): entitlement rows, tier/company/person names, organizer notes.
export { MAX_ENTITLEMENT_COUNT, MAX_ENTITLEMENT_ROWS } from '../../../src/domain/sponsors';
export { MAX_TIER_NAME, MAX_SPONSOR_NAME, MAX_PERSON_NAME, MAX_ORGANIZER_NOTE } from '../../../src/domain/portals/limits';
// Multi-portal portals (Settings · Portals, the portal editor, the item
// library): portal name/note, field help text, library item text and file
// limits, item deadlines and grace, rule size.
export { MAX_PORTAL_NAME, MAX_PORTAL_NOTE, MAX_PORTAL_ITEMS, MAX_LIBRARY_TITLE, MAX_LIBRARY_INSTRUCTIONS, MAX_LIBRARY_PAGE } from '../../../src/domain/portals/limits';
export { MAX_FIELD_HELP_LENGTH } from '../../../src/domain/portals/permissions';
export { MAX_FILE_REQUEST_SIZE_MB, MAX_FILE_REQUEST_FILES } from '../../../src/domain/portals/file-types';
export { MAX_RELATIVE_DAYS, MAX_GRACE_DAYS } from '../../../src/domain/portals/items';
export { MAX_RULE_GROUPS, MAX_RULE_CONDITIONS } from '../../../src/domain/portals/rules';
// Multi-portal person record: the invite-to-speak personal message.
export { MAX_INVITATION_MESSAGE } from '../../../src/domain/portals/limits';
