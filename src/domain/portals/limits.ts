// Multi-portal caps (DEC-422: every batch/count/length cap lives in pure
// core, declared once, imported by the repo and route doors that enforce
// it). Pure core.

// portals
export const MAX_PORTALS_PER_EVENT = 40;
export const MAX_PORTAL_ITEMS = 40;
export const MAX_PORTAL_NAME = 80;
export const MAX_PORTAL_NOTE = 600;

// the item library
export const MAX_LIBRARY_TITLE = 120;
export const MAX_LIBRARY_INSTRUCTIONS = 4000;
export const MAX_LIBRARY_PAGE = 20000;

// invitations to speak, and a decliner's note
export const MAX_INVITATION_MESSAGE = 1000;

// one cron pass sends at most this many "new in your portal" emails per
// event; the rest wait for the next pass
export const MAX_PORTAL_NOTIFICATIONS_PER_PASS = 100;

// sponsors
export const MAX_TIERS_PER_EVENT = 20;
export const MAX_TIER_NAME = 60;
export const MAX_SPONSOR_NAME = 120;
export const MAX_SPONSOR_CONTACTS = 30;
export const MAX_SPONSOR_SESSION_TITLE = 200;
export const MAX_SPONSOR_SESSION_ABSTRACT = 4000;
export const MAX_ORGANIZER_NOTE = 2000;
export const MAX_PERSON_NAME = 80;
