-- Verified live loyalty snapshot. For clean rebuilds only, after pilot-booking-v3.sql.
-- Existing installations: apply pilot-loyalty-hardening.sql only.
begin;
create table if not exists public.pilot_loyalty(phone text primary key,balance integer not null default 0 check(balance>=0),updated_at timestamptz not null default now());
create table if not exists public.pilot_loyalty_ledger(id bigserial primary key,phone text not null,order_id uuid references public.pilot_orders(id) on delete set null,delta integer not null,reason text not null,at timestamptz not null default now());
alter table public.pilot_orders add column if not exists loyalty_earned boolean not null default false;
alter table public.pilot_payments drop constraint if exists pilot_payments_method_check;
alter table public.pilot_payments add constraint pilot_payments_method_check check(method in ('UPI','Cash','Card','Credit'));
alter table public.pilot_loyalty enable row level security;alter table public.pilot_loyalty_ledger enable row level security;
revoke all on public.pilot_loyalty,public.pilot_loyalty_ledger from public,anon,authenticated;
update public.pilot_slot_rules set urgent_fee=25 where id;
CREATE OR REPLACE FUNCTION public.pilot_loyalty_for_token(p_token uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(l.balance,0) from public.pilot_orders o
 left join public.pilot_loyalty l on l.phone=o.phone
 where o.receipt_token=p_token and o.anonymised_at is null;
$function$
;
revoke all on function public.pilot_loyalty_for_token(uuid) from public,anon,authenticated;
grant execute on function public.pilot_loyalty_for_token(uuid) to authenticated;
CREATE OR REPLACE FUNCTION public.pilot_loyalty_apply(p_phone text, p_delta integer, p_reason text, p_order uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare bal integer;
begin
 insert into public.pilot_loyalty(phone,balance) values(p_phone,0) on conflict (phone) do nothing;
 select balance into bal from public.pilot_loyalty where phone=p_phone for update;
 if bal + p_delta < 0 then raise exception 'Not enough credit. Balance is ₹%.', bal; end if;
 update public.pilot_loyalty set balance=bal+p_delta, updated_at=now() where phone=p_phone;
 insert into public.pilot_loyalty_ledger(phone,order_id,delta,reason) values(p_phone,p_order,p_delta,p_reason);
 return bal+p_delta;
end $function$
;
revoke all on function public.pilot_loyalty_apply(text,integer,text,uuid) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.pilot_loyalty_on_collect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pts integer;
begin
 if new.status='Collected' and new.paid and not new.loyalty_earned
 and coalesce(new.final_total,new.estimate,0) > 0 then
 pts := floor(coalesce(new.final_total,new.estimate) * 0.05)::integer;
 if pts > 0 then perform public.pilot_loyalty_apply(new.phone, pts, 'earn:'||new.code, new.id); end if;
 new.loyalty_earned := true;
 end if;
 return new;
end $function$
;
revoke all on function public.pilot_loyalty_on_collect() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.pilot_loyalty_welcome(p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare bal integer;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if exists(select 1 from public.pilot_loyalty_ledger where phone=p_phone and reason='welcome') then
 select balance into bal from public.pilot_loyalty where phone=p_phone;
 return jsonb_build_object('awarded',false,'balance',coalesce(bal,0));
 end if;
 bal := public.pilot_loyalty_apply(p_phone, 20, 'welcome');
 return jsonb_build_object('awarded',true,'balance',bal);
end $function$
;
revoke all on function public.pilot_loyalty_welcome(text) from public,anon,authenticated;
grant execute on function public.pilot_loyalty_welcome(text) to authenticated;
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
revoke all on function public.pilot_queue_v2() from public,anon,authenticated;
grant execute on function public.pilot_queue_v2() to authenticated;
CREATE OR REPLACE FUNCTION public.pilot_loyalty_redeem_v2(p_order uuid, p_amount integer, p_kind text, p_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.pilot_orders; previous public.pilot_payments; paid_total integer; agreed integer; bal integer;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_key is null then raise exception 'Payment retry key required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,3));

 select * into previous from public.pilot_payments where request_key=p_key;
 if found then
 if previous.order_id is distinct from p_order or previous.amount is distinct from p_amount
 or previous.method is distinct from 'Credit' or previous.kind is distinct from p_kind then
 raise exception 'Payment request changed.'; end if;
 return jsonb_build_object('recorded',true,'payment_id',previous.id,
 'paid_total',(select coalesce(sum(amount),0) from public.pilot_payments where order_id=p_order),
 'balance',(select greatest(coalesce(final_total,estimate)-(select coalesce(sum(amount),0) from public.pilot_payments where order_id=p_order),0) from public.pilot_orders where id=p_order),
 'paid',(select paid from public.pilot_orders where id=p_order),
 'loyalty_balance',(select balance from public.pilot_loyalty where phone=(select phone from public.pilot_orders where id=p_order)));
 end if;

 select * into o from public.pilot_orders where id=p_order for update;
 if not found or o.status not in ('Requested','Accepted','At the bench','Ready') or (o.final_total is null and o.needs_quote) then
 raise exception 'Accept the job and confirm its price first.'; end if;
 agreed := coalesce(o.final_total, o.estimate);
 select coalesce(sum(amount),0) into paid_total from public.pilot_payments where order_id=o.id;
 if p_amount is null or p_amount<=0 or p_amount>agreed-paid_total then raise exception 'Enter an amount no greater than the balance.'; end if;
 if p_kind is null or p_kind not in ('advance','part','balance') then raise exception 'Choose a payment type.'; end if;

 -- Debit the wallet first: if the customer doesn't have enough credit, nothing else happens.
 bal := public.pilot_loyalty_apply(o.phone, -p_amount, 'redeem:'||o.code, p_order);

 insert into public.pilot_payments(order_id,amount,method,kind,actor,request_key)
 values(o.id,p_amount,'Credit',p_kind,auth.uid(),p_key) returning * into previous;
 update public.pilot_orders set paid = final_total is not null and paid_total+p_amount=final_total,
 paid_at = case when paid_total+p_amount=final_total then now() else null end, updated_at=now() where id=o.id;
 insert into public.pilot_events(order_id,action,actor,detail)
 values(o.id,'payment',auth.uid(),jsonb_build_object('amount',p_amount,'method','Credit','kind',p_kind,'payment_id',previous.id));

 return jsonb_build_object('recorded',true,'payment_id',previous.id,'paid_total',paid_total+p_amount,
 'balance',greatest(agreed-paid_total-p_amount,0),
 'paid', o.final_total is not null and paid_total+p_amount=o.final_total,
 'loyalty_balance', bal);
end $function$
;
revoke all on function public.pilot_loyalty_redeem_v2(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.pilot_loyalty_redeem_v2(uuid,integer,text,uuid) to authenticated;
drop trigger if exists pilot_orders_loyalty on public.pilot_orders;
create trigger pilot_orders_loyalty before update of status on public.pilot_orders for each row execute function public.pilot_loyalty_on_collect();
commit;
