// DEC-988 (wave-77 amendment): the ONLY module that crosses the app/ -> src/
// boundary for the absent-portal_settings-row default, same style as
// domain-caps.ts's DEC-660 crossing for caps. Every SPA consumer of the
// default imports it from here, never straight from
// ../../../src/domain/portal-settings, so there is exactly one place that
// names the crossing.
export { DEFAULT_PORTAL_SETTINGS } from '../../../src/domain/portal-settings';
