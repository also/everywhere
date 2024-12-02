import { useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
import { Route, Switch, useRouteMatch } from 'react-router';
import { Link, useHistory } from 'react-router-dom';

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

type HandleFiles = (
  result: FileWithHandle[],
  existingFiles?: FileHandleWithDetails[]
) => Promise<void>;

function useFiles() {
  const [files, setFiles] =
    useState<FileHandleWithDetails[] | undefined>(undefined);

  const handleFiles = useMemo(() => {
    return async function handleFiles(
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
      // TODO use update()
      const allFiles = [...newFiles, ...existingFiles];
      setFiles(allFiles);
      // for safari, it seems to be important that you don't remove the files from indexDB before you read them.
      // removing them drops the reference or something
      await set('files', allFiles);
    };
  }, []);

  useEffect(() => {
    (async () => setFiles((await get('files')) ?? []))();
  }, []);

  return { files, handleFiles };
}

function FileManager({
  files,
  handleFiles,
}: {
  files: FileHandleWithDetails[] | undefined;
  handleFiles: HandleFiles;
}) {
  const history = useHistory();

  const { path, url } = useRouteMatch();

  const [type, setType] = useState('generic');

  const [tool, setTool] = useState<keyof typeof tools>('anything');

  const handleLoadClick = useCallback(
    async (e) => {
      e.preventDefault();
      const result = await fileOpen({
        multiple: true,
        // mimeTypes: ['video/mp4'],
      });

      await handleFiles(result);
    },
    [handleFiles]
  );
  const handleAddClick = useCallback(
    async (e) => {
      e.preventDefault();
      const result = await fileOpen({
        multiple: true,
      });

      await handleFiles(result, files);
    },
    [files, handleFiles]
  );

  const handleResetClick = useCallback(
    async (e) => {
      e.preventDefault();
      handleFiles([]);
    },
    [handleFiles]
  );

  return (
    <StandardPage>
      <PageTitle>Local Data</PageTitle>
      <div>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option>generic</option>
          <option>osm</option>
        </select>
        {files ? (
          <>
            <button onClick={handleLoadClick}>load</button>
            <button onClick={handleAddClick}>add</button>
            <button onClick={handleResetClick}>reset</button>
          </>
        ) : undefined}
      </div>
      <div>
        {' '}
        {files ? (
          <>
            All files: <Link to={`${url}/file/all/view/dataset`}>dataset</Link>{' '}
            <Link to={`${url}/file/all/view/stylized-map`}>stylized map</Link>{' '}
            <Link to={`${url}/file/all/view/simple-leaflet-map`}>
              simple map
            </Link>{' '}
            Tool:{' '}
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
            <button
              onClick={() => history.push(`${url}/file/all/tool/${tool}`)}
            >
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
                <Link to={`${url}/file/${f.id}/view/data`}>data</Link>{' '}
                <Link to={`${url}/file/${f.id}/view/simple-leaflet-map`}>
                  {' '}
                  simple map
                </Link>{' '}
                <Link to={`${url}/file/${f.id}/view/stylized-map`}>
                  stylized map
                </Link>{' '}
                <Link to={`/local/file/${f.id}`}>tools</Link>
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

function SelectedFilesView({
  reason,
  selectedFiles,
  setDataSet,
}: {
  reason: string;
  selectedFiles: FileHandleWithDetails[];
  setDataSet(dataSet: DataSet): void;
}) {
  const history = useHistory();

  return (
    <>
      <NavExtension>
        {selectedFiles[0].file.name}
        {selectedFiles.length > 1 ? ` + ${selectedFiles.length - 1} ` : ' '}
        <button onClick={() => history.push('/local')}>Unload</button>
      </NavExtension>
      {reason === 'simple-leaflet-map' ? (
        <SimpleLeafletMap files={selectedFiles} />
      ) : reason === 'stylized-map' ? (
        <StylizedMap files={selectedFiles} />
      ) : reason === 'dataset' ? (
        <StandardPage>
          <DataSetLoader files={selectedFiles} setDataSet={setDataSet} />
        </StandardPage>
      ) : (
        <DataView file={selectedFiles[0]} />
      )}
    </>
  );
}

export default function LocalDataExplorer({
  setDataSet,
}: {
  setDataSet(dataSet: DataSet): void;
}) {
  const { path } = useRouteMatch();
  const { files, handleFiles } = useFiles();

  return (
    <Switch>
      <Route exact path={path}>
        <FileManager files={files} handleFiles={handleFiles} />
      </Route>
      <Route
        path={`${path}/file/:id`}
        render={(p) => (
          <FileViewPage id={p.match.params.id} setDataSet={setDataSet} />
        )}
      />
    </Switch>
  );
}

export function FileViewPage({
  id,
  setDataSet,
}: {
  id: string;
  setDataSet(dataSet: DataSet): void;
}) {
  const { files } = useFiles();
  const selectedFiles = useMemo(
    () => (id === 'all' ? files : files?.filter((f) => f.id === id)) ?? [],
    [files, id]
  );
  const { path, url } = useRouteMatch();
  if (!files) {
    return <LoadingPage />;
  }
  if (selectedFiles.length === 0) {
    return <div>No matching files</div>;
  }
  const firstFile = selectedFiles[0];
  return (
    <Switch>
      <Route exact path={path}>
        <StandardPage>
          <PageTitle>
            {id === 'all' ? 'All Files' : firstFile.file.name}
          </PageTitle>
          <div>
            <Link to={`${url}/view/dataset`}>dataset</Link>{' '}
            {id !== 'all' && (
              <>
                <Link to={`${url}/view/data`}>data</Link>{' '}
              </>
            )}
            <Link to={`${url}/view/stylized-map`}>stylized map</Link>{' '}
            <Link to={`${url}/view/simple-leaflet-map`}>simple map</Link>{' '}
          </div>
          {Object.keys(tools).map((tool) => (
            <>
              <Link to={`${url}/tool/${tool}`}>{tool}</Link>{' '}
            </>
          ))}
          {id !== 'all' && (
            <>
              <p>Size: {firstFile.file.size.toLocaleString()}</p>
              <p>
                Last Modified:{' '}
                {new Date(firstFile.file.lastModified).toLocaleString()}
              </p>
              <p>Inferred Type: {firstFile.inferredType}</p>
            </>
          )}
        </StandardPage>
      </Route>
      <Route
        path={`${path}/view/:reason`}
        render={(p) => {
          if (!files) {
            return <LoadingPage />;
          }
          return (
            <SelectedFilesView
              selectedFiles={selectedFiles}
              reason={p.match.params.reason}
              setDataSet={setDataSet}
            />
          );
        }}
      />
      <Route
        path={`${path}/tool/:tool`}
        render={(p) => {
          return (
            <FullScreenPage>
              <ToolView
                files={selectedFiles.map((f) => ({ file: f, type: 'generic' }))}
                tool={p.match.params.tool as any}
                NavComponent={<Link to={url}>File details</Link>}
              />
            </FullScreenPage>
          );
        }}
      />
    </Switch>
  );
}
