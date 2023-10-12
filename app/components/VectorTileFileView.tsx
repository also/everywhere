import { FileWithHandle } from 'browser-fs-access';
import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';

import { useMemo, useState } from 'react';
import { VideoProperties } from '../../tools/parse/gopro-gps';
import CanvasLayer from '../CanvasLayer';
import { useMemoAsync } from '../hooks';
import { drawDistanceTile, drawTile } from '../vector-tiles';

import { create, lookup, setWorkerFile } from '../worker-stuff';
import { WorkerChannel } from '../WorkerChannel';
import LeafletMap from './LeafletMap';

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

function isProbablyOsmId(id: string) {
  return id.startsWith('node/') || id.startsWith('way/');
}

const GenericFeatureDetails = ({
  id,
  properties,
}: {
  id?: string;
  properties?: Record<string, any>;
}) => (
  <div>
    ID: {id ?? '(none'}, type: {properties?.type ?? '(none)'}
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
};

function VectorTileView({
  channel,
  controls,
}: {
  channel: WorkerChannel;
  controls: JSX.Element;
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
        layer.setOpts({ selectedId: selected?.feature.id });
      });
    };
  }, [channel]);

  const ComponentForType =
    componentsByType[selected?.feature?.properties?.type] ??
    GenericFeatureDetails;

  return (
    <>
      <div>
        {controls}
        {selected && (
          <>
            {selected.lat}, {selected.lng}; distance: {selected.distance}
          </>
        )}
        <ComponentForType {...selected?.feature} />
      </div>
      <LeafletMap customize={customize} />
    </>
  );
}

export function VectorTileFileView({
  file,
  type,
  controls,
}: {
  file: FileWithHandle;
  type: 'osm' | 'generic';
  controls: JSX.Element;
}) {
  const channel = useMemoAsync(
    async ({ signal }) => {
      const { channel, worker } = await create();
      signal.addEventListener('abort', () => {
        console.log('terminating worker');
        worker.terminate();
      });
      await channel.sendRequest(setWorkerFile, { file, type });

      return channel;
    },
    [file]
  );
  if (channel) {
    return <VectorTileView channel={channel} controls={controls} />;
  } else {
    return <>loading</>;
  }
}
