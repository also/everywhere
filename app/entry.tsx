import './index.css';
import d3 from 'd3';
import { createRoot } from 'react-dom/client';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

import {
  Outlet,
  RouterProvider,
  Link,
  createRouter,
  createRoute,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { createHashHistory } from '@tanstack/history';

import { geometryLength } from './distance';

import CityMap from './components/pages/CityMap';

import WayList from './components/pages/WayList';
import WayDetails from './components/pages/WayDetails';

import VideoListPage from './components/pages/VideoListPage';
import VideoDetails from './components/pages/VideoDetails';

import TripListPage from './components/pages/TripListPage';
import TripDetails from './components/pages/TripDetails';

import LocationDetails from './components/pages/LocationDetails';

import DocsPage from './components/pages/DocsPage';

import { geoLines } from './geo';

import {
  ways,
  groupedWays,
  boundary,
  contours,
  wayTree,
  DataSet,
} from './data';
import DataContext from './components/DataContext';
import { ReactNode, useContext, useEffect, useState } from 'react';
import DataExplorer from './components/pages/data/DataExplorer';
import DataSetContext, {
  DataSetProviderContext,
} from './components/DataSetContext';
import { loadDataset } from './default-data-set';
import StandardPage from './components/StandardPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { buildDataSet } from './trips';
import PageTitle from './components/PageTitle';
import { NavExtensionContext } from './components/Nav';
import { cn } from './lib/utils';

function HeaderLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn('mr-8 font-bold text-[#444] no-underline', className)}
    >
      {children}
    </Link>
  );
}

document.title = 'not quite everywhere';

const waysLength = d3.sum(
  geoLines(ways),
  // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
  geometryLength
);

function App({
  children,
  pageControl,
}: {
  children: ReactNode;
  pageControl?: ReactNode;
}) {
  let extras = undefined;
  const { setValue: setNavExtensionDiv } = useContext(
    NavExtensionContext.Context
  );
  if (localStorage.getItem('enableExtras') === 'true') {
    extras = (
      <>
        <HeaderLink to="/local">Files</HeaderLink>
        <HeaderLink to="/docs">Docs</HeaderLink>
      </>
    );
  }
  return (
    <>
      <div className="flex h-screen flex-col">
        <header className="flex justify-between border-b border-[#ccc] bg-[#eee] px-8 py-3 text-[1.2em]">
          <div>
            <HeaderLink to="/" className="text-[#E05338]">
              Everywhere
            </HeaderLink>{' '}
            <HeaderLink to="/trips">Trips</HeaderLink>{' '}
            <HeaderLink to="/videos">Videos</HeaderLink>{' '}
            <HeaderLink to="/ways">Streets</HeaderLink> {extras}
          </div>
          <div ref={setNavExtensionDiv} />
        </header>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </>
  );
}

function CityMapRoute() {
  const { trips, tripsLength } = useContext(DataSetContext);

  return (
    <StandardPage>
      <CityMap
        trips={trips}
        tripsLength={tripsLength}
        waysLength={waysLength}
      />
    </StandardPage>
  );
}

function NotFoundRoute() {
  return (
    <StandardPage>
      <PageTitle>Not Found</PageTitle>
    </StandardPage>
  );
}

function DataSetSelector({
  initialDataSet,
  children,
}: {
  initialDataSet: DataSet;
  children: ReactNode;
}) {
  const [dataset, setDataSet] = useState(initialDataSet);
  useEffect(() => {
    datasetPromise.then(setDataSet);
  }, []);
  return (
    <DataSetContext.Provider value={dataset}>
      <DataSetProviderContext.Provider value={setDataSet}>
        {children}
      </DataSetProviderContext.Provider>
    </DataSetContext.Provider>
  );
}

const div = document.createElement('div');
document.body.appendChild(div);
const datasetPromise = loadDataset();

const root = createRoot(div);

// root.render(
//   <>
//     <GlobalStyle />
//     <NavExtensionContext.Provider>
//       <DataContext.Provider value={{ boundary, contours, ways }}>
//         <DataSetSelector initialDataSet={buildDataSet([], [])}>
//           <Router>
//             <App>
//               <Switch>
//                 <Route path="/local">
//                   <LocalDataExplorer />
//                 </Route>
//                 <Route path="/data">
//                   <DataPage />
//                 </Route>
//                 <Route path="/map">
//                   <MapRoute />
//                 </Route>
//                 </Route>
//               </Switch>
//             </App>
//           </Router>
//         </DataSetSelector>
//       </DataContext.Provider>
//     </NavExtensionContext.Provider>
//   </>
// );

function RootComponent() {
  return (
    <>
      <TanStackRouterDevtools />
      <App>
        <Outlet />
      </App>
    </>
  );
}

function IndexComponent() {
  return <CityMapRoute />;
}

const rootRoute = createRootRouteWithContext<{ dataSet: DataSet }>()({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
});

const tripsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'trips',
});

