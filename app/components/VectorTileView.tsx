import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';

import { useMemo, useState } from 'react';
import { VideoProperties } from '../../tools/parse/gopro-gps';
import CanvasLayer from '../CanvasLayer';
import { drawDistanceTile, drawTile } from '../vector-tiles';

import { lookup } from '../worker-stuff';
import { WorkerChannel } from '../WorkerChannel';
import LeafletMap from './LeafletMap';
import L from 'leaflet';
import { createPortal } from 'react-dom';

function GoProVideoDetails({
  id,
  properties,
}: {
  id: string;
  properties: VideoProperties;
}) {
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
}: {
  properties: { venue: { id: string; name: string }; checkins: any[] };
}) {
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

function StravaTripDetails({ id }: { id: string }) {
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

export default function VectorTileView({
  channel,
}: {
  channel: WorkerChannel;
}) {
  const [selected, setSelected] =
    useState<{
      feature:
        | Feature<MultiLineString | LineString, GeoJsonProperties>
        | undefined;
      distance: number | undefined;
      lng: number;
      lat: number;
    }>();
  const popupDiv = useMemo(() => document.createElement('div'), []);

  const customize = useMemo(() => {
    return (l: L.Map, control: L.Control.Layers) => {
      control.addOverlay(
        new CanvasLayer(channel, drawDistanceTile),
        'Distance Heatmap'
      );
      const layer = new CanvasLayer(channel, drawTile).addTo(l);
      control.addOverlay(layer, 'Data');

      l.on('click', async ({ latlng: { lat, lng } }: L.LeafletMouseEvent) => {
        // TODO leaflet calls this handler twice? maybe https://github.com/Leaflet/Leaflet/issues/7255
        const selected = await channel.sendRequest(lookup, {
          coords: [lng, lat],
          zoom: l.getZoom(),
        });
        setSelected({
          feature: selected?.feature,
          distance: selected?.distance,
          lng,
          lat,
        });

        L.popup()
          // TODO by putting the popup at the location of the click, it
          // often covers the feature. maybe put it at the top of the feature?
          .setLatLng({ lat, lng })
          .setContent(() => popupDiv)
          .openOn(l);

        layer.setOpts({
          // TODO create a type that includes properties and everywhereFeatureIndex
          selectedIndex: selected?.feature.properties!.everywhereFeatureIndex,
        });
      });
    };
  }, [channel]);

  const ComponentForType =
    componentsByType[selected?.feature?.properties?.type] ??
    GenericFeatureDetails;

  return (
    <>
      {selected &&
        createPortal(
          <>
            {selected.lat}, {selected.lng}; distance: {selected.distance}
            <ComponentForType {...selected?.feature} />
          </>,
          popupDiv
        )}
      <LeafletMap customize={customize} />
    </>
  );
}
