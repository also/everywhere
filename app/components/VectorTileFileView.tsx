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
import { pointLineSegmentDistance } from '../tree';
import { drawFeatureTile, drawTile } from '../vector-tiles';

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
      <strong>{id}</strong>{' '}
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

const GenericFeatureDetails = ({
  id,
  properties,
}: {
  id?: string;
  properties?: Record<string, any>;
}) => (
  <div>
    ID: {id ?? '(none'}, type: {properties?.type ?? '(none)'}
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
    return (l: L.Map) => {
      new CanvasLayer(channel, drawFeatureTile).addTo(l);
      const layer = new CanvasLayer(channel, drawTile).addTo(l);

      l.on('click', async ({ latlng: { lat, lng } }: L.LeafletMouseEvent) => {
        // TODO leaflet calls this handler twice? maybe https://github.com/Leaflet/Leaflet/issues/7255
        const selected = await channel.sendRequest(lookup, {
          coords: [lng, lat],
        });
        setSelected({
          feature: selected?.node.data,
          distance: selected?.distance,
          lng,
          lat,
        });
        layer.setOpts({ selectedId: selected?.node.data.id });
        if (selected) {
          console.log({
            dist: pointLineSegmentDistance(
              [lng, lat],
              ...selected.node.coordinates
            ),
            distFixed: pointLineSegmentDistance(
              [-71.03517293930055, 42.33059904560688],
              ...selected.node.coordinates
            ),
          });
        }

        console.log({ selected });
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
