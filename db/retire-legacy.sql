-- Only run after checking the live pilot and reviewing legacy-preflight.sql.
-- This intentionally refuses to delete any orders, events, stock or changed configuration.
begin;
lock table public.orders,public.status_events,public.stock,public.config in access exclusive mode;
do $$ begin
 if exists(select 1 from public.orders) or exists(select 1 from public.status_events)
 or exists(select 1 from public.stock) then raise exception 'Legacy data exists: back up and review before retiring'; end if;
 if exists(select 1 from public.config where key<>'bench' or value<>'{"busy":false}'::jsonb)
 then raise exception 'Unexpected legacy configuration: review before retiring'; end if;
end $$;
drop function if exists public.track_order(text);
drop table public.status_events;
drop table public.orders;
drop function if exists public.log_status();
drop table public.stock;
drop table public.config;
-- No CASCADE: unexpected dependencies abort the transaction.
commit;
