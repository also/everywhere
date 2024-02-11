import React, { useCallback, useContext, useEffect, useState } from 'react';

import { get, set } from 'idb-keyval';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { Feature, FeatureCollection } from 'geojson';
import { ObjectInspector } from 'react-inspector';
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
import FullScreenPage from '../FullScreenPage';
import StandardPage from '../StandardPage';
import { VectorTileFileView } from '../VectorTileFileView';
import { NavExtension } from '../Nav';
import LoadingPage from './LoadingPage';
import { CompleteActivity } from '../../../tools/strava-api';
import { completeActivityToGeoJson } from '../../../tools/strava';
import Map from '../Map';

interface FileWithDetails {
  file: FileWithHandle;
  inferredType?: string;
}

function Path({ feature }: { feature: Feature }) {
  const { path } = useContext(MapContext);

  return <path className="trip" d={path(feature)} />;
}

type SomeFile = {
  geojson: Feature | FeatureCollection;
  mp4?: Traverser<Box>;
  track?: Metadata;
  raw: FileWithHandle;
};

function DataView({ file }: { file: FileWithDetails }) {
  const loaded = useMemoAsync<SomeFile>(() => readFile(file.file), [file]);

  if (!loaded) {
    return <LoadingPage />;
  }
  const { geojson, mp4, track } = loaded;
  return (
    <StandardPage>
      {mp4 ? (
        <>
          <h2>MP4</h2>
          <TraverserView traverser={mp4} />
          {track?.samples ? (
            <>
              <h2>GMPF Samples</h2>
              <GpmfSamples sampleMetadata={track.samples} mp4={mp4} />
            </>
          ) : null}
        </>
      ) : (
        <ObjectInspector data={geojson} />
      )}
    </StandardPage>
  );
}

function StylizedMap({ files }: { files: FileWithDetails[] }) {
  const features = useMemoAsync(async () => {
    const loadedFiles = await readFiles(files);
    return loadedFiles
      .map(({ geojson }) =>
        geojson.type === 'Feature' ? [geojson] : geojson.features
      )
      .flat();
  }, [files]);

  return features ? (
    <StandardPage>
      <MapBox>
        <MapComponent
          width={1000}
          height={1000}
          zoomFeature={features.length === 1 ? features[0] : undefined}
        >
          {features.map((f, i) => (
            <Path feature={f} key={i} />
          ))}
        </MapComponent>
      </MapBox>
    </StandardPage>
  ) : (
    <Map width={600} height={600} asLoadingAnimation={true} />
  );
}

function SimpleLeafletMap({ files }: { files: FileWithDetails[] }) {
  const loadedFiles = useMemoAsync(() => readFiles(files), [files]);
  return loadedFiles ? (
    <LeafletMap
      features={loadedFiles
        .map(({ geojson }) =>
          geojson.type === 'Feature' ? [geojson] : geojson.features
        )
        .flat()}
    />
  ) : (
    <Map width={600} height={600} asLoadingAnimation={true} />
  );
}

function DataSetLoader({
  files,
  setDataSet,
}: {
  files: FileWithDetails[];
  setDataSet(dataSet: DataSet): void;
}) {
  const dataset = useMemoAsync(
    async () => readToDataset(await readFiles(files)),
    [files]
  );

  if (dataset) {
    return (
      <>
        <div>
          Trips: {dataset.trips.length}, Videos: {dataset.videos.size}
        </div>
        <button onClick={() => setDataSet(dataset)}>Set Dataset</button>
      </>
    );
  } else {
    return <Map width={600} height={600} asLoadingAnimation={true} />;
  }
}

function isProbablyStravaCompleteActivity(json: any): json is CompleteActivity {
  return json.activity && json.streams;
}

async function readFile(file: File): Promise<SomeFile> {
  let geojson: Feature | FeatureCollection | undefined;
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
    if (isProbablyStravaCompleteActivity(json)) {
      geojson = completeActivityToGeoJson(json);
    } else if (json.type === 'Topology') {
      geojson = features(json);
    } else {
      geojson = json as Feature;
    }
  }
  if (!geojson) {
    geojson = {
      type: 'FeatureCollection',
      features: [],
    };
  }
  (geojson.type === 'FeatureCollection' ? geojson.features : [geojson]).forEach(
    (feat) => {
      if (!feat.properties) {
        feat.properties = {};
      }
      feat.properties.filename = file.name;
    }
  );
  return { geojson, mp4, track, raw: file };
}

