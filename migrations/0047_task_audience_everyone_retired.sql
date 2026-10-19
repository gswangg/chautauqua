-- Multi-portal decision 76: the 'everyone' audience is retired. It meant
-- "every accepted speaker, back-filled at each acceptance" -- a rule engine
-- beside portals. Each such task becomes a hand-picked ('targeted') list of
-- exactly the people who already have it, so nobody's list changes; an
-- organizer who wants it for a group adds it to a portal from the library.
UPDATE task SET audience = 'targeted' WHERE audience = 'everyone';
