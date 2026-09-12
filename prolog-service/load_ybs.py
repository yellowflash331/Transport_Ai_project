import csv
import os
import time

def generate_facts():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    ybs_dir = os.path.join(base_dir, "..", "src", "lib", "transit", "data", "ybs")
    out_file = os.path.join(base_dir, "ybs_facts.pl")

    t0 = time.time()
    with open(out_file, "w", encoding="utf-8") as out:
        out.write(":- dynamic bus_stop/4, bus_route/3, route_stop/3.\n\n")

        # Bus routes
        with open(os.path.join(ybs_dir, "bus_routes.csv"), "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                r_id = row["id"].replace("'", "''")
                num = row["route_number"].replace("'", "''")
                name = row["route_name"].replace("'", "''")
                out.write(f"bus_route('{r_id}', '{num}', '{name}').\n")

        # Bus stops
        with open(os.path.join(ybs_dir, "bus_stops.csv"), "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                s_id = row["id"].replace("'", "''")
                name = row["name"].replace("'", "''")
                try:
                    lat = float(row["latitude"])
                    lng = float(row["longitude"])
                except ValueError:
                    lat, lng = 0.0, 0.0
                out.write(f"bus_stop('{s_id}', '{name}', {lat}, {lng}).\n")

        # Route stops
        with open(os.path.join(ybs_dir, "route_stops.csv"), "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                r_id = row["route_id"].replace("'", "''")
                s_id = row["stop_id"].replace("'", "''")
                try:
                    seq = int(row["stop_sequence"])
                except ValueError:
                    seq = 0
                out.write(f"route_stop('{r_id}', '{s_id}', {seq}).\n")

    print(f"Generated {out_file} in {time.time()-t0:.3f}s")

if __name__ == "__main__":
    generate_facts()

