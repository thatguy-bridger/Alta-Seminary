-- Lets deploy failures be logged into the existing change_log/History tab
-- (table_name='deploy', no real record behind it) instead of only living in
-- GitHub's own Actions log, which no admin routinely checks. See the
-- report-deploy-status Edge Function and deploy.yml's notify-failure job.
--
-- Must be its own migration/transaction: Postgres only allows a new enum
-- value to be used in a later transaction than the one that added it.
alter type change_action add value 'error';
