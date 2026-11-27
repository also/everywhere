# streets

Which streets have I ridden, and which are left?

Builds a street network from an OpenStreetMap extract, matches every Strava
ride in `data/strava-activities` against it, and answers questions about it.

```shell
# dataDir comes from config/config.json, like the other tools

node tools streets update        # download extract if missing, import if missing, match rides
node tools streets stats         # progress per town
node tools streets town Somerville --todo
node tools streets nearby        # unridden streets near home (= where most rides start)
node tools streets pockets       # clusters of unridden blocks worth a dedicated ride
node tools streets almost        # streets 50–90% done, cheapest to finish first
node tools streets rides         # rides ranked by new ground
node tools streets ride <strava id>
node tools streets street 'Highland Ave%' --town Somerville
node tools streets timeline      # new km per year
node tools streets favorites     # streets ridden most often
node tools streets stale --before 2020-01-01
node tools streets export        # build/streets/<region>-map.html + .geojson
```

Re-run `node tools streets match` after fetching new rides (about 10 s plus
reading the activity files). Re-run `import-osm` after downloading a newer
extract (about 30 s). Needs Node 22.13+ for `node:sqlite`.

## How it works

**Reading OSM.** `pbf.ts` and `proto.ts` are a small PBF reader: blobs are
inflated in parallel on libuv's thread pool and decoded on the main thread.
The import makes three passes, each only touching the blobs it needs:
relations (town boundaries), ways (highways and boundary members), then
nodes, looking up coordinates only for the ~7.5M nodes those ways use.
`multipolygon.ts` chains boundary member ways into rings; containment uses
the even-odd rule over all rings, so inner rings never need to be matched to
their outer ring.

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

**What counts.** See `classify.ts`. By default only `street` blocks count:
`residential`, `unclassified`, `tertiary` … `trunk`, `living_street`, minus
anything private, `bicycle=no` or `motorroad=yes`. `--with-paths` adds bike
paths. Service roads (alleys, driveways, parking aisles), ramps and footways
never count. `--skip-stubs 80` additionally ignores dead-end blocks shorter
than 80 m (courts, places, mapping stubs).

Streets are grouped by name within a town; a street is done at 90% of its
length.

## Data

- Input: `<dataDir>/strava-activities/*.json`, `<dataDir>/osm/<region>-latest.osm.pbf`
- Output: `build/streets/<region>.sqlite` (local disk on purpose: SQLite on
  the SMB share is slow and its locking can't be trusted). Tables: `edges`
  (blocks), `cities`, `rides`, `coverage` (per block), `ride_edges` (per ride
  × block).

Only Massachusetts is set up as a region; `--region` takes others from
`paths.ts`, which covers rides elsewhere (San Diego, Eugene) once their
extract is downloaded.
