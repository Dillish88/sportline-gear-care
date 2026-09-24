-- Corrections to verified loyalty functions. Core booking/payment functions unchanged.
begin;
create or replace function public.pilot_loyalty_welcome(p_phone text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bal integer;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid mobile number.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('loyalty-welcome:'||p_phone,4));
 if not exists(select 1 from public.pilot_marketing_contacts where phone=p_phone and expires_at>now()) then raise exception 'Confirm the customer offers opt-in first.'; end if;
 if exists(select 1 from public.pilot_loyalty_ledger where phone=p_phone and reason='welcome') then
 select balance into bal from public.pilot_loyalty where phone=p_phone;
 return jsonb_build_object('awarded',false,'balance',coalesce(bal,0));
 end if;
 bal:=public.pilot_loyalty_apply(p_phone,20,'welcome');
 return jsonb_build_object('awarded',true,'balance',bal);
end $$;
CREATE OR REPLACE FUNCTION public.pilot_queue_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.data order by x.created_at desc) from (
 select (to_jsonb(o)-'receipt_token'-'request_key')
 || jsonb_build_object(
 'status_token',o.receipt_token,
 'paid_total', coalesce((select sum(p.amount) from public.pilot_payments p where p.order_id=o.id),0),
 'ready_by', to_char(o.promised_ready_at at time zone 'Asia/Kolkata','HH24:MI'),
 'loyalty_balance', coalesce((select balance from public.pilot_loyalty l where l.phone=o.phone),0)) as data,
 o.created_at
 from public.pilot_orders o
 where o.anonymised_at is null
 and (o.status not in ('Collected','Cancelled') or o.updated_at > now()-interval '1 day')
 order by o.created_at desc limit 300) x), '[]'::jsonb);
end $function$
;
-- Booking phones are not verified. A token must not expose another person's wallet.
create or replace function public.pilot_loyalty_for_token(p_token uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return (select coalesce(l.balance,0) from public.pilot_orders o left join public.pilot_loyalty l on l.phone=o.phone where o.receipt_token=p_token and o.anonymised_at is null);
end $$;
revoke all on function public.pilot_loyalty_for_token(uuid) from public,anon,authenticated;
grant execute on function public.pilot_loyalty_for_token(uuid) to authenticated;
commit;
