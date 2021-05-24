import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import L from 'leaflet';
import { get, set } from 'idb-keyval';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { Feature } from 'geojson';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import {
  SeekableBlobBuffer,
  SeekableFetchBuffer,
} from '../../../tools/parse/buffers';
import { extractGps } from '../../../tools/parse/gopro-gps';
import { bind, Entry, fileRoot, root, Traverser } from '../../../tools/parse';
import { Box, parser as mp4Parser } from '../../../tools/parse/mp4';
import { utf8decoder } from '../../../tools/parse/read';
import {
  getMeta,
  iterateMetadataSamples,
  Metadata,
  SampleMetadata,
  parser as gpmfParser,
} from '../../../tools/parse/gpmf';
import { FeatureOrCollection, features, singleFeature } from '../../geo';
import { DataSet } from '../../data';
import { buildDataSet, RawTripFeature } from '../../trips';
import { RawVideoFeature, toChapter, VideoChapter } from '../../videos';

function DataViewView({ value }: { value: DataView }) {
  return <div>{utf8decoder.decode(value).slice(0, 100)}</div>;
}

async function asyncArray<T>(i: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of i) {
    result.push(item);
  }
  return result;
}

function useMemoAsync<T>(f: () => Promise<T>, deps?: any[]): T | undefined {
  const [state, setState] = useState<T>();

  useEffect(() => {
    (async () => setState(await f()))();
  }, deps);

  return state;
}

function TraverserValueView<T extends Entry>({
  traverser,
  entry,
  depth = 0,
}: {
  traverser: Traverser<T>;
  entry?: T;
  depth?: number;
}) {
  const state = useMemoAsync(async () => {
    const children = await asyncArray(
      traverser.iterator(entry || traverser.root)
    );
    const value = entry ? await traverser.value(entry) : undefined;
    return { children, value };
  }, [traverser, entry]);

  if (depth > 8) {
    return <div>oops</div>;
  } else if (state) {
    const { children, value } = state;

    return (
      <>
        {value ? (
          <pre>
            {value instanceof DataView ? (
              <DataViewView value={value} />
            ) : (
              JSON.stringify(value, null, 2)
            )}
          </pre>
        ) : null}
        <ul>
          {children.map((e) => (
            <li key={e.fileOffset}>
              <TraverserView
                traverser={traverser.clone()}
                entry={e}
                depth={depth + 1}
              />
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    return <div>loading...</div>;
  }
}

function TraverserView<T extends Entry>({
  traverser,
  entry,
  depth = 0,
}: {
  traverser: Traverser<T>;
  entry?: T;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (depth > 8) {
    return <div>oops</div>;
  }

  return (
    <>
      <div onClick={() => setExpanded(!expanded)}>
        {entry ? (
          <>
            <code>{entry.fourcc}</code> (file offset: {entry.fileOffset},
            length: {entry.len})
          </>
        ) : (
          '(root)'
        )}
      </div>
      {expanded ? (
        <TraverserValueView
          traverser={traverser.clone()}
          entry={entry || traverser.root}
          depth={depth}
        />
      ) : null}
    </>
  );
}

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

function LeafletComponent({ features }: { features: GeoJSON.Feature[] }) {
  const mapComponent = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>();

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapComponent.current!).setView(
        [42.389118, -71.097153],
        10
      );
    }
    const map = mapRef.current;
    map.eachLayer((layer) => map.removeLayer(layer));
    L.tileLayer(
      'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
      {
        attribution:
          'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken:
          'pk.eyJ1IjoicmJlcmRlZW4iLCJhIjoiZTU1YjNmOWU4MWExNDJhNWNlMTAxYjA2NjFlODBiNWUifQ.AHJ0I8wQi1pJekXfAaPxLw',
      }
    ).addTo(map);

    features.forEach((f) =>
      L.geoJSON(f)
        .addTo(map)
        .on('click', (e) => {
          console.log(e, f.properties);
        })
    );
  }, [features]);

  return <div ref={mapComponent} style={{ width: 1800, height: 1000 }} />;
}

function GpmfSamples({
  sampleMetadata,
  mp4,
}: {
  sampleMetadata: SampleMetadata;
  mp4: Traverser<Box>;
}) {
  const samples = useMemoAsync(
    () => asyncArray(iterateMetadataSamples(sampleMetadata)),
    [sampleMetadata]
  );

  if (!samples) {
    return <div>loading...</div>;
  } else {
    const [sample] = samples;
    const gpmf = bind(gpmfParser, mp4.data, root(sample.offset, sample.size));
    return (
      <div>
        {samples.length} samples
        <TraverserView traverser={gpmf.clone()} />
      </div>
    );
  }
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
    <LeafletComponent
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

export function FilesComponent({ files }: { files: SomeFile[] }) {
  return (
    <LeafletComponent
      features={([] as Feature[]).concat(
        ...files.map(({ geojson }) =>
          geojson.type === 'Feature' ? [geojson] : geojson.features
        )
      )}
    />
  );
}

async function test() {
  const data = await SeekableFetchBuffer.forUrl(
    'https://static.ryanberdeen.com/everywhere/video/raw/GH010599.MP4',
    3024
  );
  const mp4 = bind(mp4Parser, data, fileRoot(data));
  const track = await getMeta(mp4);
  const geojson = await extractGps(track, mp4);
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
): f is RawTripFeature {
  return f.type === 'Feature' && !!f.properties?.activity?.moving_time;
}

function isProbablyVideoTrack(
  f: FeatureOrCollection<any, any>
): f is RawVideoFeature {
  return f.type === 'Feature' && !!f.properties?.creationTime;
}

export default function LocalDataExplorer({
  setDataSet,
}: {
  setDataSet(dataSet: DataSet): void;
}) {
  const [files, setFiles] = useState<SomeFile[] | undefined>();
  const previousFiles = useMemoAsync<FileWithHandle[] | undefined>(
    () => get('files'),
    []
  );
  async function setFiles2(newFiles: SomeFile[]) {
    const trips: RawTripFeature[] = [];

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
    setDataSet(buildDataSet(trips, videoChapters));
    setFiles(newFiles);
  }
  async function handleFiles(
    result: FileWithHandle[],
    existingFiles: SomeFile[] = []
  ) {
    const newFiles = await readFiles(result);
    // for safari, it seems to be important that you don't remove the files from indexDB before you read them.
    // removing them drops the reference or something
    await set('files', [...result, ...existingFiles.map(({ raw }) => raw)]);
    await setFiles2([...newFiles, ...existingFiles]);
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
        // mimeTypes: ['video/mp4'],
      });

      await handleFiles(result, files);
    },
    [files]
  );
  return (
    <>
      <PageTitle>Local Data</PageTitle>
      {previousFiles ? (
        <button onClick={() => handleFiles(previousFiles)}>
          Reload Previous {previousFiles.length} Files
        </button>
      ) : null}
      <button onClick={handleLoadClick}>load</button>
      <button onClick={handleAddClick}>add</button>
      {files ? <FilesComponent files={files} /> : null}
    </>
  );
}
