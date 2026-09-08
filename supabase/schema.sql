-- TransitAI database schema (PostgreSQL / Supabase).
-- Run this once a database is connected. The app's data-source layer
-- (src/lib/transit/data-source.ts) maps these tables 1:1 to TransitNetwork.

create table if not exists public.bus_stops (
  id text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null
);

create table if not exists public.bus_routes (
  id text primary key,
  route_number text not null,
  route_name text not null,
  description text
);

create table if not exists public.route_stops (
  id text primary key,
  route_id text not null references public.bus_routes(id) on delete cascade,
  stop_id text not null references public.bus_stops(id) on delete cascade,
  stop_sequence integer not null,
  unique (route_id, stop_sequence)
);

create table if not exists public.travel_data (
  id text primary key,
  route_id text not null references public.bus_routes(id) on delete cascade,
  from_stop_id text not null references public.bus_stops(id) on delete cascade,
  to_stop_id text not null references public.bus_stops(id) on delete cascade,
  time_of_day text not null default 'all',
  day_of_week text not null default 'all',
  average_travel_minutes numeric not null
);

create table if not exists public.fares (
  id text primary key,
  route_id text not null references public.bus_routes(id) on delete cascade,
  fare numeric not null
);

-- Public read-only access (transit data is not user-specific)
grant select on public.bus_stops, public.bus_routes, public.route_stops, public.travel_data, public.fares to anon, authenticated;
grant all on public.bus_stops, public.bus_routes, public.route_stops, public.travel_data, public.fares to service_role;

alter table public.bus_stops enable row level security;
alter table public.bus_routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.travel_data enable row level security;
alter table public.fares enable row level security;

create policy "public read bus_stops" on public.bus_stops for select to anon, authenticated using (true);
create policy "public read bus_routes" on public.bus_routes for select to anon, authenticated using (true);
create policy "public read route_stops" on public.route_stops for select to anon, authenticated using (true);
create policy "public read travel_data" on public.travel_data for select to anon, authenticated using (true);
create policy "public read fares" on public.fares for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- DEMO DATA (fictional routes; names reuse Yangon neighbourhoods for readability)
-- ---------------------------------------------------------------------------
insert into public.bus_stops (id, name, latitude, longitude) values
 ('s01','Sule Pagoda',16.7746,96.1583),('s02','Bogyoke Market',16.7803,96.1550),
 ('s03','Central Railway Station',16.7830,96.1610),('s04','Kandawgyi',16.7880,96.1700),
 ('s05','Shwedagon South Gate',16.7950,96.1490),('s06','Bahan',16.8060,96.1560),
 ('s07','Hledan',16.8275,96.1315),('s08','Myaynigone',16.8130,96.1370),
 ('s09','Sanchaung',16.8090,96.1290),('s10','Kamayut',16.8320,96.1360),
 ('s11','Inya Lake',16.8400,96.1470),('s12','Kabaraye',16.8420,96.1560),
 ('s13','8 Mile',16.8600,96.1450),('s14','Yankin Centre',16.8290,96.1650),
 ('s15','Tamwe',16.8000,96.1730),('s16','Thingangyun',16.8250,96.1880),
 ('s17','South Okkalapa',16.8480,96.1800),('s18','North Dagon',16.8700,96.1950),
 ('s19','Botahtaung',16.7700,96.1720),('s20','Pansodan',16.7740,96.1630),
 ('s21','Lanmadaw',16.7800,96.1440),('s22','Kyeemyindaing',16.7900,96.1250),
 ('s23','Ahlone',16.7860,96.1330),('s24','Insein',16.8900,96.1080),
 ('s25','Mayangone',16.8620,96.1300),('s26','Thamaing',16.8750,96.1300),
 ('s27','Yangon Airport',16.9040,96.1340),('s28','Kyauk Myaung',16.8050,96.1800),
 ('s29','Parami',16.8580,96.1560),('s30','Bayint Naung',16.8560,96.1200)
on conflict do nothing;

insert into public.bus_routes (id, route_number, route_name, description) values
 ('r1','DEMO-1','Insein – Sule (Pyay Road)','Demo trunk line down Pyay Road'),
 ('r2','DEMO-2','Airport – Sule (Kabaraye)','Demo line via Kabaraye and Kandawgyi'),
 ('r3','DEMO-3','Kyeemyindaing – Thingangyun','Demo east–west line through downtown'),
 ('r4','DEMO-4','Hledan – North Dagon','Demo northern crosstown'),
 ('r5','DEMO-5','Sanchaung – Sule (riverside)','Demo loop via Tamwe and Botahtaung'),
 ('r6','DEMO-6','Bayint Naung – Thingangyun','Demo northern ring')
on conflict do nothing;

with seq(route_id, stops) as (values
 ('r1', array['s24','s26','s25','s13','s10','s07','s08','s05','s21','s02','s01']),
 ('r2', array['s27','s13','s29','s12','s11','s06','s04','s03','s20','s01']),
 ('r3', array['s22','s23','s21','s02','s03','s15','s28','s16']),
 ('r4', array['s07','s11','s12','s14','s17','s18']),
 ('r5', array['s09','s08','s06','s15','s19','s20','s01']),
 ('r6', array['s30','s25','s29','s14','s16'])
)
insert into public.route_stops (id, route_id, stop_id, stop_sequence)
select route_id || '-' || ord, route_id, stop_id, ord
from seq, unnest(stops) with ordinality as u(stop_id, ord)
on conflict do nothing;

insert into public.fares (id, route_id, fare) values
 ('f1','r1',300),('f2','r2',300),('f3','r3',200),('f4','r4',200),('f5','r5',200),('f6','r6',300)
on conflict do nothing;

-- Demo travel_data: derived from straight-line distance (~18 km/h), both directions, peak 30% slower.
insert into public.travel_data (id, route_id, from_stop_id, to_stop_id, time_of_day, day_of_week, average_travel_minutes)
select
  'td-' || a.route_id || '-' || a.stop_sequence || '-' || dir.d || '-' || tod.name,
  a.route_id,
  case when dir.d = 'f' then a.stop_id else b.stop_id end,
  case when dir.d = 'f' then b.stop_id else a.stop_id end,
  tod.name,
  'all',
  greatest(2, round((
    2 * 6371000 * asin(sqrt(
      power(sin(radians(sb.latitude - sa.latitude) / 2), 2) +
      cos(radians(sa.latitude)) * cos(radians(sb.latitude)) * power(sin(radians(sb.longitude - sa.longitude) / 2), 2)
    )) * 1.2 / 300
  ))) * tod.factor
from public.route_stops a
join public.route_stops b on b.route_id = a.route_id and b.stop_sequence = a.stop_sequence + 1
join public.bus_stops sa on sa.id = a.stop_id
join public.bus_stops sb on sb.id = b.stop_id
cross join (values ('f'), ('b')) as dir(d)
cross join (values ('offpeak', 1.0), ('morning_peak', 1.3), ('evening_peak', 1.35)) as tod(name, factor)
on conflict do nothing;
