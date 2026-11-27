# streets

Which streets have I ridden, and which are left?

Builds a street network from an OpenStreetMap extract, matches every Strava
ride in `data/strava-activities` against it, and answers questions about it.

```shell
cd streets
export EVERYWHERE_DATA_DIR=/Volumes/everywhere/data   # or use config/config.json

uv run streets update        # download extract if missing, import if missing, match rides
uv run streets stats         # progress per town
uv run streets town Somerville --todo
uv run streets nearby        # unridden streets near home (= where most rides start)
uv run streets pockets       # clusters of unridden blocks worth a dedicated ride
uv run streets almost        # streets 50–90% done, cheapest to finish first
uv run streets rides         # rides ranked by new ground
uv run streets ride <strava id>
uv run streets street 'Highland Ave%' --town Somerville
uv run streets timeline      # new km per year
uv run streets favorites     # streets ridden most often
uv run streets stale --before 2020-01-01
uv run streets export        # build/<region>-map.html + .geojson
```

Re-run `uv run streets match` after fetching new rides (about 30 s). Re-run
`import-osm` after downloading a newer extract (about 3 min).

## How it works

**Blocks.** Every OSM way tagged `highway=*` is split at nodes it shares with
other ways, so the unit of progress is a block, intersection to intersection.
Each block gets the town (`admin_level=8` boundary) its midpoint is in.
Sidewalks, crossings, motorways, steps and the like are dropped at import.

**Matching.** Blocks are sampled every 5 m. A sample is covered by a ride if a
point of that ride is within 15 m *and* the ride was heading along the block
(within 30°), so crossing a street doesn't count as riding it. Ride tracks
are reduced to ~10 m chords first so GPS jitter doesn't produce random
headings; paused/non-moving points and GPS jumps are dropped.

A block is **done** once 80% of its samples have been covered by any
combination of rides. A ride **rode** a block if it covered half of it. Per
sample we keep the first ride that covered it, which gives the exact ride on
which each block became done and how much new ground every ride broke.

**What counts.** See `classify.py`. By default only `street` blocks count:
`residential`, `unclassified`, `tertiary` … `trunk`, `living_street`, minus
anything private, `bicycle=no` or `motorroad=yes`. `--with-paths` adds bike
paths. Service roads (alleys, driveways, parking aisles), ramps and footways
never count. `--skip-stubs 80` additionally ignores dead-end blocks shorter
than 80 m (courts, places, mapping stubs).

Streets are grouped by name within a town; a street is done at 90% of its
length.

## Data

- Input: `<dataDir>/strava-activities/*.json`, `<dataDir>/osm/<region>-latest.osm.pbf`
- Output: `streets/build/<region>.sqlite` (local disk on purpose: SQLite on
  the SMB share is slow and its locking can't be trusted). Tables: `edges`
  (blocks), `cities`, `rides`, `coverage` (per block), `ride_edges` (per ride
  × block).

Only Massachusetts is set up as a region; `--region` takes others from
`config.py`, which covers rides elsewhere (San Diego, Eugene) once their
extract is downloaded.
