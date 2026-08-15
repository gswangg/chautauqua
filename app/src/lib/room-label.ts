// DEC-666: the ONLY module that crosses the app/ -> src/ boundary for the
// room-absence vocabulary (same style as plural.ts's DEC-957/DEC-660). Every
// SPA consumer imports ROOM_TBA_LABEL/publicRoomLabel from here, never
// straight from ../../../src/domain/schedule, so there is exactly one
// implementation.
export { ROOM_TBA_LABEL, publicRoomLabel } from '../../../src/domain/schedule';
