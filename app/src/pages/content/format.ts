// DEC-020 (wave-55 amendment): the ONLY module that crosses the app/ ->
// src/ boundary for the byte-size vocabulary (same style as
// app/src/lib/plural.ts's DEC-957 crossing and app/src/lib/merge-fields.ts's
// DEC-660 crossing). Every SPA consumer imports formatBytes from here, never
// straight from ../../../src/domain/files, so there is exactly one
// implementation.
export { formatBytes } from '../../../../src/domain/files';
