import { TripTopology } from './trips';

const tripContext = (require as any).context(
  'compact-json!../app-data/trips',
  false,
  /-ways\.geojson$/
);
export default tripContext
  .keys()
  .map(name => tripContext(name)) as TripTopology[];