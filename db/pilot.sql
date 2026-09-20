-- Shop pilot. Run as database owner in Supabase SQL Editor.
-- Uses separate pilot tables; no existing order is deleted or migrated.
begin;
create table if not exists public.pilot_staff (
  user_id uuid primary key references auth.users(id), enabled boolean not null default true
);
create table if not exists public.pilot_catalogue (
  key text primary key, sport text not null, name text not null,
  price integer check(price >= 0), colours jsonb not null default '[]', active boolean not null default true
);
create table if not exists public.pilot_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('SL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  request_key uuid not null unique, receipt_token uuid not null unique default gen_random_uuid(),
  request_data jsonb not null, customer_name text not null, phone text not null,
  sport text not null check(sport in ('badminton','cricket')), shop text not null check(shop in ('6th','5th')),
  gear text not null default '', note text not null default '', src text not null default '',
  lines jsonb not null, estimate integer not null check(estimate >= 0), needs_quote boolean not null,
  final_total integer check(final_total between 0 and 100000),
  status text not null default 'Requested' check(status in ('Requested','Accepted','At the bench','Ready','Collected','Cancelled')),
  paid boolean not null default false, paid_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists pilot_orders_queue_idx on public.pilot_orders(status,created_at);
create index if not exists pilot_orders_phone_idx on public.pilot_orders(phone,created_at);
create table if not exists public.pilot_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.pilot_orders(id),
  action text not null, actor uuid, at timestamptz not null default now(), detail jsonb not null default '{}'
);
alter table public.pilot_staff enable row level security;
alter table public.pilot_catalogue enable row level security;
alter table public.pilot_orders enable row level security;
alter table public.pilot_events enable row level security;
revoke all on public.pilot_staff, public.pilot_catalogue, public.pilot_orders, public.pilot_events from anon, authenticated;

create or replace function public.pilot_is_staff() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.pilot_staff where user_id=auth.uid() and enabled);
$$;
revoke all on function public.pilot_is_staff() from public, anon, authenticated;
grant execute on function public.pilot_is_staff() to authenticated;

