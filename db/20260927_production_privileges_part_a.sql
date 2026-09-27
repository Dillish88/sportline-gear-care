-- LIVE ROLLOUT — PART A
-- Apply only after the Vercel deployment serves pilot/track.js through v2.
-- Keep pilot_create_booking_v2 public for now: Vercel still creates bookings
-- directly through Supabase until production traffic is routed through a Worker.

begin;

-- Fail closed if any staff RPC no longer contains the database-side staff check.
do $$
declare
  v_signature text;
  v_oid oid;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.pilot_loyalty_for_token(uuid)',
    'public.pilot_loyalty_redeem_v2(uuid,integer,text,uuid)',
    'public.pilot_loyalty_welcome(text)',
    'public.pilot_marketing_consent(uuid,boolean)',
    'public.pilot_queue()',
    'public.pilot_queue_v2()',
    'public.pilot_record_payment_v3(uuid,integer,text,text,uuid)',
    'public.pilot_update_order(uuid,text,text,integer)',
    'public.pilot_withdraw_offers(text)'
  ] loop
    v_oid := to_regprocedure(v_signature)::oid;
    if v_oid is null then
      raise exception 'Part A stopped: required staff function % is missing.', v_signature;
    end if;
    v_definition := pg_get_functiondef(v_oid);
    if v_definition not ilike '%pilot_is_staff%' then
      raise exception 'Part A stopped: % does not contain the pilot_is_staff() check.', v_signature;
    end if;
  end loop;
end
$$;

-- Keep staff functions callable only by signed-in accounts; each function's
-- pilot_is_staff() guard then limits those accounts to approved Sportline staff.
revoke all on function public.pilot_is_staff() from public, anon, authenticated, service_role;
grant execute on function public.pilot_is_staff() to authenticated;

revoke all on function public.pilot_loyalty_for_token(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pilot_loyalty_for_token(uuid) to authenticated;
revoke all on function public.pilot_loyalty_redeem_v2(uuid,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.pilot_loyalty_redeem_v2(uuid,integer,text,uuid) to authenticated;
revoke all on function public.pilot_loyalty_welcome(text) from public, anon, authenticated, service_role;
grant execute on function public.pilot_loyalty_welcome(text) to authenticated;
revoke all on function public.pilot_marketing_consent(uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.pilot_marketing_consent(uuid,boolean) to authenticated;
revoke all on function public.pilot_queue() from public, anon, authenticated, service_role;
grant execute on function public.pilot_queue() to authenticated;
revoke all on function public.pilot_queue_v2() from public, anon, authenticated, service_role;
grant execute on function public.pilot_queue_v2() to authenticated;
revoke all on function public.pilot_record_payment_v3(uuid,integer,text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.pilot_record_payment_v3(uuid,integer,text,text,uuid) to authenticated;
revoke all on function public.pilot_update_order(uuid,text,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.pilot_update_order(uuid,text,text,integer) to authenticated;
revoke all on function public.pilot_withdraw_offers(text) from public, anon, authenticated, service_role;
grant execute on function public.pilot_withdraw_offers(text) to authenticated;

-- The merged tracker uses v2. Retire the obsolete v1 wrappers.
revoke all on function public.pilot_create_booking(jsonb,uuid) from public, anon, authenticated, service_role;
revoke all on function public.pilot_track_booking(uuid) from public, anon, authenticated, service_role;

commit;
