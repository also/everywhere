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
import PageTitle from '../../PageTitle';
import MapComponent from '../../stylized/Map';
import MapContext from '../../stylized/MapContext';
import MapBox from '../../MapBox';
import { LeafletFeatureMap } from '../../LeafletMap';
import Table from '../../Table';
import TraverserView, { GpmfSamples } from '../../data/TraverserView';
import { useMemoAsync } from '../../../hooks';
import FullScreenPage from '../../FullScreenPage';
import StandardPage from '../../StandardPage';
import VectorTileView from '../../VectorTileView';
import { NavExtension } from '../../Nav';
import LoadingPage from '../LoadingPage';
import {
  datasetToFiles,
  FileContentsWithDetails,
  FileHandleWithDetails,
  FileUrlWithDetails,
  FileWithDetails,
  getFilename,
  readToDataset,
} from '../../../file-data';
import { getFileBlob, getTools, tools } from '../../../tools';
import {
  create,
  toolFiles,
  toolFileStatus,
  toolReady,
  features as getFeatures,
  getFeature,
} from '../../../worker-stuff';
import { WorkerRemote } from '../../../WorkerChannel';
import FeatureDetails from '../../FeatureDetails';
import { Route, Switch, useRouteMatch } from 'react-router';
import { Link } from 'react-router-dom';
import { SeekableBlobBuffer } from '../../../../tools/parse/buffers';
import { bind, fileRoot } from '../../../../tools/parse';
import { parser as mp4Parser } from '../../../../tools/parse/mp4';
import { getMeta } from '../../../../tools/parse/gpmf';
import DataSetContext, { DataSetProviderContext } from '../../DataSetContext';

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
  const { path, url } = useRouteMatch();
  return (
    <Switch>
      <Route path={`${path}/list`}>
        <FeatureList features={features} featuresUrl={`${url}`} />
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

function FeatureList({
  features,
  featuresUrl,
}: {
  features: Feature[];
  featuresUrl: string;
}) {
  return (
    <StandardPage>
      <div>{features.length} features</div>
      <Table>
        <thead>
          <tr>
            <th></th>
            <th>File ID</th>
            <th>Filename</th>
            <th>Tool</th>
            <th>Type</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i}>
              <td>
                <Link
                  to={`${featuresUrl}/feature/${f.properties?.everywhereFeatureIndex}`}
                >
                  {i}
                </Link>
              </td>
              <td>{f.properties?.everywhereFileId ?? 'unknown'}</td>
              <td>{f.properties?.everywhereFilename ?? 'unknown'}</td>
              <td>{f.properties?.everywhereTool ?? 'unknown'}</td>
              <td>{f.geometry.type}</td>
              <td>
                <FeatureDetails feature={f} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </StandardPage>
  );
}

