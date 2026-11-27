// Decide which blocks count. Reports count `street` by default; `path` can
// be added with --with-paths. Everything else is kept but never counts.
//
//   street    public roads you can legally ride: residential up to trunk
//   path      cycleways, and paths/pedestrian ways that allow bikes
//   service   alleys, driveways, parking aisles
//   link      on/off ramps
//   private   access=private/no, bicycle=no, motorroad=yes
//   other     footways, tracks, bridleways, unknown

export type BlockClass =
  | 'street'
  | 'path'
  | 'service'
  | 'link'
  | 'private'
  | 'other';

const STREET = new Set([
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'road',
]);
const LINK = new Set([
  'trunk_link',
  'primary_link',
  'secondary_link',
  'tertiary_link',
]);
const BIKE_OK = new Set(['yes', 'designated', 'permissive', 'official']);

export function classify(tags: Record<string, string>): BlockClass {
  const { highway, access, bicycle } = tags;
  if (
    bicycle === 'no' ||
    bicycle === 'dismount' ||
    bicycle === 'use_sidepath' ||
    tags.motorroad === 'yes'
  ) {
    return 'private';
  }
  if (
    ['private', 'no', 'customers', 'delivery'].includes(access) &&
    !BIKE_OK.has(bicycle)
  ) {
    return 'private';
  }
  if (STREET.has(highway)) return 'street';
  if (LINK.has(highway)) return 'link';
  if (highway === 'cycleway') return 'path';
  if (
    ['path', 'pedestrian', 'footway', 'track', 'bridleway'].includes(highway) &&
    BIKE_OK.has(bicycle)
  ) {
    return 'path';
  }
  // in MA most unsigned paths are rideable rail trails / park paths
  if (highway === 'path' && bicycle === undefined) return 'path';
  if (highway === 'service') return 'service';
  return 'other';
}
