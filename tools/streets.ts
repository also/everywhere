// Which streets have I ridden, and which are left? See tools/streets/README.md.
//
//   node tools streets <command> [options]

import { existsSync, mkdirSync, renameSync, writeFileSync } from 'fs';
import path from 'path';

import { openDb } from './streets/db';
import { importOsm } from './streets/import';
import { mapHtml } from './streets/map';
import { DEFAULT_PARAMS, match } from './streets/match';
import { REGIONS, regionPaths } from './streets/paths';
import * as reports from './streets/reports';
import { DEFAULT_SPORTS, loadRides } from './streets/rides';

const HELP = `usage: node tools streets <command> [--region massachusetts]

setup
  update                  download the extract and import it if missing, then match
  download                (re)download the region's OSM extract from Geofabrik
  import-osm              build the street network from the extract
  match [--sports Ride,EBikeRide] [--radius 15] [--angle 30]

reports (all take --with-paths, --done 0.8, --skip-stubs M)
  stats [-n 25]           progress overall and per town
  town <name> [--todo] [--sort pct|length|todo|name|last]
  nearby [--at lat,lon] [--km 3] [--min 25] [--unnamed] [-n 30]
  pockets [--at lat,lon] [--km 3] [--min 150] [--cell 400] [-n 30]
  almost [--town T] [-n 30]
  rides [--sort new|date|blocks] [--year Y] [-n 25]
  ride <strava id>
  street <LIKE pattern> [--town T]
  timeline [--town T]
  favorites [-n 25]
  stale [--before 2020-01-01] [--town T] [-n 25]
  export [--town T ...] [--min-pct 10] [-o basename]
`;

type Argv = { _: (string | number)[]; [k: string]: unknown };

async function download(url: string, dest: string) {
  mkdirSync(path.dirname(dest), { recursive: true });
  process.stderr.write(`downloading ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const part = dest + '.part';
  writeFileSync(part, Buffer.from(await res.arrayBuffer()));
  renameSync(part, dest);
}

export default async function (argv: Argv) {
  const [cmd, arg] = argv._.map(String);
  const str = (k: string) =>
    argv[k] === undefined ? undefined : String(argv[k]);
  const num = (k: string, d: number) =>
    argv[k] === undefined ? d : Number(argv[k]);
  const limit = (d: number) => num('n', d);
  const list = (k: string) =>
    argv[k] === undefined ? [] : ([] as unknown[]).concat(argv[k]).map(String);

  const region = REGIONS[str('region') ?? 'massachusetts'];
  if (!region)
    throw new Error(
      `unknown region; one of ${Object.keys(REGIONS).join(', ')}`
    );
  const paths = regionPaths(region);

  switch (cmd) {
    case undefined:
    case 'help':
      process.stdout.write(HELP);
      return;
    case 'download':
      return download(paths.pbfUrl, paths.pbf);
    case 'import-osm':
      return importOsm(paths.pbf, paths.db);
    case 'update':
    case 'match': {
      if (cmd === 'update') {
        if (!existsSync(paths.pbf)) await download(paths.pbfUrl, paths.pbf);
        if (!existsSync(paths.db)) await importOsm(paths.pbf, paths.db);
      }
      const rides = loadRides(str('sports')?.split(',') ?? DEFAULT_SPORTS);
      match(openDb(paths.db), rides, {
        ...DEFAULT_PARAMS,
        radiusM: num('radius', DEFAULT_PARAMS.radiusM),
        angleTolDeg: num('angle', DEFAULT_PARAMS.angleTolDeg),
      });
      return;
    }
  }

  if (!existsSync(paths.db))
    throw new Error(
      `${paths.db} doesn't exist; run \`node tools streets update\` first`
    );
  const db = openDb(paths.db);
  const o: reports.Opts = {
    classes: argv['with-paths'] ? ['street', 'path'] : ['street'],
    doneFrac: num('done', DEFAULT_PARAMS.doneFrac),
    skipStubsM: num('skip-stubs', 0),
  };
  switch (cmd) {
    case 'stats':
      return reports.stats(db, o, limit(25));
    case 'town':
      return reports.town(db, o, arg, !!argv.todo, str('sort') ?? 'pct');
    case 'nearby':
      return reports.nearby(
        db,
        o,
        str('at'),
        num('km', 3),
        limit(30),
        !!argv.unnamed,
        num('min', 25)
      );
    case 'pockets':
      return reports.pockets(
        db,
        o,
        str('at'),
        num('km', 3),
        limit(30),
        num('min', 150),
        num('cell', 400)
      );
    case 'almost':
      return reports.almost(db, o, limit(30), str('town'));
    case 'rides':
      return reports.rides(db, o, str('sort') ?? 'new', limit(25), str('year'));
    case 'ride':
      return reports.ride(db, o, Number(arg));
    case 'street':
      return reports.street(db, o, arg, str('town'));
    case 'timeline':
      return reports.timeline(db, o, str('town'));
    case 'favorites':
      return reports.favorites(db, o, limit(25));
    case 'stale':
      return reports.stale(
        db,
        o,
        str('before') ?? '2020-01-01',
        limit(25),
        str('town')
      );
    case 'export': {
      const gj = reports.exportGeoJson(db, o, list('town'), num('min-pct', 10));
      const base = str('o') ?? path.join(paths.workDir, `${region.name}-map`);
      writeFileSync(base + '.geojson', JSON.stringify(gj));
      writeFileSync(base + '.html', mapHtml(gj, reports.home(db)));
      console.log(
        `wrote ${base}.geojson and ${base}.html (${gj.features.length} blocks in ${gj.towns.length} towns)`
      );
      return;
    }
    default:
      process.stderr.write(HELP);
      process.exitCode = 1;
  }
}
