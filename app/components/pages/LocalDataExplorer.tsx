import {
  use,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { get, set, update } from 'idb-keyval';
import { fileOpen, FileWithHandle } from 'browser-fs-access';
import { Feature } from 'geojson';
import { ObjectInspector } from 'react-inspector';
import PageTitle from '../PageTitle';
import MapComponent from '../Map';
import MapContext from '../MapContext';
import MapBox from '../MapBox';
import { LeafletFeatureMap } from '../LeafletMap';
import Table from '../Table';
import TraverserView, { GpmfSamples } from '../data/TraverserView';
import { useMemoAsync } from '../../hooks';
import FullScreenPage from '../FullScreenPage';
import StandardPage from '../StandardPage';
import VectorTileView from '../VectorTileView';
import { NavExtension } from '../Nav';
import LoadingPage from './LoadingPage';
import {
  FileContentsWithDetails,
  FileHandleWithDetails,
  FileWithDetails,
  peekFile,
  readToDataset,
} from '../../file-data';
import { tools } from '../../tools';
import {
  create,
  toolFiles,
  toolFileStatus,
  toolReady,
  features as getFeatures,
} from '../../worker-stuff';
import { WorkerRemote } from '../../WorkerChannel';
import FeatureDetails from '../FeatureDetails';
import { Route, Switch, useRouteMatch } from 'react-router';
import { Link } from 'react-router-dom';
import { SeekableBlobBuffer } from '../../../tools/parse/buffers';
import { bind, fileRoot } from '../../../tools/parse';
import { parser as mp4Parser } from '../../../tools/parse/mp4';
import { getMeta } from '../../../tools/parse/gpmf';
import { DataSetProviderContext } from '../DataSetContext';

function Path({ feature }: { feature: Feature }) {
  const { path } = useContext(MapContext);

  // TODO handle points. this works, but draws a 4.5 radius circle with the same style as a trip
  // https://d3js.org/d3-geo/path#path_pointRadius
  return <path className="trip" d={path(feature)} />;
}

/** convert a component that takes a features prop to one that takes a channel prop */
function withChannel(Component: React.ComponentType<{ features: Feature[] }>) {
  return function ({ channel }: { channel: WorkerRemote }) {
    const features = useMemoAsync(
      () => channel.sendRequest(getFeatures, undefined),
      [channel]
    );

    if (!features) {
      return <LoadingPage />;
    } else {
      return <Component features={features} />;
    }
  };
}

function DirectFeaturesRoute({ features }: { features: Feature[] }) {
  const { path } = useRouteMatch();
  return (
    <Switch>
      <Route path={`${path}/list`}>
        <FeatureList features={features} />
      </Route>
      <Route path={`${path}/map`}>
        <FullScreenPage>
          <LeafletFeatureMap features={features} />
        </FullScreenPage>
      </Route>
      <Route path={`${path}/stylized`}>
        <StandardPage>
          <StylizedFeatureMap features={features} />
        </StandardPage>
      </Route>
      <Route path={`${path}/dataset`}>
        <StandardPage>
          <DataSetLoader features={features} />
        </StandardPage>
      </Route>
    </Switch>
  );
}

function FeatureList({ features }: { features: Feature[] }) {
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

const ChannelFeaturesView = withChannel(DirectFeaturesRoute);

export function SimpleVectorTileView({ features }: { features: Feature[] }) {
  const files = useMemo(
    () =>
      features.map<FileContentsWithDetails>((feature, i) => ({
        id: i.toString(),
        type: 'contents',
        file: new Blob([JSON.stringify(feature)], {
          type: 'application/json',
        }),
        name: `${i}.geojson`,
      })),
    [features]
  );
  const { channel } = useFilesInTool(files, 'geojson');
  return channel ? <VectorTileView channel={channel} /> : <div>loading</div>;
}

interface FileStatus {
  byIndex: { file: FileWithDetails; status: string }[];
  counts: Map<string, number>;
}

function useFilesInTool(files: FileWithDetails[], tool: string) {
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

      await channel.sendRequest(toolFiles, {
        files,
        tool,
      });

      return channel;
    },
    [files]
  );

  return { fileStatus, channel: ready ? channel : undefined };
}

