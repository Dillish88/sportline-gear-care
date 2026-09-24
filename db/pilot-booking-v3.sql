-- Full reproducible booking migration. Apply after pilot-maintenance.sql. No orders are deleted.
begin;
alter table public.pilot_orders drop constraint if exists pilot_orders_sport_check;
alter table public.pilot_orders add constraint pilot_orders_sport_check check(sport in ('badminton','cricket','shoe'));
alter table public.pilot_orders add column if not exists slot_date date, add column if not exists slot_start time,
 add column if not exists urgent boolean not null default false, add column if not exists pay_method text,
 add column if not exists promised_ready_at timestamptz;
create table if not exists public.pilot_slot_rules(id boolean primary key default true check(id),first_start time not null default '10:30',last_start time not null default '20:30',step_minutes integer not null default 30,per_slot integer not null default 1,daily_cap integer not null default 20,urgent_cap integer not null default 4,lead_minutes integer not null default 15,days_ahead integer not null default 2,urgent_fee integer not null default 100);
alter table public.pilot_slot_rules add column if not exists break_start time not null default '14:00';
insert into public.pilot_slot_rules(id) values(true) on conflict do nothing;
update public.pilot_slot_rules set first_start='10:30',last_start='20:30',step_minutes=30,per_slot=1,daily_cap=20,break_start='14:00',urgent_fee=100 where id;
alter table public.pilot_slot_rules enable row level security;
revoke all on public.pilot_slot_rules from public,anon,authenticated;
update public.pilot_orders set promised_ready_at=(slot_date+slot_start+interval '30 minutes') at time zone 'Asia/Kolkata' where promised_ready_at is null and slot_date is not null and slot_start is not null;
create table if not exists public.pilot_payments(id bigserial primary key,order_id uuid not null references public.pilot_orders(id) on delete cascade,amount integer not null check(amount>0 and amount<=100000),method text not null check(method in ('UPI','Cash','Card')),kind text not null check(kind in ('advance','part','balance')),at timestamptz not null default now(),actor uuid);
alter table public.pilot_payments add column if not exists request_key uuid;
create unique index if not exists pilot_payment_retry_idx on public.pilot_payments(request_key);
alter table public.pilot_payments enable row level security;
revoke all on public.pilot_payments from public,anon,authenticated;
-- Preserve payments recorded by the original paid/unpaid workflow.
insert into public.pilot_payments(order_id,amount,method,kind,at)
 select id,final_total,coalesce(pay_method,request_data->>'payment','Cash'),'balance',coalesce(paid_at,updated_at)
 from public.pilot_orders o where paid and final_total>0 and not exists(select 1 from public.pilot_payments p where p.order_id=o.id);

