import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import L from 'leaflet';
import { get, set } from 'idb-keyval';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
} from 'geojson';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import { SeekableBlobBuffer } from '../../../tools/parse/buffers';
import { extractGps, VideoProperties } from '../../../tools/parse/gopro-gps';
import { bind, fileRoot, Traverser } from '../../../tools/parse';
import { Box, parser as mp4Parser } from '../../../tools/parse/mp4';
import { getMeta, Metadata } from '../../../tools/parse/gpmf';
import { FeatureOrCollection, features, singleFeature } from '../../geo';
import { DataSet } from '../../data';
import { buildDataSet, RawStravaTripFeature } from '../../trips';
import { RawVideoFeature, toChapter, VideoChapter } from '../../videos';
import LeafletMap from '../LeafletMap';
import Table from '../Table';
import TraverserView, { GpmfSamples } from '../data/TraverserView';
import { useMemoAsync } from '../../hooks';
import { create, lookup, setWorkerFile } from '../../worker-stuff';
import CanvasLayer from '../../CanvasLayer';
import FullScreenPage from '../FullScreenPage';
import { WorkerChannel } from '../../WorkerChannel';
import StandardPage from '../StandardPage';

function FileView<T>({
  file,
  parse,
  component: Component,
}: {
  file: File;
  parse: (f: File) => Promise<T>;
  component: React.ComponentType<{ value: T }>;
}) {
  const [value, setValue] = useState<
    | { state: 'loading' }
    | { state: 'error'; error: any }
    | { state: 'loaded'; value: T }
  >(() => {
    return { state: 'loading' };
  });

  useEffect(() => {
    setValue({ state: 'loading' });
    (async () => {
      try {
        setValue({ state: 'loaded', value: await parse(file) });
      } catch (error) {
        console.log(error);
        setValue({ state: 'error', error });
      }
    })();
  }, [file, parse]);

  return (
    <>
      {value.state === 'loaded' ? (
        <Component value={value.value} />
      ) : value.state === 'error' ? (
        <pre>{value.error.toString()}</pre>
      ) : null}
    </>
  );
}