function ToolStatus({ fileStatus }: { fileStatus: FileStatus }) {
  return (
    <div>
      {Array.from(fileStatus.counts.entries()).map(([status, count]) => (
        <span key={status}>
          <strong>{status}:</strong> <span>{count}</span>{' '}
        </span>
      ))}
    </div>
  );
}

function ToolView({
  files,
  tool,
  NavComponent,
}: {
  files: FileWithDetails[];
  tool: string;
  NavComponent: React.ReactNode;
}) {
  const { path, url } = useRouteMatch();

  const { fileStatus, channel } = useFilesInTool(files, tool);

  return (
    <>
      <NavExtension>
        <Link to={`${url}/map`}>Map</Link>{' '}
        <Link to={`${url}/features/list`}>Features</Link>{' '}
        <Link to={`${url}/features/map`}>Leaflet Map</Link>{' '}
        <Link to={`${url}/features/stylized`}>Stylized Map</Link>{' '}
        <Link to={`${url}/status`}>Status</Link> {NavComponent}
      </NavExtension>
      {channel ? (
        <Switch>
          <Route path={`${path}/features`}>
            <ChannelFeaturesView channel={channel} />
          </Route>
          <Route path={`${path}/map`}>
            <FullScreenPage>
              <VectorTileView channel={channel} />
            </FullScreenPage>
          </Route>
          <Route path={`${path}/status`}>
            <StandardPage>
              <ToolStatus fileStatus={fileStatus} />
            </StandardPage>
          </Route>
          <Route path={path}>
            <FullScreenPage>
              <VectorTileView channel={channel} />
            </FullScreenPage>
          </Route>
        </Switch>
      ) : (
        <LoadingPage>
          <ToolStatus fileStatus={fileStatus} />
        </LoadingPage>
      )}
    </>
  );
}

function Mp4View({ file }: { file: FileHandleWithDetails }) {
  const mp4 = useMemo(() => {
    const data = new SeekableBlobBuffer(file.file, 1024000);
    return bind(mp4Parser, data, fileRoot(data));
  }, [file]);

  const track = useMemoAsync(() => getMeta(mp4), [mp4]);

  return (
    <>
      <h2>MP4</h2>
      <TraverserView traverser={mp4} />
      {track?.samples ? (
        <>
          <h2>GPMF</h2>
          <GpmfSamples sampleMetadata={track.samples} mp4={mp4} />
        </>
      ) : null}
    </>
  );
}

function JsonView({ file }: { file: FileHandleWithDetails }) {
  const json = useMemoAsync(
    async () => JSON.parse(await file.file.text()),
    [file]
  );

  return <ObjectInspector data={json} />;
}

function StylizedFeatureMap({ features }: { features: Feature[] }) {
  return (
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
  );
}

