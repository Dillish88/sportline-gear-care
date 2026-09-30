-- Phase 1 only: public booking requests must pass through the Cloudflare Worker.
-- The Worker requires the encrypted SUPABASE_SERVICE_ROLE_KEY Secret for this RPC.
begin;

revoke all on function public.pilot_create_booking_v2(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.pilot_create_booking_v2(jsonb,uuid) to service_role;

-- The old wrappers are not served by the Phase 1 Worker. Remove their direct API access.
revoke all on function public.pilot_create_booking(jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function public.pilot_track_booking(uuid) from public,anon,authenticated,service_role;

commit;
