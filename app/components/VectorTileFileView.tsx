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
      feature: Feature<MultiLineString | LineString, GeoJsonProperties>;
      lng: number;
      lat: number;
    }>();
  const customize = useMemo(() => {
    return (l: L.Map) => {
      const layer = new CanvasLayer(channel).addTo(l);

      l.on('click', async ({ latlng: { lat, lng } }: L.LeafletMouseEvent) => {
        const selected = await channel.sendRequest(lookup, {
          coords: [lng, lat],
        });
        setSelected({ feature: selected, lng, lat });
        layer.setSelectedId(selected?.id);

        console.log({ selected });
      });
    };
  }, [channel]);

  const ComponentForType =
    componentsByType[selected?.feature.properties?.type] ??
    GenericFeatureDetails;

  return (
    <>
      <div>
        {controls}
        {selected && (
          <>
            {selected?.lat}, {selected?.lng}
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
