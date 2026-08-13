// DEC-154 (amendment, wave 53): the ONLY module that crosses the app/ ->
// src/ boundary for the admin route manifest. Every SPA consumer imports
// from here, never straight from ../../../src/lib/admin-routes (same style
// as embed-formats.ts's DEC-785 crossing).
export { ADMIN_ROUTE_PATTERNS, matchesAdminRoute } from '../../../src/lib/admin-routes';
