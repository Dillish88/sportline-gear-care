-- Run in Supabase after pilot-maintenance.sql; pg_cron is not needed by local tests.
create extension if not exists pg_cron;
select cron.schedule('sportline-personal-data-retention','30 21 * * *','select public.pilot_purge_personal_data();');
-- 21:30 UTC = 03:00 India, daily. Named job is updated on reruns.
select jobname,schedule,active from cron.job where jobname='sportline-personal-data-retention';
