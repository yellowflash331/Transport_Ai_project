# Yangon Bus Service (YBS) network data

Source: **YBS Data** by thantthet and contributors — https://github.com/thantthet/YBS-Data
(community-maintained update of the official YRTA open-data release, http://data.yangonbus.com/).
License: Creative Commons Attribution-ShareAlike 4.0 (see LICENSE.md). Snapshot converted on 2026-09-04.

Files (match the `bus_stops`, `bus_routes`, `route_stops` tables in `supabase/schema.sql`,
with a few extra descriptive columns):

- `bus_stops.csv` — id, name, latitude, longitude, name_mm, road, township
- `bus_routes.csv` — id, route_number, route_name (first stop – farthest stop), description (official Burmese name), color
- `route_stops.csv` — id, route_id, stop_id, stop_sequence (route order as recorded in the dataset)

Not in the dataset (the app labels these as estimates):

- travel times — estimated from stop-to-stop distance until real `travel_data` is imported
- fares — assumed flat fare per bus, configured in `ybs-source.ts`
