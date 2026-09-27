-- LIVE ROLLOUT — PART B
-- Do not apply until live booking traffic has been cut over to the production
-- Worker (or another approved server) and a live booking has passed end to end.
-- Applying this while Vercel still calls Supabase directly will stop bookings.

begin;

revoke all on function public.pilot_create_booking_v2(jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.pilot_create_booking_v2(jsonb,uuid) to service_role;

commit;
