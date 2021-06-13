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
import { Feature, GeoJsonProperties } from 'geojson';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import { SeekableBlobBuffer } from '../../../tools/parse/buffers';
import { extractGps } from '../../../tools/parse/gopro-gps';
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
import WorkerContext from '../WorkerContext';
import { lookup, setWorkerFile } from '../../worker-stuff';
import CanvasLayer from '../../CanvasLayer';
import FullScreenPage from '../FullScreenPage';

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

function VectorTileView({ file }: { file: File }) {
  const { channel } = useContext(WorkerContext);
  const [nearest, setNearest] = useState<GeoJsonProperties>();
  const customize = useMemo(() => {
    return (l: L.Map) => {
      l.on(
        'mousemove',
        async ({ latlng: { lat, lng } }: L.LeafletMouseEvent) => {
          const start = Date.now();
          const nearest = await channel.sendRequest(lookup, {
            coords: [lng, lat],
          });
          console.log('lookup in ' + (Date.now() - start), nearest);
          setNearest(nearest);
        }
      );
      new CanvasLayer(channel).addTo(l);
    };
  }, [file]);

  return (
    <>
      <p>
        {nearest?.id} {nearest?.name}
      </p>
      <LeafletMap customize={customize} />
    </>
  );
}

function VectorTileFileView({
  file,
  type,
}: {
  file: FileWithHandle;
  type: 'osm' | 'generic';
}) {
  const { channel } = useContext(WorkerContext);
  const loaded = useMemoAsync(async () => {
    await channel.sendRequest(setWorkerFile, { file, type });

    return true;
  }, [file]);
  if (loaded) {
    return <VectorTileView file={file} />;
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
  const [type, setType] = useState('osm');
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
  return (
    <FullScreenPage>
      <PageTitle>Local Data</PageTitle>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option>osm</option>
        <option>generic</option>
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
      {file ? (
        <>
          <button onClick={() => setFile(undefined)}>Unload</button>
          <VectorTileFileView file={file} type={type as any} />
        </>
      ) : undefined}
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
    </FullScreenPage>
  );
}
