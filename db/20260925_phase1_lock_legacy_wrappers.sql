-- The test project's default grants also exposed the legacy wrappers to service_role.
-- Keep the service-role key limited to the v2 booking RPC used by the Worker.
begin;

revoke all on function public.pilot_create_booking(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.pilot_track_booking(uuid) from public,anon,authenticated,service_role;

commit;
