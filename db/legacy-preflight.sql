-- Counts only. Review backups and dependencies before dropping anything.
select 'orders' as table_name,count(*) from public.orders
union all select 'status_events',count(*) from public.status_events
union all select 'stock',count(*) from public.stock
union all select 'config',count(*) from public.config;
