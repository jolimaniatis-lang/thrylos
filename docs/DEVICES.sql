-- Θρύλος Daily: μετρητής διαφορετικών συσκευών (Supabase → SQL Editor → Run, μία φορά)
-- Αποθηκεύει ΜΟΝΟ ένα τυχαίο ανώνυμο αναγνωριστικό ανά συσκευή (χωρίς όνομα, IP ή άλλα στοιχεία).
-- Ο πίνακας δεν έχει policies: η εφαρμογή δεν μπορεί να τον διαβάσει/γράψει απευθείας, μόνο μέσω των 2 συναρτήσεων.
create table if not exists public.devices(
  id text primary key check (char_length(id) between 8 and 64),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now());
alter table public.devices enable row level security;
create or replace function public.register_device(d text) returns void
  language sql security definer set search_path = public as
$$ insert into public.devices(id) values (left(d,64))
   on conflict (id) do update set last_seen = now(); $$;
create or replace function public.device_count() returns integer
  language sql stable security definer set search_path = public as
$$ select count(*)::int from public.devices; $$;
grant execute on function public.register_device(text), public.device_count() to anon, authenticated;
-- Επαναφορά (αν θες να το αφαιρέσεις):
-- drop function public.register_device(text); drop function public.device_count(); drop table public.devices;