function DataSetLoader({ features }: { features: Feature[] }) {
  const dataset = useMemoAsync(async () => readToDataset(features), [features]);
  const setDataSet = use(DataSetProviderContext);

  return dataset ? (
    <>
      <div>
        Trips: {dataset.trips.length}, Videos: {dataset.videos.size}
      </div>
      <button onClick={() => setDataSet(dataset)}>Set Dataset</button>
    </>
  ) : (
    <LoadingPage />
  );
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
        result.map(
          async (file, i) =>
            ({
              id: `${maxId + i + 1}`,
              type: 'handle',
              file,
            } as const)
        )
      );
      const allFiles = [...newFiles, ...existingFiles];
      // for safari, it seems to be important that you don't remove the files from indexDB before you read them.
      // removing them drops the reference or something

      // sometimes this takes several seconds, like with a video file
      // TODO use update()
      await set('files', allFiles);
      setFiles(allFiles);
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
  const { url } = useRouteMatch();

  const handleLoadClick = useCallback(
    async (e: React.MouseEvent) => {
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
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const result = await fileOpen({
        multiple: true,
      });

      await handleFiles(result, files);
    },
    [files, handleFiles]
  );

  const handleResetClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      handleFiles([]);
    },
    [handleFiles]
  );

  return (
    <StandardPage>
      <PageTitle>Local Data</PageTitle>
      <div>
        {files ? (
          <>
            <button onClick={handleLoadClick}>load</button>
            <button onClick={handleAddClick}>add</button>
            <button onClick={handleResetClick}>reset</button>
          </>
        ) : undefined}
      </div>
      <div>
        {files ? (
          <>
            <Link to={`${url}/file/all`}>All Files</Link>
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
          </tr>
        </thead>
        <tbody>
          {(files || []).slice(0, 100).map((f, i) => (
            <tr key={i}>
              <td>{f.id}</td>
              <td>
                <Link to={`${url}/file/${f.id}`}>{f.file.name}</Link>
              </td>
              <td>{f.file.size.toLocaleString()}</td>
              <td>{new Date(f.file.lastModified).toLocaleString()}</td>
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
    </StandardPage>
  );
}

export default function LocalDataExplorer() {
  const { path } = useRouteMatch();
  const { files, handleFiles } = useFiles();

  return (
    <Switch>
      <Route exact path={path}>
        <FileManager files={files} handleFiles={handleFiles} />
      </Route>
      <Route
        path={`${path}/file/:id`}
        render={(p) => <FileViewPage id={p.match.params.id} />}
      />
    </Switch>
  );
}

export function FileViewPage({ id }: { id: string }) {
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
  const singleFile = id !== 'all' ? selectedFiles[0] : undefined;
  return (
    <Switch>
      <Route exact path={path}>
        <StandardPage>
          <PageTitle>
            {singleFile ? singleFile.file.name : 'All Files'}
          </PageTitle>
          <div>
            <Link to={`${url}/tool/anything/features/dataset`}>dataset</Link>{' '}
            {singleFile != null && (
              <>
                <Link to={`${url}/view/json`}>json</Link>{' '}
                <Link to={`${url}/view/mp4`}>mp4</Link>{' '}
              </>
            )}
            <Link to={`${url}/tool/anything/features/list`}>Features</Link>{' '}
            <Link to={`${url}/tool/anything/features/map`}>Leaflet Map</Link>{' '}
            <Link to={`${url}/tool/anything/features/stylized`}>
              Stylized Map
            </Link>{' '}
            <Link to={`${url}/tool/anything/map`}>Vector Map</Link>{' '}
          </div>
          {Object.keys(tools).map((tool) => (
            <>
              <Link to={`${url}/tool/${tool}`}>{tool}</Link>{' '}
            </>
          ))}
          {singleFile != null && (
            <>
              <p>Size: {singleFile.file.size.toLocaleString()}</p>
              <p>
                Last Modified:{' '}
                {new Date(singleFile.file.lastModified).toLocaleString()}
              </p>
            </>
          )}
          <div>
            <p>
              <strong>data:</strong> Show data about a video file.
            </p>
            <p>
              <strong>simple map:</strong> Show a video file as a map, or
              geojson file using a pure leaflet map
            </p>
            <p>
              <strong>stylized map:</strong> Same as "load as map", but using
              the everywhere.bike style
            </p>
          </div>
        </StandardPage>
      </Route>
      <Route
        path={`${path}/view/mp4`}
        render={() => (
          <StandardPage>
            <Mp4View file={singleFile} />
          </StandardPage>
        )}
      />
      <Route
        path={`${path}/view/json`}
        render={() => (
          <StandardPage>
            <JsonView file={singleFile} />
          </StandardPage>
        )}
      />
      <Route path={`${path}/dataset`}>
        <StandardPage>
          <DataSetLoader files={selectedFiles} />
        </StandardPage>
      </Route>
      <Route
        path={`${path}/tool/:tool`}
        render={(p) => {
          return (
            <ToolView
              files={selectedFiles}
              tool={p.match.params.tool as any}
              NavComponent={<Link to={url}>File details</Link>}
            />
          );
        }}
      />
    </Switch>
  );
}
