import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  ReactElement,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DataSet } from '@/data';

const linkClassName = 'text-primary underline-offset-4 hover:underline';

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
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>File ID</TableHead>
            <TableHead>Filename</TableHead>
            <TableHead>Tool</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((f, i) => (
            <TableRow key={i}>
              <TableCell>
                <Link
                  to={`${featuresUrl}/feature/${f.properties?.everywhereFeatureIndex}`}
                  className={linkClassName}
                >
                  {i}
                </Link>
              </TableCell>
              <TableCell>
                {f.properties?.everywhereFileId ?? 'unknown'}
              </TableCell>
              <TableCell>
                {f.properties?.everywhereFilename ?? 'unknown'}
              </TableCell>
              <TableCell>{f.properties?.everywhereTool ?? 'unknown'}</TableCell>
              <TableCell>{f.geometry.type}</TableCell>
              <TableCell>
                <FeatureDetails feature={f} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
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
      <PageTitle>Feature Details</PageTitle>
      <FeatureDetails feature={feature} />
      {feature?.properties && (
        <ObjectInspector data={feature.properties} expandPaths={['$']} />
      )}
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

function CommonToolLinks({
  url,
  separator,
}: {
  url: string;
  separator?: React.ReactNode;
}) {
  return (
    <Separated separator={separator ?? null}>
      <Link to={`${url}/map`}>Map</Link>
      <Link to={`${url}/features/list`}>Features</Link>
      <Link to={`${url}/features/map`}>Leaflet Map</Link>
      <Link to={`${url}/features/stylized`}>Stylized Map</Link>
    </Separated>
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
        <div className="flex gap-2">
          <CommonToolLinks url={url} /> <Link to={`${url}/status`}>Status</Link>{' '}
          {NavComponent}
        </div>
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
  const currentDataSet = use(DataSetContext);
  const setDataSet = use(DataSetProviderContext);

  return dataset ? (
    <>
      <DataSetSummaryCard dataset={dataset} />
      {currentDataSet !== dataset ? (
        <Button onClick={() => setDataSet(dataset)}>Set Dataset</Button>
      ) : null}
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
      incomingNewfiles: FileWithHandle[],
      existingFiles: FileWithDetails[] = []
    ) {
      let maxId: number;
      await update('maxId', (current = 0) => {
        maxId = current + incomingNewfiles.length;
        return maxId;
      });
      const newFiles: FileHandleWithDetails[] = await Promise.all(
        incomingNewfiles.map(
          async (file, i) =>
            ({
              id: `${maxId + i + 1}`,
              type: 'handle',
              file,
            }) as const
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

const columns: ColumnDef<FileWithDetails>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected() ||
          (table.getIsSomeRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    header: 'ID',
    accessorKey: 'id',
  },
  {
    header: 'Name',
    accessorFn: (f) => getFilename(f),
    cell: ({ row: { original: f } }) => {
      const { url } = useRouteMatch();
      return (
        <Link to={`${url}/file/${f.id}`} className={linkClassName}>
          {getFilename(f)}
        </Link>
      );
    },
  },
  {
    header: 'Size',
    accessorFn: (f) =>
      f.type === 'handle' || f.type === 'contents'
        ? f.file.size.toLocaleString()
        : 'N/A',
  },
  {
    header: 'Last Modified',
    accessorFn: (f) =>
      f.type === 'handle'
        ? new Date(f.file.lastModified).toLocaleString()
        : f.type === 'url'
          ? 'N/A'
          : '',
  },
];

function FilesTable({
  files,
  handleFiles,
}: {
  files: FileWithDetails[];
  handleFiles?: HandleFiles;
}) {
  const { url } = useRouteMatch();

  // tanstack table doesn't do row pruning, so we have to do it manually
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const validIds = useMemo(() => new Set(files.map((f) => f.id)), [files]);
  const prunedRowSelection = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(rowSelection).filter(([id]) => validIds.has(id))
      ),
    [rowSelection, validIds]
  );

  const table = useReactTable({
    data: files,
    columns,
    state: { rowSelection: prunedRowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  const rowCount = table.getRowCount();

  const allRowsSelected = table.getIsAllRowsSelected();

  const selected = allRowsSelected
    ? ['all']
    : table.getIsSomeRowsSelected()
      ? table.getSelectedRowModel().rows.map((row) => row.original.id)
      : undefined;

  const handleRemoveSelected = useCallback(() => {
    handleFiles?.(
      [],
      table
        .getCoreRowModel()
        .rows.filter((r) => !r.getIsSelected())
        .map((row) => row.original)
    );
  }, [handleFiles, table]);
  return (
    <div>
      <div className="flex gap-2">
        {selected ? (
          <>
            <Button asChild>
              <Link to={`${url}/file/${selected.join(',')}`}>Open</Link>
            </Button>
            {handleFiles ? (
              <Button onClick={handleRemoveSelected}>Remove</Button>
            ) : null}
          </>
        ) : (
          <>
            <Button disabled>Open</Button>
            {handleFiles ? <Button disabled>Remove</Button> : null}
          </>
        )}
        <span className="text-sm text-muted-foreground">
          {rowCount} files,{' '}
          {allRowsSelected ? rowCount : (selected?.length ?? 0)} selected
        </span>
      </div>
      <DataTable table={table} />
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
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
  const { url } = useRouteMatch();

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

      <div className="flex gap-6">
        <div className="flex-1">
          <FilesTable files={files ?? []} handleFiles={handleFiles} />
        </div>
        <div className="w-80 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add files</CardTitle>
              <CardDescription>Add files to the collection.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleAddClick}>add</Button>
              <Separator className="my-4" />
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="Enter URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full"
                />
                <Button onClick={handleAddUrlClick}>add url</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dataset</CardTitle>
              <CardDescription>
                The dataset is the trips and videos shown on the site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={`${url}/dataset`}>Open dataset as files</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
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

function DataSetSummaryCard({ dataset }: { dataset: DataSet }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {dataset.isDefault ? (
            <Badge variant="outline">Default dataset</Badge>
          ) : (
            <Badge variant="outline">Custom dataset</Badge>
          )}
        </div>
        <dl className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground text-sm">Trips</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {dataset.trips.length}
            </dd>
          </div>

          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="text-muted-foreground text-sm">Videos</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {dataset.videos.size}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <dt className="text-muted-foreground text-sm">Distance</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {Math.round(dataset.tripsLength / 1000).toLocaleString()} km
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Render the dataset as if it were files. */
function DataSetView() {
  const { path } = useRouteMatch();
  const dataset = use(DataSetContext);
  const { trips } = dataset;

  const files = useMemo(() => datasetToFiles(dataset), [dataset]);
  return (
    <Switch>
      <Route exact path={path}>
        <StandardPage>
          <PageTitle>Dataset</PageTitle>
          <div className="flex gap-6">
            <div className="flex-1">
              <FilesTable files={files} />
            </div>
            <div className="w-80 space-y-4">
              <DataSetSummaryCard dataset={dataset} />
            </div>
          </div>
        </StandardPage>
      </Route>
      <Route
        path={`${path}/file/:id`}
        render={(p) => <FileViewPage id={p.match.params.id} files={files} />}
      />
    </Switch>
  );
}

// by default, Separator has h-full which doesn't work with a container without an explicit height or something
// we need this specific class name so the precendence is as high as the existing one
// TODO make a variant in Separator?
const verticalFlexySeparator = (
  <Separator
    orientation="vertical"
    className="data-[orientation=vertical]:h-auto"
  />
);

function Separated({
  children,
  separator,
}: {
  children: React.ReactNode;
  separator: React.ReactNode;
}) {
  const kids = Children.toArray(children);
  const sepIsElement = isValidElement(separator);
  const makeSeparator = (key: string) =>
    sepIsElement ? (
      cloneElement(separator as ReactElement, { key })
    ) : (
      <Fragment key={key}>{separator}</Fragment>
    );

  return kids.flatMap((child, i) => {
    const parts: React.ReactNode[] = [];
    if (i > 0) {
      parts.push(makeSeparator(`sep-${i}`));
    }
    // Preserve the original child and its key without wrapping
    parts.push(child);
    return parts;
  });
}

export function FileViewPage({
  id,
  files,
}: {
  id: string;
  files: FileWithDetails[];
}) {
  const ids = new Set(id.split(','));
  const selectedFiles = useMemo(
    () => (id === 'all' ? files : files?.filter((f) => ids.has(f.id))) ?? [],
    [files, id]
  );
  const { path, url } = useRouteMatch();

  const singleFile =
    id !== 'all' && ids.size === 1 ? selectedFiles[0] : undefined;

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
            {singleFile
              ? getFilename(singleFile)
              : `${selectedFiles.length} Files`}
          </PageTitle>
          <div>
            {singleFile != null ? (
              <div className="flex gap-2">
                View: <Link to={`${url}/view/json`}>JSON</Link>
                {verticalFlexySeparator}
                <Link to={`${url}/view/mp4`}>MP4</Link>
              </div>
            ) : (
              <p>{selectedFiles.length} files</p>
            )}
            <div className="flex gap-2">
              Features:{' '}
              <CommonToolLinks
                url={`${url}/tool/anything`}
                separator={verticalFlexySeparator}
              />
              {verticalFlexySeparator}
              <Link to={`${url}/tool/anything/features/dataset`}>
                Load Dataset
              </Link>
            </div>
          </div>
          {!singleFile && (
            <div className="flex gap-2">
              Apply tool:{' '}
              <Separated separator={verticalFlexySeparator}>
                {Object.keys(tools).map((tool) => (
                  <Link key={tool} to={`${url}/tool/${tool}/status`}>
                    {tool}
                  </Link>
                ))}
              </Separated>
            </div>
          )}
          {fileTools && (
            <Table className="max-w-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileTools.map((t) => (
                  <TableRow key={t.tool.name}>
                    <TableCell>
                      <Link
                        to={`${url}/tool/${t.tool.name}/status`}
                        className={linkClassName}
                      >
                        {t.tool.name}
                      </Link>
                    </TableCell>
                    <TableCell>{t.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
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
              GeoJSON rendering.
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