const tripsIndexRoute = createRoute({
  getParentRoute: () => tripsRoute,
  path: '/',
  loader: ({ context: { dataSet } }) => {
    return dataSet.trips;
  },
  component: function TripsRoute(): ReactNode {
    const trips = tripsIndexRoute.useLoaderData();
    return <TripListPage trips={trips} />;
  },
});

const tripDetailsRoute = createRoute({
  getParentRoute: () => tripsRoute,
  path: '$id',
  loader: ({ params: { id }, context: { dataSet } }) => {
    return dataSet.tripsById.get(id);
  },
  component: function TripDetailsRoute(): ReactNode {
    const trip = tripDetailsRoute.useLoaderData();
    return trip ? <TripDetails trip={trip} /> : <NotFoundRoute />;
  },
});

const videosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'videos',
  loader: () => false,
});

const videosIndexRoute = createRoute({
  getParentRoute: () => videosRoute,
  path: '/',
  loader: ({ context: { dataSet } }) => {
    return dataSet;
  },
  component: function VideosIndexRoute(): ReactNode {
    const { videos, videoCoverage, videoTree } =
      videosIndexRoute.useLoaderData();
    return (
      <VideoListPage
        videos={Array.from(videos.values())}
        videoCoverage={videoCoverage}
        videoTree={videoTree}
      />
    );
  },
});

const videosDetailsRootRoute = createRoute({
  getParentRoute: () => videosRoute,
  path: '$name',
  loader: ({ params: { name }, context: { dataSet } }) => {
    return dataSet.videos.get(name);
  },
});

const videosDetailsRoute = createRoute({
  getParentRoute: () => videosDetailsRootRoute,
  path: '/',
  component: function VideosDetailsRoute(): ReactNode {
    const video = videosDetailsRootRoute.useLoaderData();
    return video ? <VideoDetails video={video} seek={0} /> : <NotFoundRoute />;
  },
});

const videosDetailsSeekedRoute = createRoute({
  getParentRoute: () => videosDetailsRootRoute,
  path: '$seek',
  loader: ({ params: { seek } }) => {
    return parseInt(seek, 10);
  },
  component: function VideosDetailsSeekedRoute(): ReactNode {
    const video = videosDetailsRootRoute.useLoaderData();
    const seek = videosDetailsSeekedRoute.useLoaderData();
    return video ? (
      <VideoDetails video={video} seek={seek} />
    ) : (
      <NotFoundRoute />
    );
  },
});

const locationDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'locations/$coords',
  loader: ({ params: { coords }, context: { dataSet } }) => {
    const location = coords.split(',').map(parseFloat);
    return { location, dataSet };
  },
  component: function LocationDetailsRoute() {
    const { location, dataSet } = locationDetailsRoute.useLoaderData();
    return (
      <LocationDetails
        location={location}
        tripTree={dataSet.tripTree}
        videoTree={dataSet.videoTree}
      />
    );
  },
});

const waysRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'ways',
});

const waysIndexRoute = createRoute({
  getParentRoute: () => waysRoute,
  path: '/',
  component: function WaysIndexRoute(): ReactNode {
    return <WayList groupedWays={groupedWays} wayTree={wayTree} />;
  },
});

const wayDetailsRoute = createRoute({
  getParentRoute: () => waysRoute,
  path: '$name',
  loader: ({ params: { name } }) => {
    return groupedWays.find(({ displayName }) => displayName === name);
  },
  component: function WayDetailsRoute(): ReactNode {
    const way = wayDetailsRoute.useLoaderData();
    return way ? <WayDetails way={way} /> : <NotFoundRoute />;
  },
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'docs',
  validateSearch: (search) => {
    return {
      ui: search.ui === true,
      // TODO validate
      focus: (Array.isArray(search.focus)
        ? search.focus
        : search.focus
          ? [search.focus]
          : []) as string[],
      showSimpleTags: search.showSimpleTags === true,
    };
  },
  component: function DocsRoute() {
    return <DocsPage />;
  },
});

const localDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'local',
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  tripsRoute.addChildren([tripsIndexRoute, tripDetailsRoute]),

  videosRoute.addChildren([
    videosIndexRoute,
    videosDetailsRootRoute.addChildren([
      videosDetailsRoute,
      videosDetailsSeekedRoute,
    ]),
  ]),
  locationDetailsRoute,
  waysRoute.addChildren([waysIndexRoute, wayDetailsRoute]),

  docsRoute,
]);

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  history: createHashHistory(),
  context: {
    // FIXME ???
    dataSet: undefined as any,
  },
});

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function RouterWithContext() {
  const dataSet = useContext(DataSetContext);
  // FIXME haven't figured out how to establish that the loaders have a dependency on the dataset from context
  return dataSet.trips.length > 0 ? (
    <RouterProvider router={router} context={{ dataSet }} />
  ) : null;
}

root.render(
  <NavExtensionContext.Provider>
    <DataContext.Provider value={{ boundary, contours, ways }}>
      <DataSetSelector initialDataSet={buildDataSet([], [], true)}>
        <RouterWithContext />
      </DataSetSelector>
    </DataContext.Provider>
  </NavExtensionContext.Provider>
);
