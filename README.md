# TransitMate Yangon

Build a full-stack web application called TransitAI, an AI-assisted public transportation route finder for Yangon, Myanmar.

Goal

A user enters a starting location and destination. The system should:

Find the nearest suitable bus stops around both locations.

Find possible bus combinations between them.

Calculate the best routes.

Rank the top 3 routes.

Clearly explain exactly which buses to take, where to get off, where to transfer, walking distance, estimated time, and estimated fare.

Tech

React + TypeScript

Tailwind CSS

Supabase database/backend

Leaflet + OpenStreetMap for maps

Modular architecture so the AI/ML system can be added or replaced later.

UI

Create a polished, modern, responsive interface.

Home page:

Start location search/autocomplete

Destination search/autocomplete

Swap locations button

Find Route button

Preferences: Recommended, Fastest, Least Walking, Fewest Transfers, Cheapest

Results page:

Interactive map

Recommended route highlighted

Top 3 alternative routes

Step-by-step journey instructions

Total travel time

Walking distance

Number of buses

Number of transfers

Estimated fare

"Why this route?" explanation

Example:

START
→ Walk 400 m
→ Hledan Bus Stop
→ Bus 21
→ Get off at Sule
→ Walk 300 m
→ DESTINATION

Database

Create these Supabase tables:

bus_stops

id

name

latitude

longitude

bus_routes

id

route_number

route_name

description

route_stops

id

route_id

stop_id

stop_sequence

travel_data

id

route_id

from_stop_id

to_stop_id

time_of_day

day_of_week

average_travel_minutes

fares

id

route_id

fare

Route Engine

Model the transportation network as a graph:

Bus stops = nodes

Connections between consecutive stops = edges

Edges contain bus route and travel-time information.

When the user searches:

Geocode the start and destination into coordinates.

Find several nearby bus stops rather than only the single closest stop.

Search the transportation graph using Dijkstra's algorithm or A*.

Include walking segments from the origin to the first stop and from the final stop to the destination.

Include transfers between different bus routes.

Calculate travel time, walking distance, transfers and fare.

Return the best 3 valid routes.

Different preferences should change the route ranking.

Important

Do NOT invent real Yangon bus routes or stops and present them as real information. Use clearly labelled DEMO DATA initially.

Create the application so that real transportation data can later be imported through CSV/database records.

Keep route calculation deterministic and separate from the AI layer. The AI must never invent bus numbers, stops, fares or connections.

Build the working MVP now, including the database schema, frontend, route engine, map, location search, demo data, and responsive UI.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
