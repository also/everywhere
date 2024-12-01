import { Feature, GeoJsonProperties } from 'geojson';
import { VideoProperties } from '../../tools/parse/gopro-gps';

export interface LimitedFeature<
  P extends GeoJsonProperties | null = GeoJsonProperties
> {
  id?: Feature['id'];
  properties: P;
  geometry: Pick<Feature['geometry'], 'type'>;
}

function GoProVideoDetails({
  id,
  properties,
}: LimitedFeature<VideoProperties>) {
  return (
    <div>
      <strong>
        {localStorage.videoBaseUrl ? (
          <a href={localStorage.videoBaseUrl + id}>{id}</a>
        ) : (
          id
        )}
      </strong>{' '}
      <span>
        Start: {new Date(properties.creationTime * 1000).toISOString()}
      </span>{' '}
      <span>Camera: {properties.cameraModelName}</span>
    </div>
  );
}

export function SwarmVenueDetails({
  properties: {
    venue: { id, name },
    checkins,
  },
}: LimitedFeature<{ venue: { id: string; name: string }; checkins: any[] }>) {
  return (
    <>
      <div>
        <a
          href={`https://foursquare.com/v/v/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          <strong>{name}</strong>
        </a>{' '}
      </div>
      <div>{checkins.length} checkins</div>
    </>
  );
}

function StravaTripDetails({ id }: LimitedFeature) {
  return (
    <div>
      <a
        href={`https://www.strava.com/activities/${id}`}
        target="_blank"
        rel="noreferrer"
      >
        View on Strava
      </a>
    </div>
  );
}

function isProbablyOsmId(id: string | number) {
  return (
    typeof id === 'string' && (id.startsWith('node/') || id.startsWith('way/'))
  );
}

const GenericFeatureDetails = ({
  id,
  properties,
}: {
  id?: string | number;
  properties?: Record<string, any>;
}) => (
  <div>
    ID: {id ?? '(none)'}, type: {properties?.type ?? '(none)'}
    {id && isProbablyOsmId(id) && (
      <>
        {' '}
        <a
          href={`https://www.openstreetmap.org/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          View on OSM
        </a>
      </>
    )}
  </div>
);

const componentsByType: Record<string, React.ComponentType<any>> = {
  video: GoProVideoDetails,
  'strava-trip': StravaTripDetails,
  'swarm-venue': SwarmVenueDetails,
};

export default function FeatureDetails({
  feature,
}: {
  feature: LimitedFeature | undefined;
}) {
  const ComponentForType =
    componentsByType[feature?.properties?.type] ?? GenericFeatureDetails;

  return <ComponentForType {...feature} />;
}
