# Garmin activity data

Notes on what the Garmin Connect Personal API returns and what's in the files,
from fetching all 167 activities (May 2021 – Nov 2026) in November 2026. Unless
it says otherwise, this was worked out from the data, not from documentation.

## API

- Base URL `https://personal.connectapi.garmin.com`. Endpoints are from Garmin's
  [official Python client](https://github.com/garmin/connect-personal-api-python);
  see [`tools/garmin-api.ts`](../tools/garmin-api.ts).
- Auth: `POST /personalapitoken-service/personal-api/personal-api-key/token`
  with `Authorization: ApiKey <key>` returns a bare JWT good for 24 hours. Use it
  as `Authorization: Bearer <jwt>`. No refresh token; exchange the key again.
- History is complete. The activity search goes back to the first Garmin
  activity, despite reports that personal keys only see recent activities.
- Rate limits aren't published. About 200 requests in 26 seconds got a 429 with
  `Retry-After` of about 40 seconds. Waiting and retrying, a full fetch of 167
  activities (3 requests each) takes about 2 minutes.

## Stored files

`data/garmin-activities/<id>.json`:

- `summary`: the activity's entry from the search endpoint.
- `activity`: `/activity-service/activity/<id>`. `summaryDTO` has
  totals and averages. `metadataDTO.sensors` lists connected sensors, including
  the Varia (`antplusDeviceType: "BIKE_RADAR"`). The JSON has no radar
  measurements; those are only in the FIT file.

`data/garmin-activities/<id>.zip`: the original upload, a zip holding one
`<id>_ACTIVITY.fit`.

The FIT files don't appear to be stripped. They still contain Connect IQ
developer fields and many messages that aren't in the public profile
(`node tools garmin-fit-info <id>` lists them). Message 534 appears once a
second; its field 1 is a little-endian float32 of cumulative distance in meters.
None of the others look radar-related.

Decode them with `@garmin/fitsdk`. It's ESM-only; see `decodeFit` in
[`tools/garmin-fit-info.ts`](../tools/garmin-fit-info.ts) for loading it under
ts-node.

## Radar

### What the Edge records

The Edge connects to the Varia but writes almost nothing about it to the FIT
file. The Varia shows up in `device_info` (`antplus_device_type: bike_radar`,
`garmin_product: varia_rct715` on recent rides). The FIT profile defines a
`radar_threat_alert` event (threat level, count, approach speeds), but none of
the 167 files contain one, on either the Edge 1030 Plus or the Edge 1040.

So rides without a Connect IQ radar app have no radar data, just the fact that
it was connected.

### My Bike Radar Traffic

All the radar data comes from the My Bike Radar Traffic Connect IQ data field, which writes developer fields to the FIT file.

- Developer data ID `applicationId` `c5d949c3-9acb-4e00-bb2d-c3b871e9e733`.
- Present on 62 rides from 2023-04-15 on, all on the Edge 1040. Of those, 59 had
  the Varia connected. The other 3 have the fields but count 0 vehicles.
- Totals per ride range from 0 to 394 vehicles; the median is 56. 4,951
  vehicles in total.
- None of the fields declare units.

| field | message | type | meaning |
| --- | --- | --- | --- |
| `radar_ranges` | record | uint16[8] | distance to each tracked vehicle, m |
| `radar_speeds` | record | uint8[8] | closing speed of each tracked vehicle, ≈ m/s |
| `radar_current` | record | uint32 | vehicles passed so far this ride |
| `passing_speed` | record | uint8 | closing speed of the latest passing vehicle, mph |
| `passing_speedabs` | record | uint8 | that vehicle's speed over the ground, mph |
| `radar_lap` | lap | uint32 | vehicles passed in the lap |
| `radar_total` | session | uint32 | vehicles passed in the ride |

Details:

- **Look fields up by name.** Field definition numbers are stable
  (`radar_ranges` is always #0), but the field descriptions appear in different
  orders in different files. `@garmin/fitsdk` keys `developerFields` by the
  order the descriptions appear, not the definition number. Map
  `fieldDescriptionMesgs[].fieldName` to `.key` for each file.
- **Field sets vary.** 5 early rides have no `radar_lap`.
- **`radar_ranges`**: 8 slots, unused slots are 0. Values are multiples of
  3.125 m rounded down (0, 3, 6, … 25, 28, … 140, 143), the ANT+ radar
  resolution; the maximum is about 140 m. Slots aren't stable vehicle IDs. A
  vehicle stays in its slot as it approaches (43 → 40 → 37 → …), but when the
  slot 0 vehicle passes, the rest shift down; see the example below. Within a
  slot, readings jitter by one step (9, 6, 9). To follow individual vehicles,
  match tracks across seconds by range.
- **`radar_speeds`**: same slots as `radar_ranges`. Values are multiples of 3.
  The units are a guess: comparing with how fast `radar_ranges` changes, a value
  of `v` closes at about `0.9·v` m/s:

  | value | samples | mean range change, m/s |
  | --- | --- | --- |
  | 3 | 340 | 2.27 |
  | 6 | 258 | 5.49 |
  | 9 | 209 | 8.46 |
  | 12 | 84 | 10.83 |
  | 15 | 28 | 13.96 |

- **`radar_current`** increments when a vehicle leaves the radar, i.e. it
  has passed. On a 2.5 hour ride it ends at 104, which equals `radar_total` and
  the sum of `radar_lap` (37 + 11 + 38 + 2 + 16).
- **`passing_speed` / `passing_speedabs`** hold their last value until the next
  vehicle. `passing_speedabs − passing_speed` matches the bike's own speed in mph:
  the mean error over 1,103 samples is 0.48 mph; in km/h it would be 5.6. They
  are probably in the device's display units, so this would change if the Edge
  were set to metric. Garmin Connect charts these as "Approach Speed (Relative)"
  and "Vehicle Speed (Absolute)".
- `passing_speed` is nonzero before the first vehicle is counted, and changes 339
  times on a ride where the count increments 99 times. So it's an estimate that
  updates while vehicles are tracked, not strictly once per pass.

### Example

Activity 25177864650, 2026-11-23, records at 19:19:19–19:19:31. Two vehicles
approach; the nearer one passes and the count goes to 1:

```
time      ranges        speeds    count  passing  abs  bike m/s
19:19:19  [12,43,0,…]   [3,3,0,…]   0      7       16   4.27
19:19:22  [12,37,0,…]   [3,3,0,…]   0      7       16   3.29
19:19:25  [9,28,0,…]    [3,3,0,…]   0      7       14   3.00
19:19:30  [3,18,0,…]    [3,3,0,…]   0      7       10   0.72
19:19:31  [15,0,0,…]    …           1      7        9   0.70
```