create or replace function public.pilot_available_slots(p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r public.pilot_slot_rules; t time; clock timestamp:=now() at time zone 'Asia/Kolkata'; slots jsonb:='[]'; used integer; available boolean;
begin
 select * into r from public.pilot_slot_rules where id;
 if p_date is null or p_date<clock::date or p_date>clock::date+r.days_ahead then raise exception 'Choose an available date.'; end if;
 select count(*) into used from public.pilot_orders where sport='badminton' and status<>'Cancelled' and (slot_date=p_date or (urgent and slot_date is null and (created_at at time zone 'Asia/Kolkata')::date=p_date));
 t:=r.first_start;
 while t<=r.last_start loop
  if t<>r.break_start then
   available:=used<r.daily_cap and (p_date+t)>=clock+make_interval(mins=>r.lead_minutes) and
    (select count(*) from public.pilot_orders where slot_date=p_date and slot_start=t and status<>'Cancelled')<r.per_slot;
   slots:=slots||jsonb_build_array(jsonb_build_object('start',to_char(t,'HH24:MI'),'ready',to_char(t+make_interval(mins=>r.step_minutes),'HH24:MI'),'end',to_char(t+make_interval(mins=>r.step_minutes),'HH24:MI'),'free',available));
  end if;
  t:=t+make_interval(mins=>r.step_minutes);
 end loop;
 return jsonb_build_object('date',p_date,'today',clock::date,'slots',slots,'day_left',greatest(r.daily_cap-used,0),'days_ahead',r.days_ahead,'urgent_left',case when p_date=clock::date then (select count(*) from jsonb_array_elements(slots) x where (x->>'free')::boolean) else 0 end,'urgent_fee',r.urgent_fee,'urgent_open',p_date=clock::date and exists(select 1 from jsonb_array_elements(slots) x where (x->>'free')::boolean));
end $$;
revoke all on function public.pilot_available_slots(date) from public,anon,authenticated;
grant execute on function public.pilot_available_slots(date) to anon,authenticated;
create or replace function public.pilot_create_booking_v2(p_request jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  o public.pilot_orders; c public.pilot_catalogue; k text; item text;
  phone_value text; nm text; sp text; branch text; total_value integer:=0;
  quoted boolean:=false; items jsonb:='[]'; n integer; keys text[];
  r public.pilot_slot_rules; day date; start_time time; now_local timestamp:=now() at time zone 'Asia/Kolkata';
  urgent_job boolean:=false; ready_time timestamptz; chosen text;
begin
  if p_key is null or p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>8000 then
    raise exception 'Invalid request'; end if;
  -- Serialize retries: a lost response must not create a second job.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into o from public.pilot_orders where request_key=p_key;
  if found then
    if o.request_data<>p_request then raise exception 'Request changed. Please start a new request.'; end if;
    return jsonb_build_object('code',o.code,'token',o.receipt_token,'estimate',o.estimate,'needs_quote',o.needs_quote,'status',o.status,'slot_date',o.slot_date,'slot_start',to_char(o.slot_start,'HH24:MI'),'ready_by',to_char(o.promised_ready_at at time zone 'Asia/Kolkata','HH24:MI'),'urgent',o.urgent);
  end if;
  nm:=trim(coalesce(p_request->>'name','')); phone_value:=regexp_replace(coalesce(p_request->>'phone',''),'[^0-9]','','g');
  if length(phone_value)=12 and left(phone_value,2)='91' then phone_value:=right(phone_value,10); end if;
  sp:=coalesce(p_request->>'sport',''); branch:=coalesce(p_request->>'shop','');
  if length(nm)<1 or length(nm)>80 or phone_value !~ '^[6-9][0-9]{9}$' or sp not in ('badminton','cricket','shoe') or branch not in ('6th','5th') then
    raise exception 'Check your name, mobile number, service and drop-off shop.'; end if;
  if length(coalesce(p_request->>'gear',''))>120 or length(coalesce(p_request->>'note',''))>600 or length(coalesce(p_request->>'src',''))>100 then
    raise exception 'Some details are too long.'; end if;
  if coalesce(p_request->>'payment','') not in ('UPI','Cash','Card') then raise exception 'Choose a payment method.'; end if;
  -- Modest phone-based limits for the counter pilot, not phone verification.
  perform pg_advisory_xact_lock(hashtextextended(phone_value,1));
  if (select count(*) from public.pilot_orders where phone=phone_value and created_at>now()-interval '1 minute')>=2
     or (select count(*) from public.pilot_orders where phone=phone_value and created_at>now()-interval '1 day')>=10 then
    raise exception 'Too many requests. Please ask the counter team for help.'; end if;
  if sp='badminton' then
    if length(trim(coalesce(p_request->>'gear','')))<2 then raise exception 'Enter your racket model.'; end if;
    select * into r from public.pilot_slot_rules where id;
    urgent_job:=coalesce((p_request->>'urgent')::boolean,false);
    begin day:=case when urgent_job then now_local::date else (p_request->>'slot_date')::date end;
    exception when others then raise exception 'Choose a booking date.'; end;
    if day is null or day<now_local::date or day>now_local::date+r.days_ahead then raise exception 'Choose an available booking date.'; end if;
    perform pg_advisory_xact_lock(hashtextextended('slots:'||day::text,2));
    if urgent_job then
      select slot->>'start' into chosen from jsonb_array_elements(public.pilot_available_slots(day)->'slots') slot where (slot->>'free')::boolean order by slot->>'start' limit 1;
      if chosen is null then raise exception 'No urgent slot remains today. Choose another day.'; end if;
      start_time:=chosen::time;
    else
      begin start_time:=(p_request->>'slot_start')::time; exception when others then raise exception 'Choose a valid slot.'; end;
      if not exists(select 1 from jsonb_array_elements(public.pilot_available_slots(day)->'slots') slot where slot->>'start'=to_char(start_time,'HH24:MI') and (slot->>'free')::boolean)
      or extract(second from start_time)<>0 then raise exception 'That slot is no longer available. Choose another.'; end if;
    end if;
    ready_time:=(day+start_time+make_interval(mins=>r.step_minutes)) at time zone 'Asia/Kolkata';
    select * into c from public.pilot_catalogue where key=p_request->>'string_key' and sport=sp and active;
    if not found or c.price is null then raise exception 'That string is unavailable. Please choose another.'; end if;
    if p_request->>'colour'='Other' then
      if length(trim(coalesce(p_request->>'colour_other','')))<2 or length(p_request->>'colour_other')>40 then raise exception 'Enter the colour you want.'; end if;
    elsif not (c.colours ? coalesce(p_request->>'colour','')) then raise exception 'Choose a listed colour.'; end if;
    if coalesce(p_request->>'knots','') not in ('2','4') then raise exception 'Choose 2 or 4 knots.'; end if;
    foreach k in array array['mains','crosses'] loop
      if coalesce(p_request->>k,'') !~ '^([12][0-9]|3[0-5])$' then raise exception 'Tension must be 18–35 lbs.'; end if;
      n:=(p_request->>k)::integer;
      if n<18 or n>35 then raise exception 'Tension must be 18–35 lbs.'; end if;
    end loop;
    items:=items||jsonb_build_array(jsonb_build_object('name',c.name,'price',c.price)); total_value:=c.price;
    if p_request->>'knots'='4' then items:=items||jsonb_build_array(jsonb_build_object('name','4-knot stringing','price',25)); total_value:=total_value+25; end if;
    if coalesce((p_request->>'pre_stretch')::boolean,false) then items:=items||jsonb_build_array(jsonb_build_object('name','Pre-stretch','price',25)); total_value:=total_value+25; end if;
    if urgent_job then items:=items||jsonb_build_array(jsonb_build_object('name','Urgent','price',r.urgent_fee)); total_value:=total_value+r.urgent_fee; end if;
  elsif sp='cricket' then
    if jsonb_typeof(p_request->'jobs') is distinct from 'array' then raise exception 'Choose your bat work.'; end if;
    select array_agg(distinct value) into keys from jsonb_array_elements_text(p_request->'jobs');
    if coalesce(array_length(keys,1),0)=0 or array_length(keys,1)>9 then raise exception 'Choose your bat work.'; end if;
    if keys @> array['hand','machine'] then raise exception 'Choose one knocking method.'; end if;
    if (select count(*) from unnest(keys) x where x like 'handle-%')>1 then raise exception 'Choose one handle.'; end if;
    foreach item in array keys loop
      select * into c from public.pilot_catalogue where key=item and sport=sp and active;
      if not found then raise exception 'An invalid bat service was selected.'; end if;
      items:=items||jsonb_build_array(jsonb_build_object('name',c.name,'price',c.price));
      total_value:=total_value+coalesce(c.price,0); quoted:=quoted or c.price is null;
    end loop;
  else
    if length(trim(coalesce(p_request->>'note','')))<3 then raise exception 'Tell us what the shoes need.'; end if;
    items:=jsonb_build_array(jsonb_build_object('name','Shoe repair','price',null)); quoted:=true;
  end if;
  insert into public.pilot_orders(request_key,request_data,customer_name,phone,sport,shop,gear,note,src,lines,estimate,needs_quote,slot_date,slot_start,urgent,pay_method,promised_ready_at)
    values(p_key,p_request,nm,phone_value,sp,branch,coalesce(p_request->>'gear',''),coalesce(p_request->>'note',''),coalesce(p_request->>'src',''),items,total_value,quoted,day,start_time,urgent_job,p_request->>'payment',ready_time)
    returning * into o;
  insert into public.pilot_events(order_id,action) values(o.id,'Requested');
  return jsonb_build_object('code',o.code,'token',o.receipt_token,'estimate',o.estimate,'needs_quote',o.needs_quote,'status',o.status,'slot_date',o.slot_date,'slot_start',to_char(o.slot_start,'HH24:MI'),'ready_by',to_char(o.promised_ready_at at time zone 'Asia/Kolkata','HH24:MI'),'urgent',o.urgent);
end $$;
revoke all on function public.pilot_create_booking_v2(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.pilot_create_booking_v2(jsonb,uuid) to anon,authenticated;


-- The legacy endpoint must enforce the same slot rules.
create or replace function public.pilot_create_booking(p_request jsonb,p_key uuid) returns jsonb
language sql security definer set search_path='' as $$ select public.pilot_create_booking_v2(p_request,p_key) $$;

create or replace function public.pilot_record_payment_v3(p_order uuid,p_amount integer,p_method text,p_kind text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.pilot_orders; previous public.pilot_payments; paid_total integer; agreed integer;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_key is null then raise exception 'Payment retry key required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,3));
 select * into previous from public.pilot_payments where request_key=p_key;
 if found then
  if previous.order_id is distinct from p_order or previous.amount is distinct from p_amount or previous.method is distinct from p_method or previous.kind is distinct from p_kind then raise exception 'Payment request changed.'; end if;
  return jsonb_build_object('recorded',true,'payment_id',previous.id,'paid_total',(select coalesce(sum(amount),0) from public.pilot_payments where order_id=p_order),'balance',(select greatest(coalesce(final_total,estimate)-(select coalesce(sum(amount),0) from public.pilot_payments where order_id=p_order),0) from public.pilot_orders where id=p_order),'paid',(select paid from public.pilot_orders where id=p_order));
 end if;
 select * into o from public.pilot_orders where id=p_order for update;
 if not found or o.status not in ('Requested','Accepted','At the bench','Ready') or (o.final_total is null and o.needs_quote) then raise exception 'Accept the job and confirm its price first.'; end if;
 agreed:=coalesce(o.final_total,o.estimate);
 select coalesce(sum(amount),0) into paid_total from public.pilot_payments where order_id=o.id;
 if p_amount is null or p_amount<=0 or p_amount>agreed-paid_total then raise exception 'Enter an amount no greater than the balance.'; end if;
 if p_method is null or p_method not in ('UPI','Cash','Card') or p_kind is null or p_kind not in ('advance','part','balance') then raise exception 'Choose a payment method and type.'; end if;
 insert into public.pilot_payments(order_id,amount,method,kind,actor,request_key) values(o.id,p_amount,p_method,p_kind,auth.uid(),p_key) returning * into previous;
 update public.pilot_orders set paid=final_total is not null and paid_total+p_amount=final_total,paid_at=case when paid_total+p_amount=final_total then now() else null end,updated_at=now() where id=o.id;
 insert into public.pilot_events(order_id,action,actor,detail) values(o.id,'payment',auth.uid(),jsonb_build_object('amount',p_amount,'method',p_method,'kind',p_kind,'payment_id',previous.id));
 return jsonb_build_object('recorded',true,'payment_id',previous.id,'paid_total',paid_total+p_amount,'balance',greatest(agreed-paid_total-p_amount,0),'paid',o.final_total is not null and paid_total+p_amount=o.final_total);
end $$;
revoke all on function public.pilot_record_payment_v3(uuid,integer,text,text,uuid) from public,anon,authenticated;
grant execute on function public.pilot_record_payment_v3(uuid,integer,text,text,uuid) to authenticated;
-- Old clients cannot bypass the retry-safe ledger.
create or replace function public.pilot_record_payment(p_order uuid,p_amount integer,p_method text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin raise exception 'Refresh the staff page to record payments.'; end $$;
revoke all on function public.pilot_record_payment(uuid,integer,text,text) from public,anon,authenticated;
create or replace function public.pilot_update_order(p_id uuid,p_expected text,p_action text,p_amount integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.pilot_orders; new_status text; received integer;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 select * into o from public.pilot_orders where id=p_id for update;
 if not found then raise exception 'Job not found.'; end if;
 if o.status<>p_expected then raise exception 'This job changed. Refresh the queue.'; end if;
 select coalesce(sum(amount),0) into received from public.pilot_payments where order_id=o.id;
 new_status:=o.status;
 case p_action
 when 'accept' then
   if o.status<>'Requested' or p_amount is null or p_amount<0 or p_amount>100000 then raise exception 'Confirm the final price before accepting.'; end if;
   if p_amount<received then raise exception 'Price cannot be below recorded payments.'; end if;
   new_status:='Accepted'; o.final_total:=p_amount; o.paid:=received=p_amount;
 when 'start' then if o.status<>'Accepted' then raise exception 'Accept the job first.'; end if; new_status:='At the bench';
 when 'ready' then if o.status<>'At the bench' then raise exception 'Start the work first.'; end if; new_status:='Ready';
 when 'pay' then raise exception 'Use the payment form to record money received.';
 when 'collect' then if o.status<>'Ready' or o.final_total is null or received<>o.final_total then raise exception 'Mark ready and record payment before collection.'; end if; new_status:='Collected';
 when 'cancel' then
   if o.status not in ('Requested','Accepted') or received>0 then raise exception 'Only unpaid, unstarted jobs can be cancelled here.'; end if;
   new_status:='Cancelled';
 else raise exception 'Invalid action.';
 end case;
 update public.pilot_orders set status=new_status,final_total=o.final_total,paid=o.paid,paid_at=o.paid_at,updated_at=now() where id=o.id returning * into o;
 insert into public.pilot_events(order_id,action,actor,detail) values(o.id,p_action,auth.uid(),jsonb_build_object('status',new_status,'final_total',o.final_total));
 return jsonb_build_object('code',o.code,'status',o.status,'paid',o.paid);
end $$;
revoke all on function public.pilot_update_order(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.pilot_update_order(uuid,text,text,integer) to authenticated;


create or replace function public.pilot_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.data order by x.created_at desc) from (
 select to_jsonb(o)-'request_key'-'receipt_token'||jsonb_build_object('status_token',o.receipt_token,'ready_by',to_char(o.promised_ready_at at time zone 'Asia/Kolkata','HH24:MI'),'paid_total',(select coalesce(sum(amount),0) from public.pilot_payments where order_id=o.id),'payments',(select coalesce(jsonb_agg(jsonb_build_object('amount',amount,'method',method,'kind',kind,'at',at) order by at),'[]') from public.pilot_payments where order_id=o.id)) as data,o.created_at
 from public.pilot_orders o where status not in ('Collected','Cancelled') or updated_at>now()-interval '1 day' order by created_at desc limit 300) x),'[]'::jsonb);
end $$;
revoke all on function public.pilot_queue() from public,anon,authenticated;
grant execute on function public.pilot_queue() to authenticated;
create or replace function public.pilot_track_booking_v2(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',code,'sport',sport,'status',status,'shop',shop,'estimate',estimate,'needs_quote',needs_quote,'final_total',final_total,'lines',lines,'pay_method',pay_method,'ready_by',to_char(promised_ready_at at time zone 'Asia/Kolkata','HH24:MI'),'balance',greatest(coalesce(final_total,estimate)-(select coalesce(sum(amount),0) from public.pilot_payments where order_id=o.id),0),'paid',paid,'paid_total',(select coalesce(sum(amount),0) from public.pilot_payments where order_id=o.id),'slot_date',slot_date,'slot_start',slot_start,'promised_ready_at',promised_ready_at,'urgent',urgent,'updated_at',updated_at)
 from public.pilot_orders o where receipt_token=p_token and anonymised_at is null;
$$;
revoke all on function public.pilot_track_booking_v2(uuid) from public,anon,authenticated;
grant execute on function public.pilot_track_booking_v2(uuid) to anon,authenticated;
create or replace function public.pilot_track_booking(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$ select public.pilot_track_booking_v2(p_token) $$;
create or replace function public.pilot_queue_v2() returns jsonb language sql stable security definer set search_path='' as $$ select public.pilot_queue() $$;
revoke all on function public.pilot_queue_v2() from public,anon,authenticated;
grant execute on function public.pilot_queue_v2() to authenticated;
commit;
