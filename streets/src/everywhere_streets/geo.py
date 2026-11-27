"""Projection and small geometry helpers. Matching happens in a local metric CRS."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from pyproj import CRS, Transformer
from pyproj.aoi import AreaOfInterest
from pyproj.database import query_utm_crs_info

EARTH_R = 6371008.8


def haversine_m(lon1, lat1, lon2, lat2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp = p2 - p1
    dl = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(a))


@dataclass
class Projector:
    crs: CRS

    def __post_init__(self):
        self._fwd = Transformer.from_crs("EPSG:4326", self.crs, always_xy=True)
        self._inv = Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)

    @classmethod
    def for_bounds(cls, w, s, e, n) -> Projector:
        cx, cy = (w + e) / 2, (s + n) / 2
        info = query_utm_crs_info(
            datum_name="WGS 84",
            area_of_interest=AreaOfInterest(cx, cy, cx, cy),
        )
        return cls(CRS.from_epsg(info[0].code))

    @classmethod
    def from_string(cls, s: str) -> Projector:
        return cls(CRS.from_user_input(s))

    def fwd(self, lon, lat):
        x, y = self._fwd.transform(np.asarray(lon), np.asarray(lat))
        return np.asarray(x), np.asarray(y)

    def inv(self, x, y):
        lon, lat = self._inv.transform(np.asarray(x), np.asarray(y))
        return np.asarray(lon), np.asarray(lat)


def densify(xy: np.ndarray, step: float) -> tuple[np.ndarray, np.ndarray]:
    """Points every `step` meters along a polyline (Nx2), with the undirected
    bearing (radians, [0, pi)) of the segment each point lies on."""
    seg = np.diff(xy, axis=0)
    seg_len = np.hypot(seg[:, 0], seg[:, 1])
    keep = seg_len > 0
    if not keep.any():
        return np.empty((0, 2)), np.empty(0)
    seg, seg_len, starts = seg[keep], seg_len[keep], xy[:-1][keep]
    n = np.maximum(1, np.ceil(seg_len / step).astype(int))
    seg_idx = np.repeat(np.arange(len(seg)), n)
    # fraction along each segment: 0, 1/n, 2/n ... (n-1)/n
    offs = np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)
    frac = (offs + 0.5) / np.repeat(n, n)  # sample segment centers, not vertices
    pts = starts[seg_idx] + seg[seg_idx] * frac[:, None]
    bearing = np.mod(np.arctan2(seg[:, 1], seg[:, 0]), math.pi)[seg_idx]
    return pts, bearing