function JsonComponent({ value }: { value: any }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function Path({ feature }: { feature: GeoJSON.Feature }) {
  const { path } = useContext(MapContext);

  return <path className="trip" d={path(feature)} />;
}

type SomeFile = {
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection;
  mp4?: Traverser<Box>;
  track?: Metadata;
  raw: FileWithHandle;
};

function FileComponent({ file: { geojson, mp4, track } }: { file: SomeFile }) {
  return mp4 ? (
    <>
      <TraverserView traverser={mp4} />
      {track?.samples ? (
        <GpmfSamples sampleMetadata={track.samples} mp4={mp4} />
      ) : null}
    </>
  ) : (
    <LeafletMap
      features={geojson.type === 'Feature' ? [geojson] : geojson.features}
    />
  );
}

function GeoJSONFileView({ value }: { value: GeoJSON.Feature }) {
  return (
    <>
      <JsonComponent value={value.properties} />
      <MapBox>
        <MapComponent width={1000} height={1000} zoomFeature={value}>
          <Path feature={value} />
        </MapComponent>
      </MapBox>
    </>
  );
}

function File({ file }: { file: File }) {
  return (
    <div>
      <p>
        <strong>Name:</strong> {file.name}
      </p>
      <FileView
        file={file}
        parse={async (f) => JSON.parse(await f.text()) as GeoJSON.Feature}
        component={GeoJSONFileView}
      />
    </div>
  );
}

function FilesComponent({ files }: { files: SomeFile[] }) {
  return (
    <LeafletMap
      features={([] as Feature[]).concat(
        ...files.map(({ geojson }) =>
          geojson.type === 'Feature' ? [geojson] : geojson.features
        )
      )}
    />
  );
}

function readFiles(files: FileWithHandle[]): Promise<SomeFile[]> {
  return Promise.all(
    files.map(async (file) => {
      let geojson: GeoJSON.Feature | GeoJSON.FeatureCollection;
      let mp4;
      let track;
      if (file.name.toLowerCase().endsWith('.mp4')) {
        const data = new SeekableBlobBuffer(file, 1024000);
        mp4 = bind(mp4Parser, data, fileRoot(data));
        track = await getMeta(mp4);
        geojson = await extractGps(track, mp4);
      } else {
        const text = await file.text();
        const json = JSON.parse(text);
        if (json.type === 'Topology') {
          geojson = features(json);
        } else {
          geojson = json as GeoJSON.Feature;
        }
      }
      (geojson.type === 'FeatureCollection'
        ? geojson.features
        : [geojson]
      ).forEach((feat) => {
        if (!feat.properties) {
          feat.properties = {};
        }
        feat.properties.filename = file.name;
      });
      return { geojson, mp4, track, raw: file };
    })
  );
}

function isProbablyStravaTrip(
  f: FeatureOrCollection<any, any>
): f is RawStravaTripFeature {
  return f.type === 'Feature' && !!f.properties?.activity?.moving_time;
}

function isProbablyVideoTrack(
  f: FeatureOrCollection<any, any>
): f is RawVideoFeature {
  return f.type === 'Feature' && !!f.properties?.creationTime;
}

function readToDataset(newFiles: SomeFile[]) {
  const trips: RawStravaTripFeature[] = [];

  const videoChapters: VideoChapter[] = [];
  newFiles.forEach(({ geojson, raw: { name } }) => {
    const f = singleFeature(geojson) || geojson;
    if (isProbablyStravaTrip(f)) {
      trips.push(f);
    } else if (isProbablyVideoTrack(f)) {
      const start = new Date(f.properties.creationTime * 1000);
      // using current timezone :(
      start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
      videoChapters.push(
        toChapter(name, {
          start: +start,
          // TODO what the hell? 90
          // this gives the right duration for GOPR0039, at least
          duration: f.properties.duration / 1000 / 1000 / 90,
        })
      );
    }
  });

  return buildDataSet(trips, videoChapters);
}

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

function VectorTileFileView({
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

export default function LocalDataExplorer({
  setDataSet,
}: {
  setDataSet(dataSet: DataSet): void;
}) {
  const [files, setFiles] = useState<FileWithHandle[] | undefined>();
  const [file, setFile] = useState<FileWithHandle>();
  const [type, setType] = useState('generic');
  const initialized = useMemoAsync<boolean>(async () => {
    setFiles(await get('files'));
    return true;
  }, []);

  async function handleFiles(
    result: FileWithHandle[],
    existingFiles: FileWithHandle[] = []
  ) {
    const allFiles = [...result, ...existingFiles];
    setFiles(allFiles);
    // for safari, it seems to be important that you don't remove the files from indexDB before you read them.
    // removing them drops the reference or something
    await set('files', allFiles);
  }
  const handleLoadClick = useCallback(async (e) => {
    e.preventDefault();
    const result = await fileOpen({
      multiple: true,
      // mimeTypes: ['video/mp4'],
    });

    await handleFiles(result);
  }, []);
  const handleAddClick = useCallback(
    async (e) => {
      e.preventDefault();
      const result = await fileOpen({
        multiple: true,
      });

      await handleFiles(result, files);
    },
    [files]
  );
  async function handleSetDatasetClick() {
    setDataSet(readToDataset(await readFiles(files || [])));
  }
  return file ? (
    <FullScreenPage>
      <VectorTileFileView
        file={file}
        type={type as any}
        controls={<button onClick={() => setFile(undefined)}>Unload</button>}
      />
    </FullScreenPage>
  ) : (
    <StandardPage>
      <PageTitle>Local Data</PageTitle>
      <div>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>generic</option>
          <option>osm</option>
        </select>
        {initialized ? (
          <>
            <button onClick={handleLoadClick}>load</button>
            <button onClick={handleAddClick}>add</button>
          </>
        ) : undefined}

        {files ? (
          <>
            <button onClick={handleSetDatasetClick}>Set Dataset</button>
          </>
        ) : undefined}
      </div>

      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Last Modified</th>
          </tr>
        </thead>
        <tbody>
          {(files || []).map((f, i) => (
            <tr key={i}>
              <td>{f.name}</td>
              <td>{f.size.toLocaleString()}</td>
              <td>{new Date(f.lastModified).toLocaleString()}</td>
              <td>
                <button onClick={() => setFile(f)}>load</button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </StandardPage>
  );
}
