-- Run as project owner only, after pilot.sql and after the staff member has
-- created and verified this Supabase Auth identity. No password is stored here.
do $$
declare staff_id uuid;
begin
  select id into staff_id from auth.users
    where lower(email)='sportlinegear@gmail.com' and email_confirmed_at is not null;
  if staff_id is null then
    raise exception 'Create and verify sportlinegear@gmail.com in Supabase Auth first. No access was granted.';
  end if;
  insert into public.pilot_staff(user_id,enabled) values(staff_id,true)
    on conflict(user_id) do update set enabled=true;
end $$;
