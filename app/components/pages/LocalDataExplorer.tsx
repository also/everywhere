import { useCallback, useContext, useMemo, useState } from 'react';

import { get, set, update } from 'idb-keyval';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { Feature } from 'geojson';
import { ObjectInspector } from 'react-inspector';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import { DataSet } from '../../data';
import { LeafletFeatureMap } from '../LeafletMap';
import Table from '../Table';
import TraverserView, { GpmfSamples } from '../data/TraverserView';
import { useMemoAsync } from '../../hooks';
import FullScreenPage from '../FullScreenPage';
import StandardPage from '../StandardPage';
import VectorTileView from '../VectorTileView';
import { NavExtension } from '../Nav';
import LoadingPage from './LoadingPage';
import StylizedMap2 from '../Map';
import {
  FileContentsWithDetails,
  FileHandleWithDetails,
  FileWithDetails,
  peekFile,
  readFile,
  readFiles,
  readToDataset,
  SomeFile,
} from '../../file-data';
import { tools } from '../../tools';
import {
  create,
  featureSummary,
  toolFiles,
  toolFileStatus,
  toolReady,
} from '../../worker-stuff';
import { WorkerChannel } from '../../WorkerChannel';
import FeatureDetails from '../FeatureDetails';

function Path({ feature }: { feature: Feature }) {
  const { path } = useContext(MapContext);

  // TODO handle points. this works, but draws a 4.5 radius circle with the same style as a trip
  // https://d3js.org/d3-geo/path#path_pointRadius
  return <path className="trip" d={path(feature)} />;
}

function FeaturesView({ channel }: { channel: WorkerChannel }) {
  const features = useMemoAsync(async () => {
    return await channel.sendRequest(featureSummary, undefined);
  }, [channel]);

  if (!features) {
    return <LoadingPage />;
  } else {
    return (
      <StandardPage>
        <div>{features.length} features</div>
        <ul>
          {features.map((f, i) => (
            <li key={i}>
              {f.geometry.type} <FeatureDetails feature={f} />
            </li>
          ))}
        </ul>
      </StandardPage>
    );
  }
}

export function SimpleVectorTileView({ features }: { features: Feature[] }) {
  const files = useMemo(
    () =>
      features
        .map<FileContentsWithDetails>((feature, i) => ({
          id: i.toString(),
          type: 'contents',
          file: new Blob([JSON.stringify(feature)], {
            type: 'application/json',
          }),
        }))
        .map(
          (file) =>
            ({
              file,
              type: 'generic',
            } as const)
        ),
    [features]
  );
  const { channel } = useFilesInTool(files, 'anything');
  return channel ? <VectorTileView channel={channel} /> : <div>loading</div>;
}

function useFilesInTool(
  files: {
    file: FileWithDetails;
    type: 'osm' | 'generic';
  }[],
  tool: keyof typeof tools
) {
  const [fileStatus, setFileStatus] = useState({
    byIndex: files.map((file) => ({ file, status: 'pending' })),
    counts: new Map([['pending', files.length]]),
  });
  const [ready, setReady] = useState(false);
  const channel = useMemoAsync(
    async ({ signal }) => {
      setFileStatus({
        byIndex: files.map((file) => ({ file, status: 'pending' })),
        counts: new Map([['pending', files.length]]),
      });
      const { channel, worker } = await create();
      signal.addEventListener('abort', () => {
        worker.terminate();
      });
      channel.handle(toolFileStatus, ({ index, status }) => {
        setFileStatus((old) => {
          const counts = new Map(old.counts);
          const oldStatus = old.byIndex[index].status;
          counts.set(oldStatus, counts.get(oldStatus)! - 1);
          counts.set(status, (counts.get(status) || 0) + 1);
          return {
            byIndex: old.byIndex.map((o, i) =>
              i === index ? { ...o, status } : o
            ),
            counts,
          };
        });
      });

      channel.handle(toolReady, () => {
        setReady(true);
      });

      await channel.sendRequest(toolFiles, { files, tool });

      return channel;
    },
    [files]
  );

  return { fileStatus, channel: ready ? channel : undefined };
}

function ToolView({
  files,
  tool,
  NavComponent,
}: {
  files: {
    file: FileWithDetails;
    type: 'osm' | 'generic';
  }[];
  tool: keyof typeof tools;
  NavComponent: React.ReactNode;
}) {
  const [show, setShow] = useState<'features' | 'map'>('map');

  const { fileStatus, channel } = useFilesInTool(files, tool);

  return (
    <>
      <NavExtension>
        <button onClick={() => setShow('features')}>features</button>{' '}
        <button onClick={() => setShow('map')}>map</button> {NavComponent}
      </NavExtension>
      {channel ? (
        show === 'features' ? (
          <FeaturesView channel={channel} />
        ) : (
          <FullScreenPage>
            <VectorTileView channel={channel} />
          </FullScreenPage>
        )
      ) : (
        <LoadingPage>
          {Array.from(fileStatus.counts.entries()).map(([status, count]) => (
            <span key={status}>
              <strong>{status}:</strong> <span>{count}</span>{' '}
            </span>
          ))}
        </LoadingPage>
      )}
    </>
  );
}

