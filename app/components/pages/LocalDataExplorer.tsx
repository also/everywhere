import React, { useCallback, useContext, useEffect, useState } from 'react';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';

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
      <p>State: {value.state}</p>
      {value.state === 'error' ? <pre>{value.error.toString()}</pre> : null}
      {value.state === 'loaded' ? <Component value={value.value} /> : null}
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

function GeoJSONFileView({ value }: { value: GeoJSON.Feature }) {
  return (
    <MapComponent width={1000} height={1000} zoomFeature={value}>
      <Path feature={value} />
    </MapComponent>
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
  const [files, setFiles] = useState<File[] | undefined>();
  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    const result = await window.showOpenFilePicker({ multiple: true });
    setFiles(await Promise.all(result.map((f) => f.getFile())));
  }, []);
  return (
    <>
      <PageTitle>Local Data</PageTitle>
      <button onClick={handleClick}>load</button>
      {files ? files.map((f, i) => <File file={f} key={i} />) : null}
    </>
  );
}
