-- Apply after pilot.sql. Safe to rerun; does not drop legacy data.
begin;
insert into public.pilot_catalogue(key,sport,name,price,colours) values
('Yonex|Exbolt 68','badminton','Yonex Exbolt 68',1100,'["Confirm at counter"]')
on conflict(key) do nothing;

-- Newly reported stock and prices supplied by the shop.
insert into public.pilot_catalogue(key,sport,name,price,colours,active) values
('Max Bolt|63','badminton','Max Bolt 63',500,'["Violet","Mint Green","Orange","Bright Pink","Light Blue","Black","Blue","Maroon","Half White"]'::jsonb,true),
('Max Bolt|66','badminton','Max Bolt 66',600,'["Violet"]'::jsonb,true),
('Max Bolt|70','badminton','Max Bolt 70',550,'["White","Violet","Blue","Red"]'::jsonb,true),
('Gonkee|GK-65','badminton','Gonkee GK-65',500,'["Red"]'::jsonb,true),
('Apacs|Cross Court 66','badminton','Apacs Cross Court 66',500,'["Maroon","Red","White"]'::jsonb,true)
on conflict(key) do update set
 name=excluded.name, price=excluded.price, colours=excluded.colours, active=excluded.active;
-- Await Shankar's approved prices. These cannot be booked until activated.
insert into public.pilot_catalogue(key,sport,name,price,colours,active)
select brand||'|'||model,'badminton',brand||' '||model,null,'["Confirm at counter"]'::jsonb,false
from (values ('Li-Ning','AP64 Rainbow'),('Li-Ning','AP70 Turbo'),('Cozmio','CZ 600'),
('Cozmio','CZ Power 700'),('Apacs','Cross Court 66'),('Max Bolt','66'),('Mas Pro','BS-1000'),
('Transform','TS-One'),('Kumpoo','K65'),('Gosen','G-Pro 70'),('Hundred','JP63 Hunter')) s(brand,model)
on conflict(key) do nothing;

create or replace function public.pilot_public_catalogue() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('key',key,'sport',sport,'name',name,'price',price,'colours',colours)
 order by case when key='Yonex|BG65' then 0 else 1 end,key),'[]'::jsonb)
 from public.pilot_catalogue where active and (sport='cricket' or (sport='badminton' and price is not null and jsonb_array_length(colours)>0));
$$;
revoke all on function public.pilot_public_catalogue() from public,anon,authenticated;
grant execute on function public.pilot_public_catalogue() to anon,authenticated;

alter table public.pilot_orders add column if not exists completed_at timestamptz;
alter table public.pilot_orders add column if not exists anonymised_at timestamptz;
update public.pilot_orders set completed_at=updated_at where completed_at is null and status in ('Collected','Cancelled');
create or replace function public.pilot_completion_time() returns trigger
language plpgsql set search_path='' as $$ begin
 if new.status in ('Collected','Cancelled') and old.status not in ('Collected','Cancelled') then new.completed_at=now(); end if;
 return new;
end $$;
drop trigger if exists pilot_completion_time on public.pilot_orders;
create trigger pilot_completion_time before update of status on public.pilot_orders for each row execute function public.pilot_completion_time();

create table if not exists public.pilot_marketing_contacts (
 phone text primary key, customer_name text not null, consent_at timestamptz not null,
 expires_at timestamptz not null, confirmed_by uuid not null references auth.users(id),
 consent_version text not null default 'offers-v1-12months'
);
alter table public.pilot_marketing_contacts enable row level security;
revoke all on public.pilot_marketing_contacts from anon,authenticated;
create or replace function public.pilot_marketing_consent(p_order uuid,p_opt_in boolean) returns void
language plpgsql security definer set search_path='' as $$
declare o public.pilot_orders;
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required'; end if;
 select * into o from public.pilot_orders where id=p_order and anonymised_at is null for update;
 if not found then raise exception 'Job not found'; end if;
 if p_opt_in then
  if coalesce(o.request_data->>'marketing_opt_in','false')<>'true' then raise exception 'Customer has not requested offers'; end if;
  insert into public.pilot_marketing_contacts(phone,customer_name,consent_at,expires_at,confirmed_by)
  values(o.phone,o.customer_name,now(),now()+interval '12 months',auth.uid())
  on conflict(phone) do update set customer_name=excluded.customer_name,consent_at=excluded.consent_at,expires_at=excluded.expires_at,confirmed_by=excluded.confirmed_by;
 else
  delete from public.pilot_marketing_contacts where phone=o.phone;
  -- Clear old requests too, so a stale opt-in cannot be reconfirmed accidentally.
  update public.pilot_orders set request_data=request_data||'{"marketing_opt_in":false}'::jsonb where phone=o.phone;
 end if;
 insert into public.pilot_events(order_id,action,actor) values(o.id,case when p_opt_in then 'Offers opted in' else 'Offers withdrawn' end,auth.uid());
end $$;
revoke all on function public.pilot_marketing_consent(uuid,boolean) from public,anon,authenticated;
grant execute on function public.pilot_marketing_consent(uuid,boolean) to authenticated;

create or replace function public.pilot_withdraw_offers(p_phone text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.pilot_is_staff() then raise exception 'Staff access required'; end if;
 if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a 10-digit mobile number'; end if;
 delete from public.pilot_marketing_contacts where phone=p_phone;
 update public.pilot_orders set request_data=request_data||'{"marketing_opt_in":false}'::jsonb where phone=p_phone;
end $$;
revoke all on function public.pilot_withdraw_offers(text) from public,anon,authenticated;
grant execute on function public.pilot_withdraw_offers(text) to authenticated;

create or replace function public.pilot_purge_personal_data() returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 update public.pilot_orders set customer_name='Removed after retention period',phone='',gear='',note='',src='',request_data='{}',receipt_token=gen_random_uuid(),anonymised_at=now()
 where status in ('Collected','Cancelled') and completed_at < now()-interval '12 months' and anonymised_at is null;
 get diagnostics affected=row_count;
 -- Audit details must not become a second copy of customer data.
 update public.pilot_events e set detail='{}' from public.pilot_orders o where e.order_id=o.id and o.anonymised_at is not null and e.detail<>'{}'::jsonb;
 delete from public.pilot_marketing_contacts where expires_at<=now();
 return affected;
end $$;
revoke all on function public.pilot_purge_personal_data() from public,anon,authenticated;
-- Execution is database-owner only, via the scheduled job in the next file.
commit;