create or replace function public.pilot_create_booking(p_request jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  o public.pilot_orders; c public.pilot_catalogue; k text; item text;
  phone_value text; nm text; sp text; branch text; total_value integer:=0;
  quoted boolean:=false; items jsonb:='[]'; n integer; keys text[];
begin
  if p_key is null or p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>8000 then
    raise exception 'Invalid request'; end if;
  -- Serialize retries: a lost response must not create a second job.
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into o from public.pilot_orders where request_key=p_key;
  if found then
    if o.request_data<>p_request then raise exception 'Request changed. Please start a new request.'; end if;
    return jsonb_build_object('code',o.code,'token',o.receipt_token,'estimate',o.estimate,'needs_quote',o.needs_quote,'status',o.status);
  end if;
  nm:=trim(coalesce(p_request->>'name','')); phone_value:=regexp_replace(coalesce(p_request->>'phone',''),'[^0-9]','','g');
  sp:=coalesce(p_request->>'sport',''); branch:=coalesce(p_request->>'shop','');
  if length(nm)<1 or length(nm)>80 or phone_value !~ '^[6-9][0-9]{9}$' or sp not in ('badminton','cricket') or branch not in ('6th','5th') then
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
    select * into c from public.pilot_catalogue where key=p_request->>'string_key' and sport=sp and active;
    if not found then raise exception 'That string is unavailable. Please choose another.'; end if;
    if not (c.colours ? coalesce(p_request->>'colour','')) then raise exception 'Choose a listed colour.'; end if;
    if coalesce(p_request->>'knots','') not in ('2','4') then raise exception 'Choose 2 or 4 knots.'; end if;
    foreach k in array array['mains','crosses'] loop
      if coalesce(p_request->>k,'') !~ '^([12][0-9]|3[0-5])$' then raise exception 'Tension must be 18–35 lbs.'; end if;
      n:=(p_request->>k)::integer;
      if n<18 or n>35 then raise exception 'Tension must be 18–35 lbs.'; end if;
    end loop;
    if coalesce(p_request->>'needed','') not in ('Same day, if available','Next day','No rush') then raise exception 'Choose when you need your gear.'; end if;
    items:=items||jsonb_build_array(jsonb_build_object('name',c.name,'price',c.price)); total_value:=c.price;
    if p_request->>'knots'='4' then items:=items||jsonb_build_array(jsonb_build_object('name','4-knot stringing','price',25)); total_value:=total_value+25; end if;
    if coalesce((p_request->>'pre_stretch')::boolean,false) then items:=items||jsonb_build_array(jsonb_build_object('name','Pre-stretch','price',25)); total_value:=total_value+25; end if;
    if coalesce((p_request->>'priority')::boolean,false) then items:=items||jsonb_build_array(jsonb_build_object('name','Priority, if confirmed','price',100)); total_value:=total_value+100; end if;
  else
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
  end if;
  insert into public.pilot_orders(request_key,request_data,customer_name,phone,sport,shop,gear,note,src,lines,estimate,needs_quote)
    values(p_key,p_request,nm,phone_value,sp,branch,coalesce(p_request->>'gear',''),coalesce(p_request->>'note',''),coalesce(p_request->>'src',''),items,total_value,quoted)
    returning * into o;
  insert into public.pilot_events(order_id,action) values(o.id,'Requested');
  return jsonb_build_object('code',o.code,'token',o.receipt_token,'estimate',o.estimate,'needs_quote',o.needs_quote,'status',o.status);
end $$;
revoke all on function public.pilot_create_booking(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.pilot_create_booking(jsonb,uuid) to anon,authenticated;

create or replace function public.pilot_track_booking(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('code',code,'status',status,'shop',shop,'estimate',estimate,'needs_quote',needs_quote,
   'final_total',final_total,'paid',paid,'updated_at',updated_at)
 from public.pilot_orders where receipt_token=p_token;
$$;
revoke all on function public.pilot_track_booking(uuid) from public,anon,authenticated;
grant execute on function public.pilot_track_booking(uuid) to anon,authenticated;

create or replace function public.pilot_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(x.data order by x.created_at desc) from (
   select to_jsonb(o)-'receipt_token'-'request_key' as data,o.created_at from public.pilot_orders o
   where status not in ('Collected','Cancelled') or updated_at>now()-interval '1 day'
   order by created_at desc limit 300) x),'[]'::jsonb);
end $$;
revoke all on function public.pilot_queue() from public,anon,authenticated;
grant execute on function public.pilot_queue() to authenticated;

create or replace function public.pilot_update_order(p_id uuid,p_expected text,p_action text,p_amount integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.pilot_orders; new_status text;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 select * into o from public.pilot_orders where id=p_id for update;
 if not found then raise exception 'Job not found.'; end if;
 if o.status<>p_expected then raise exception 'This job changed. Refresh the queue.'; end if;
 new_status:=o.status;
 case p_action
 when 'accept' then
   if o.status<>'Requested' or p_amount is null or p_amount<0 or p_amount>100000 then raise exception 'Confirm the final price before accepting.'; end if;
   new_status:='Accepted'; o.final_total:=p_amount;
 when 'start' then if o.status<>'Accepted' then raise exception 'Accept the job first.'; end if; new_status:='At the bench';
 when 'ready' then if o.status<>'At the bench' then raise exception 'Start the work first.'; end if; new_status:='Ready';
 when 'pay' then
   if o.status not in ('Accepted','At the bench','Ready') or o.paid then raise exception 'Payment cannot be recorded now.'; end if;
   o.paid:=true; o.paid_at:=now();
 when 'collect' then if o.status<>'Ready' or not o.paid then raise exception 'Mark ready and record payment before collection.'; end if; new_status:='Collected';
 when 'cancel' then
   if o.status not in ('Requested','Accepted') or o.paid then raise exception 'Only unpaid, unstarted jobs can be cancelled here.'; end if;
   new_status:='Cancelled';
 else raise exception 'Invalid action.';
 end case;
 update public.pilot_orders set status=new_status,final_total=o.final_total,paid=o.paid,paid_at=o.paid_at,updated_at=now() where id=o.id returning * into o;
 insert into public.pilot_events(order_id,action,actor,detail) values(o.id,p_action,auth.uid(),jsonb_build_object('status',new_status,'final_total',o.final_total));
 return jsonb_build_object('code',o.code,'status',o.status,'paid',o.paid);
end $$;
revoke all on function public.pilot_update_order(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.pilot_update_order(uuid,text,text,integer) to authenticated;

-- Close the older schema's public insertion and all-authenticated access.
-- It is not used by the current WhatsApp-only pages; existing rows are preserved.
do $$ begin
 if to_regclass('public.orders') is not null then
   revoke all on public.orders from anon,authenticated;
 end if;
 if to_regclass('public.status_events') is not null then revoke all on public.status_events from anon,authenticated; end if;
 if to_regclass('public.stock') is not null then revoke all on public.stock from anon,authenticated; end if;
 if to_regclass('public.config') is not null then revoke all on public.config from anon,authenticated; end if;
 if to_regprocedure('public.track_order(text)') is not null then revoke all on function public.track_order(text) from public,anon,authenticated; end if;
end $$;
commit;
