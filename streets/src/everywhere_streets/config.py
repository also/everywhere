"""Locate the everywhere data directory, mirroring tools/config.ts."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]


def data_dir(override: str | None = None) -> Path:
    """--data-dir, then $EVERYWHERE_DATA_DIR, then config.json's dataDir, then repo data/."""
    if override:
        return Path(override).expanduser().resolve()
    if env := os.environ.get("EVERYWHERE_DATA_DIR"):
        return Path(env).expanduser().resolve()
    config_dir = Path(os.environ.get("EVERYWHERE_CONFIG_DIR", REPO_ROOT / "config"))
    config_file = config_dir / "config.json"
    d = "data"
    if config_file.exists():
        d = json.loads(config_file.read_text()).get("dataDir", d)
    return (REPO_ROOT / d).resolve()


@dataclass(frozen=True)
class Region:
    """A street network built from one Geofabrik extract."""

    name: str
    geofabrik_path: str  # e.g. north-america/us/massachusetts

    @property
    def pbf_name(self) -> str:
        return self.geofabrik_path.rsplit("/", 1)[-1] + "-latest.osm.pbf"


REGIONS = {
    r.name: r
    for r in [
        Region("massachusetts", "north-america/us/massachusetts"),
        Region("california", "north-america/us/california"),
        Region("oregon", "north-america/us/oregon"),
    ]
}


@dataclass(frozen=True)
class Paths:
    root: Path
    region: Region

    @property
    def strava_activities(self) -> Path:
        return self.root / "strava-activities"

    @property
    def pbf(self) -> Path:
        return self.root / "osm" / self.region.pbf_name

    # derived data lives on local disk: SQLite on a network share is slow and
    # its locking is unreliable
    work: Path = REPO_ROOT / "streets" / "build"

    @property
    def out_dir(self) -> Path:
        return self.work

    @property
    def db(self) -> Path:
        return self.out_dir / f"{self.region.name}.sqlite"
