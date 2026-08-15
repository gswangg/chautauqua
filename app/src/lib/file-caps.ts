// DEC-660/DEC-160 (wave-53 amendment): the ONLY module that crosses the
// app/ -> src/ boundary for the bulk-ZIP archive caps (same style as
// merge-fields.ts's DEC-660 crossing). Every SPA consumer imports the
// archive caps from here, never straight from ../../../src/domain/files,
// so there is exactly one place that names the crossing.
export { ARCHIVE_MAX_FILES, ARCHIVE_MAX_TOTAL_BYTES, ARCHIVE_PEAK_MULTIPLIER, archiveCapMessage } from '../../../src/domain/files';
