import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import L from 'leaflet';
import { SeekableBlobBuffer } from '../../../tools/parse/buffers';
import { extractGps } from '../../../tools/parse/gopro-gps';

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
  const mapComponent = useRef();
  const mapRef = useRef<L.Map>();

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapComponent.current).setView(
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
        .on('click', (e) => console.log(f.properties))
    );
  }, [features]);

  return <div ref={mapComponent} style={{ width: 1800, height: 1000 }} />;
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
  const [files, setFiles] = useState<GeoJSON.Feature[] | undefined>();
  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    const result = await window.showOpenFilePicker({ multiple: true });
    setFiles(
      await Promise.all(
        result.map(async (h) => {
          const file = await h.getFile();
          let geojson: GeoJSON.Feature;
          if (file.name.toLowerCase().endsWith('.mp4')) {
            geojson = await extractGps(new SeekableBlobBuffer(file, 10240));
          } else {
            const text = await file.text();
            geojson = JSON.parse(text) as GeoJSON.Feature;
          }
          geojson.properties!.filename = file.name;
          return geojson;
        })
      )
    );
  }, []);
  return (
    <>
      <PageTitle>Local Data</PageTitle>
      <button onClick={handleClick}>load</button>
      {files ? <LeafletComponent features={files} /> : null}
    </>
  );
}
