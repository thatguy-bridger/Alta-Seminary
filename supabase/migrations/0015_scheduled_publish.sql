-- Scheduled publish + optional auto-unpublish, for Pages and Announcements
-- (the two content types authored through PageBuilderScreen). Scoped to
-- just these two rather than every content_status table -- they're the
-- bespoke authoring flow "scheduled publish" is actually about; Events/
-- Directory/Gallery keep their simple draft/published toggle.
--
-- Must be its own migration/transaction, same reason as 0013's `error` value:
-- Postgres only allows a new enum value to be used in a later transaction
-- than the one that added it.
alter type content_status add value 'scheduled';
