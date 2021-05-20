import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { fileOpen } from 'browser-fs-access';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import L from 'leaflet';
import { SeekableBlobBuffer } from '../../../tools/parse/buffers';
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
        .on('click', () => console.log(f.properties))
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
  geojson: GeoJSON.Feature;
  mp4?: Traverser<Box>;
  track?: Metadata;
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
    <LeafletComponent features={[geojson]} />
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

export default function LocalDataExplorer() {
  const [files, setFiles] = useState<SomeFile[] | undefined>();
  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    const result = [
      await fileOpen({
        mimeTypes: ['video/mp4'],
      }),
    ];
    setFiles(
      await Promise.all(
        result.map(async (file) => {
          let geojson: GeoJSON.Feature;
          let mp4;
          let track;
          if (file.name.toLowerCase().endsWith('.mp4')) {
            const data = new SeekableBlobBuffer(file, 1024000);
            mp4 = bind(mp4Parser, data, fileRoot(data));
            track = await getMeta(mp4);
            geojson = await extractGps(track, mp4);
          } else {
            const text = await file.text();
            geojson = JSON.parse(text) as GeoJSON.Feature;
          }
          geojson.properties!.filename = file.name;
          return { geojson, mp4, track };
        })
      )
    );
  }, []);
  return (
    <>
      <PageTitle>Local Data</PageTitle>
      <button onClick={handleClick}>load</button>
      {files ? <FileComponent file={files[0]} /> : null}
    </>
  );
}