function FeatureDetailsPage({ channel }: { channel: WorkerRemote }) {
  const { idx } = useRouteMatch<{ idx: string }>().params;
  const feature = useMemoAsync(
    () => channel.sendRequest(getFeature, { index: parseInt(idx) }),
    [channel]
  );
  return (
    <StandardPage>
      <FeatureDetails feature={feature} />
      {feature?.properties && <ObjectInspector data={feature.properties} />}
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

function CommonToolLinks({ url }: { url: string }) {
  return (
    <>
      <Link to={`${url}/map`}>Map</Link>{' '}
      <Link to={`${url}/features/list`}>Features</Link>{' '}
      <Link to={`${url}/features/map`}>Leaflet Map</Link>{' '}
      <Link to={`${url}/features/stylized`}>Stylized Map</Link>{' '}
    </>
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
        <CommonToolLinks url={url} /> <Link to={`${url}/status`}>Status</Link>{' '}
        {NavComponent}
      </NavExtension>
      {channel ? (
        <Switch>
          <Route path={`${path}/features/feature/:idx`}>
            <FeatureDetailsPage channel={channel} />
          </Route>
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

function Mp4View({ file }: { file: FileWithDetails }) {
  const mp4 = useMemoAsync(async () => {
    const data = new SeekableBlobBuffer(await getFileBlob(file), 1024000);
    return bind(mp4Parser, data, fileRoot(data));
  }, [file]);

  const track = useMemoAsync(
    () => (mp4 ? getMeta(mp4) : Promise.resolve(undefined)),
    [mp4]
  );

  if (!mp4) {
    return <div>Loading...</div>;
  }
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

async function getFileText(file: FileWithDetails): Promise<string> {
  switch (file.type) {
    case 'handle':
    case 'contents':
      return file.file.text();
    case 'url':
      const response = await fetch(file.url);
      return response.text();
  }
}

function JsonView({ file }: { file: FileWithDetails }) {
  const json = useMemoAsync(
    async () => JSON.parse(await getFileText(file)),
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
  existingFiles?: FileWithDetails[]
) => Promise<void>;

type HandleUrls = (
  urls: string[],
  existingFiles?: FileWithDetails[]
) => Promise<void>;

function useFiles() {
  const [files, setFiles] = useState<FileWithDetails[] | undefined>(undefined);

  const handleFiles = useMemo(() => {
    return async function handleFiles(
      result: FileWithHandle[],
      existingFiles: FileWithDetails[] = []
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

  const handleUrls = useMemo(() => {
    return async function handleUrls(
      urls: string[],
      existingFiles: FileWithDetails[] = []
    ) {
      let maxId: number;
      await update('maxId', (current = 0) => {
        maxId = current + urls.length;
        return maxId;
      });
      const newFiles: FileUrlWithDetails[] = urls.map((url, i) => ({
        id: `${maxId + i + 1}`,
        type: 'url' as const,
        url,
        name: new URL(url).pathname.split('/').pop() || url,
      }));
      const allFiles = [...newFiles, ...existingFiles];
      await set('files', allFiles);
      setFiles(allFiles);
    };
  }, []);

  useEffect(() => {
    (async () => setFiles((await get('files')) ?? []))();
  }, []);

  return { files, handleFiles, handleUrls };
}

function FilesTable({ files }: { files: FileWithDetails[] }) {
  const { url } = useRouteMatch();

  return (
    <>
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
                <Link to={`${url}/file/${f.id}`}>{getFilename(f)}</Link>
              </td>
              <td>
                {f.type === 'handle' || f.type === 'contents'
                  ? f.file.size.toLocaleString()
                  : 'N/A'}
              </td>
              <td>
                {f.type === 'handle'
                  ? new Date(f.file.lastModified).toLocaleString()
                  : f.type === 'url'
                  ? 'N/A'
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {files && files.length > 100 && (
        <div>{files.length - 100} files not shown</div>
      )}
    </>
  );
}

function FileManager({
  files,
  handleFiles,
  handleUrls,
}: {
  files: FileWithDetails[] | undefined;
  handleFiles: HandleFiles;
  handleUrls: HandleUrls;
}) {
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

  const [urlInput, setUrlInput] = useState('');

  const handleAddUrlClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (urlInput.trim()) {
        await handleUrls([urlInput.trim()], files);
        setUrlInput('');
      }
    },
    [handleUrls, urlInput, files]
  );

  return (
    <StandardPage>
      <PageTitle>Files</PageTitle>
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
        <input
          type="url"
          placeholder="Enter URL..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          style={{ width: '400px', marginRight: '8px' }}
        />
        <button onClick={handleAddUrlClick}>add url</button>
      </div>
      <FilesTable files={files ?? []} />

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
  const { files, handleFiles, handleUrls } = useFiles();

  return (
    <Switch>
      <Route exact path={path}>
        <FileManager
          files={files}
          handleFiles={handleFiles}
          handleUrls={handleUrls}
        />
      </Route>
      <Route
        path={`${path}/file/:id`}
        render={(p) => (
          <FileViewPage id={p.match.params.id} files={files ?? []} />
        )}
      />
      <Route path={`${path}/dataset`} component={DataSetView} />
    </Switch>
  );
}

/** Render the dataset as if it were files. */
function DataSetView() {
  const { path } = useRouteMatch();
  const dataset = use(DataSetContext);
  const files = useMemo(() => datasetToFiles(dataset), [dataset]);
  return (
    <Switch>
      <Route exact path={path}>
        <StandardPage>
          <FilesTable files={files} />
        </StandardPage>
      </Route>
      <Route
        path={`${path}/file/:id`}
        render={(p) => <FileViewPage id={p.match.params.id} files={files} />}
      />
    </Switch>
  );
}

export function FileViewPage({
  id,
  files,
}: {
  id: string;
  files: FileWithDetails[];
}) {
  const selectedFiles = useMemo(
    () => (id === 'all' ? files : files?.filter((f) => f.id === id)) ?? [],
    [files, id]
  );
  const { path, url } = useRouteMatch();

  const singleFile = id !== 'all' ? selectedFiles[0] : undefined;

  const fileTools = useMemo(() => {
    if (!singleFile) {
      return undefined;
    }
    return getTools(singleFile);
  }, [singleFile]);

  if (selectedFiles.length === 0) {
    return <div>No matching files</div>;
  }

  return (
    <Switch>
      <Route exact path={path}>
        <StandardPage>
          <PageTitle>
            {singleFile ? getFilename(singleFile) : 'All Files'}
          </PageTitle>
          <div>
            {singleFile != null ? (
              <>
                <p>
                  View: <Link to={`${url}/view/json`}>JSON</Link>{' '}
                  <Link to={`${url}/view/mp4`}>MP4</Link>{' '}
                </p>
              </>
            ) : (
              <p>{selectedFiles.length} files</p>
            )}
            <p>
              Features: <CommonToolLinks url={`${url}/tool/anything`} />
              <Link to={`${url}/tool/anything/features/dataset`}>
                Load Dataset
              </Link>
            </p>
          </div>
          {!singleFile && (
            <p>
              Apply tool:{' '}
              {Object.keys(tools).map((tool) => (
                <>
                  <Link to={`${url}/tool/${tool}/status`}>{tool}</Link>{' '}
                </>
              ))}
            </p>
          )}
          {fileTools && (
            <Table>
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {fileTools.map((t) => (
                  <tr key={t.tool.name}>
                    <td>
                      <Link to={`${url}/tool/${t.tool.name}/status`}>
                        {t.tool.name}
                      </Link>
                    </td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {singleFile != null && (
            <>
              <p>
                Size:{' '}
                {singleFile.type === 'handle' || singleFile.type === 'contents'
                  ? singleFile.file.size.toLocaleString()
                  : 'N/A'}
              </p>
              {singleFile.type === 'handle' && (
                <p>
                  Last Modified:{' '}
                  {new Date(singleFile.file.lastModified).toLocaleString()}
                </p>
              )}
              {singleFile.type === 'url' && <p>URL: {singleFile.url}</p>}
            </>
          )}
          <div>
            <p>
              <strong>Map:</strong> Show a map with tiles rendered in a worker.
            </p>
            <p>
              <strong>Features:</strong> Show a list of features,.
            </p>
            <p>
              <strong>Leaflet Map:</strong> Show a map using simple Leaflet
              GoeJSON rendering.
            </p>
            <p>
              <strong>Stylized Map:</strong> Show a map in the everywhere.bike
              style.
            </p>
          </div>
        </StandardPage>
      </Route>
      {singleFile
        ? [
            <Route
              path={`${path}/view/mp4`}
              render={() => (
                <StandardPage>
                  <Mp4View file={singleFile} />
                </StandardPage>
              )}
            />,
            <Route
              path={`${path}/view/json`}
              render={() => (
                <StandardPage>
                  <JsonView file={singleFile} />
                </StandardPage>
              )}
            />,
          ]
        : []}
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