function DataView({ file }: { file: FileHandleWithDetails }) {
  const loaded = useMemoAsync<SomeFile>(() => readFile(file), [file]);

  if (!loaded) {
    return <LoadingPage />;
  }
  const { json, mp4, track } = loaded;
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
        <ObjectInspector data={json} />
      )}
    </StandardPage>
  );
}

function StylizedMap({ files }: { files: FileHandleWithDetails[] }) {
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
    <StylizedMap2 width={600} height={600} asLoadingAnimation={true} />
  );
}

function SimpleLeafletMap({ files }: { files: FileHandleWithDetails[] }) {
  const loadedFiles = useMemoAsync(() => readFiles(files), [files]);
  return loadedFiles ? (
    <LeafletFeatureMap
      features={loadedFiles
        .map(({ geojson }) =>
          geojson.type === 'Feature' ? [geojson] : geojson.features
        )
        .flat()}
    />
  ) : (
    <StylizedMap2 width={600} height={600} asLoadingAnimation={true} />
  );
}

function DataSetLoader({
  files,
  setDataSet,
}: {
  files: FileHandleWithDetails[];
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
    return <StylizedMap2 width={600} height={600} asLoadingAnimation={true} />;
  }
}

export default function LocalDataExplorer({
  setDataSet,
}: {
  setDataSet(dataSet: DataSet): void;
}) {
  const [files, setFiles] = useState<FileHandleWithDetails[] | undefined>();
  const [selectedFiles, setSelectedFiles] =
    useState<{
      files: FileHandleWithDetails[];
      reason:
        | 'simple-leaflet-map'
        | 'data'
        | 'extract-map'
        | 'stylized-map'
        | 'dataset'
        | 'tool';
    }>();

  const [type, setType] = useState('generic');
  const initialized = useMemoAsync<boolean>(async () => {
    setFiles(await get('files'));
    return true;
  }, []);

  const [tool, setTool] = useState<keyof typeof tools>('anything');

  async function handleFiles(
    result: FileWithHandle[],
    existingFiles: FileHandleWithDetails[] = []
  ) {
    let maxId: number;
    await update('maxId', (current = 0) => {
      maxId = current + result.length;
      return maxId;
    });
    const newFiles: FileHandleWithDetails[] = await Promise.all(
      result.map(async (file, i) => ({
        id: `${maxId + i + 1}`,
        type: 'handle',
        file,
        inferredType: await peekFile(file),
      }))
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

  if (selectedFiles) {
    if (selectedFiles.reason === 'tool') {
      return (
        <ToolView
          files={selectedFiles.files.map((file) => ({
            file,
            type: type as any,
          }))}
          tool={tool}
          NavComponent={
            <>
              {selectedFiles.files[0].file.name}
              {selectedFiles.files.length > 1
                ? ` + ${selectedFiles.files.length - 1} `
                : ' '}
              <button onClick={() => setSelectedFiles(undefined)}>
                Unload
              </button>
            </>
          }
        />
      );
    } else {
      return (
        <>
          <NavExtension>
            {selectedFiles.files[0].file.name}
            {selectedFiles.files.length > 1
              ? ` + ${selectedFiles.files.length - 1} `
              : ' '}
            <button onClick={() => setSelectedFiles(undefined)}>Unload</button>
          </NavExtension>
          {selectedFiles.reason === 'simple-leaflet-map' ? (
            <SimpleLeafletMap files={selectedFiles.files} />
          ) : selectedFiles.reason === 'stylized-map' ? (
            <StylizedMap files={selectedFiles.files} />
          ) : selectedFiles.reason === 'dataset' ? (
            <StandardPage>
              <DataSetLoader
                files={selectedFiles.files}
                setDataSet={setDataSet}
              />
            </StandardPage>
          ) : (
            <DataView file={selectedFiles.files[0]} />
          )}
        </>
      );
    }
  }

  return (
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
          </>
        ) : undefined}
      </div>
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
            <button onClick={handleResetClick}>reset</button> Tool:{' '}
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value as any)}
            >
              {Object.keys(tools).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button onClick={() => setSelectedFiles({ files, reason: 'tool' })}>
              run
            </button>
          </>
        ) : undefined}
      </div>
      <Table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Size</th>
            <th>Last Modified</th>
            <th>Inferred Type</th>
          </tr>
        </thead>
        <tbody>
          {(files || []).slice(0, 100).map((f, i) => (
            <tr key={i}>
              <td>{f.id}</td>
              <td>{f.file.name}</td>
              <td>{f.file.size.toLocaleString()}</td>
              <td>{new Date(f.file.lastModified).toLocaleString()}</td>
              <td>{f.inferredType}</td>
              <td>
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
                <button
                  onClick={() =>
                    setSelectedFiles({ files: [f], reason: 'tool' })
                  }
                >
                  tool
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {files && files.length > 100 && (
        <div>{files.length - 100} files not shown</div>
      )}

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
