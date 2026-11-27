import path from 'path';
import { getConfig } from '../config';

export interface Region {
  name: string;
  geofabrikPath: string; // e.g. north-america/us/massachusetts
}

export const REGIONS: Record<string, Region> = Object.fromEntries(
  [
    { name: 'massachusetts', geofabrikPath: 'north-america/us/massachusetts' },
    { name: 'california', geofabrikPath: 'north-america/us/california' },
    { name: 'oregon', geofabrikPath: 'north-america/us/oregon' },
  ].map((r) => [r.name, r])
);

// Derived data lives on local disk: SQLite on a network share (the data dir
// is SMB here) is slow and its locking is unreliable.
const WORK_DIR =
  process.env.EVERYWHERE_STREETS_DIR ??
  path.join(__dirname, '..', '..', 'build', 'streets');

export function regionPaths(region: Region) {
  const dataDir = getConfig().dataDir;
  const pbfName = `${region.geofabrikPath.split('/').pop()}-latest.osm.pbf`;
  return {
    pbf: path.join(dataDir, 'osm', pbfName),
    pbfUrl: `https://download.geofabrik.de/${region.geofabrikPath}-latest.osm.pbf`,
    db: path.join(WORK_DIR, `${region.name}.sqlite`),
    workDir: WORK_DIR,
  };
}