function readFiles(files: FileWithDetails[]): Promise<SomeFile[]> {
  return Promise.all(files.map((file) => readFile(file.file)));
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

async function peekFile(file: FileWithHandle) {
  const head = file.slice(0, 100);
  const value = await head.arrayBuffer();
  const array = new Uint8Array(value);
  // if json
  if (array[0] === 123) {
    const s = new TextDecoder('ascii').decode(array);
    const type = s.match(/{\s*"type"\s*:\s*"([^"]+)"/)?.[1];
    return type ?? 'json';
  }
  return 'unknown';
}

export default function LocalDataExplorer({
  setDataSet,
}: {
  setDataSet(dataSet: DataSet): void;
}) {
  const [files, setFiles] = useState<FileWithDetails[] | undefined>();
  const [selectedFiles, setSelectedFiles] =
    useState<{
      files: FileWithDetails[];
      reason:
        | 'map'
        | 'simple-leaflet-map'
        | 'data'
        | 'extract-map'
        | 'stylized-map'
        | 'dataset';
    }>();

  const [type, setType] = useState('generic');
  const initialized = useMemoAsync<boolean>(async () => {
    setFiles(await get('files'));
    return true;
  }, []);

  async function handleFiles(
    result: FileWithHandle[],
    existingFiles: FileWithDetails[] = []
  ) {
    const newFiles: FileWithDetails[] = await Promise.all(
      result.map(async (file) => ({ file, inferredType: await peekFile(file) }))
    );
    const allFiles = [...newFiles, ...existingFiles];
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

  const handleResetClick = useCallback(async (e) => {
    e.preventDefault();
    await set('files', undefined);
    setFiles(undefined);
  }, []);

  return selectedFiles ? (
    <>
      <NavExtension>
        {selectedFiles.files[0].file.name}
        {selectedFiles.files.length > 1
          ? ` + ${selectedFiles.files.length - 1} `
          : ' '}
        <button onClick={() => setSelectedFiles(undefined)}>Unload</button>
      </NavExtension>
      {selectedFiles.reason === 'map' ? (
        <FullScreenPage>
          <VectorTileFileView
            files={selectedFiles.files.map((f) => ({
              file: f.file,
              type: type as any,
            }))}
          />
        </FullScreenPage>
      ) : selectedFiles.reason === 'simple-leaflet-map' ? (
        <SimpleLeafletMap files={selectedFiles.files} />
      ) : selectedFiles.reason === 'stylized-map' ? (
        <StylizedMap files={selectedFiles.files} />
      ) : selectedFiles.reason === 'dataset' ? (
        <StandardPage>
          <DataSetLoader files={selectedFiles.files} setDataSet={setDataSet} />
        </StandardPage>
      ) : (
        <DataView file={selectedFiles.files[0]} />
      )}
    </>
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
            <button onClick={handleAddClick}>add</button>{' '}
            <button onClick={handleResetClick}>reset</button>
          </>
        ) : undefined}
      </div>
      <Table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Last Modified</th>
            <th>Inferred Type</th>
          </tr>
        </thead>
        <tbody>
          {(files || []).map((f, i) => (
            <tr key={i}>
              <td>{f.file.name}</td>
              <td>{f.file.size.toLocaleString()}</td>
              <td>{new Date(f.file.lastModified).toLocaleString()}</td>
              <td>{f.inferredType}</td>
              <td>
                <button
                  onClick={() =>
                    setSelectedFiles({ files: [f], reason: 'map' })
                  }
                >
                  fancy map
                </button>
                <button
                  onClick={() =>
                    setSelectedFiles({ files: [f], reason: 'data' })
                  }
                >
                  data
                </button>
                <button
                  onClick={() =>
                    setSelectedFiles({
                      files: [f],
                      reason: 'simple-leaflet-map',
                    })
                  }
                >
                  simple map
                </button>
                <button
                  onClick={() =>
                    setSelectedFiles({ files: [f], reason: 'stylized-map' })
                  }
                >
                  stylized map
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div>
        {' '}
        {files ? (
          <>
            All files:{' '}
            <button
              onClick={() => setSelectedFiles({ files, reason: 'dataset' })}
            >
              dataset
            </button>
            <button onClick={() => setSelectedFiles({ files, reason: 'map' })}>
              fancy map
            </button>
            <button
              onClick={() =>
                setSelectedFiles({ files, reason: 'stylized-map' })
              }
            >
              stylized map
            </button>
            <button
              onClick={() =>
                setSelectedFiles({ files, reason: 'simple-leaflet-map' })
              }
            >
              simple map
            </button>
          </>
        ) : undefined}
      </div>
      <p>
        <strong>load:</strong> replace the current list of files with the
        selected files
      </p>
      <p>
        <strong>add:</strong> add the selected files to the current list of
        files
      </p>
      <h2>For each file</h2>
      <p>
        <strong>fancy map:</strong> Assuming the file is a geojson or topojson
        file, load it in a map view using geojson-vt to render it with
        reasonable performance
      </p>
      <p>
        <strong>data:</strong> Show data about a video file.
      </p>
      <p>
        <strong>simple map:</strong> Show a video file as a map, or geojson file
        using a pure leaflet map
      </p>
      <p>
        <strong>stylized map:</strong> Same as "load as map", but using the
        everywhere.bike style
      </p>
    </StandardPage>
  );
}
