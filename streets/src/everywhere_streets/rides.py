"""Load GPS tracks from the Strava activity dump (data/strava-activities/*.json)."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np

DEFAULT_SPORTS = ("Ride", "EBikeRide")

# consecutive points further apart than this are a GPS jump or a paused
# recording; don't draw a line between them
MAX_GAP_M = 150.0


@dataclass
class Ride:
    id: int
    name: str
    sport: str
    start_date: str  # local ISO timestamp
    distance_m: float
    moving_time_s: int
    # list of (N, 2) arrays of [lon, lat], split at gaps
    tracks: list[np.ndarray]


def _split_tracks(latlng: list, moving: list | None) -> list[np.ndarray]:
    a = np.asarray(latlng, dtype=np.float64)
    if a.ndim != 2 or len(a) < 2:
        return []
    lonlat = a[:, ::-1]
    if moving is not None and len(moving) == len(a):
        lonlat = lonlat[np.asarray(moving, dtype=bool)]
    if len(lonlat) < 2:
        return []
    # rough metres between consecutive points, good enough to find gaps
    dlat = np.diff(lonlat[:, 1]) * 111_000
    dlon = np.diff(lonlat[:, 0]) * 111_000 * np.cos(np.radians(lonlat[1:, 1]))
    gaps = np.flatnonzero(np.hypot(dlat, dlon) > MAX_GAP_M) + 1
    return [t for t in np.split(lonlat, gaps) if len(t) >= 2]


def load_rides(activities_dir: Path, sports=DEFAULT_SPORTS) -> list[Ride]:
    rides = []
    files = sorted(activities_dir.glob("*.json"))
    for i, f in enumerate(files):
        if i % 100 == 0:
            print(f"\r  reading activities {i}/{len(files)}", end="", file=sys.stderr, flush=True)
        d = json.loads(f.read_text())
        a = d["activity"]
        sport = a.get("sport_type") or a.get("type")
        if sport not in sports:
            continue
        streams = {s["type"]: s["data"] for s in d.get("streams", [])}
        if "latlng" not in streams:
            continue
        tracks = _split_tracks(streams["latlng"], streams.get("moving"))
        if not tracks:
            continue
        rides.append(
            Ride(
                id=a["id"],
                name=a.get("name", ""),
                sport=sport,
                start_date=a.get("start_date_local") or a["start_date"],
                distance_m=a.get("distance", 0.0),
                moving_time_s=a.get("moving_time", 0),
                tracks=tracks,
            )
        )
    print(f"\r  read {len(files)} activities, {len(rides)} rides", file=sys.stderr)
    rides.sort(key=lambda r: r.start_date)
    return rides
