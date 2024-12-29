import d3 from 'd3';
import { createRoot } from 'react-dom/client';
import styled, { createGlobalStyle } from 'styled-components';
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
import LocalDataExplorer from './components/pages/LocalDataExplorer';
import DataSetContext, {
  DataSetProviderContext,
} from './components/DataSetContext';
import { loadDataset } from './default-data-set';
import { LeafletFeatureMap } from './components/LeafletMap';
import DataPage from './components/pages/DataPage';
import StandardPage from './components/StandardPage';
import FullScreenPage from './components/FullScreenPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { buildDataSet } from './trips';
import PageTitle from './components/PageTitle';
import { NavExtensionContext } from './components/Nav';

const GlobalStyle = createGlobalStyle`
body {
  font-family: 'helvetica neue';
  font-size: 13px;
  margin: 0;
  padding: 0;
  color: #444;
}

table {
  font-size: inherit;
}

a {
    color: #116aa9;
    // https://crbug.com/439820
    outline: none;
  }
`;

const Header = styled.header`
  background-color: #eee;
  border-bottom: 1px solid #ccc;

  padding: 1em 2em;

  font-size: 1.2em;

  display: flex;
  justify-content: space-between;
`;

const HeaderLink = styled(Link)`
  color: #444;
  text-decoration: none;
  font-weight: bold;
  margin-right: 2em;
`;

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
`;

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
        <HeaderLink to="/map">Map</HeaderLink>{' '}
        <HeaderLink to="/data">Data</HeaderLink>
        <HeaderLink to="/local">Files</HeaderLink>
        <HeaderLink to="/docs">Docs</HeaderLink>
      </>
    );
  }
  return (
    <>
      <Layout>
        <Header>
          <div>
            <HeaderLink to="/" style={{ color: '#E05338' }}>
              Everywhere
            </HeaderLink>{' '}
            <HeaderLink to="/trips">Trips</HeaderLink>{' '}
            <HeaderLink to="/videos">Videos</HeaderLink>{' '}
            <HeaderLink to="/ways">Streets</HeaderLink> {extras}
          </div>
          <div ref={setNavExtensionDiv} />
        </Header>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Layout>
    </>
  );
}

function CityMapRoute() {
  const { trips } = useContext(DataSetContext);
  const tripsLength =
    trips.length === 0
      ? 0
      : d3.sum(
          trips.map(geoLines).reduce((a, b) => a.concat(b)),
          // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
          geometryLength
        );
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

function WayListRoute() {
  return <WayList groupedWays={groupedWays} wayTree={wayTree} />;
}

function WayDetailsRoute() {
  const params = useParams<[string]>();
  const way = groupedWays.find(({ displayName }) => displayName === params[0]);
  return way ? <WayDetails way={way} /> : null;
}

function NotFoundRoute() {
  return (
    <StandardPage>
      <PageTitle>Not Found</PageTitle>
    </StandardPage>
  );
}

function VideoDetailsRoute() {
  const params = useParams<{ seek: string; name: string }>();
  const { videos } = useContext(DataSetContext);
  const video = videos.get(params.name);
  return video ? (
    <VideoDetails video={video} seek={parseInt(params.seek, 10)} />
  ) : (
    <NotFoundRoute />
  );
}

function LocationDetailsRoute() {
  const { coords } = useParams<{ coords: string }>();
  const { tripTree, videoTree } = useContext(DataSetContext);
  return (
    <LocationDetails
      location={coords.split(',').map(parseFloat)}
      tripTree={tripTree}
      videoTree={videoTree}
    />
  );
}

function VideosRoute() {
  const { videos, videoCoverage, videoTree } = useContext(DataSetContext);
  return (
    <VideoListPage
      videos={Array.from(videos.values())}
      videoCoverage={videoCoverage}
      videoTree={videoTree}
    />
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

function MapRoute() {
  const { trips } = useContext(DataSetContext);
  return (
    <FullScreenPage>
      <LeafletFeatureMap features={trips} />
    </FullScreenPage>
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
//                 <Route path="/ways/*">
//                   <WayDetailsRoute />
//                 </Route>
//                 <Route path="/ways">
//                   <WayListRoute />
//                 </Route>
//                 <Route path="/locations/:coords">
//                   <LocationDetailsRoute />
//                 </Route>
//                 <Route path="/docs">
//                   <DocsPage />
//                 </Route>
//                 <Route path="/">
//                   <CityMapRoute />
//                 </Route>
//               </Switch>
//             </App>
//           </Router>
//         </DataSetSelector>
//       </DataContext.Provider>
//     </NavExtensionContext.Provider>
//   </>
// );

const rootRoute = createRootRouteWithContext<{ dataSet: DataSet }>()({
  component: function RootRoute() {
    return (
      <>
        <TanStackRouterDevtools />
        <App>
          <Outlet />
        </App>
      </>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return <CityMapRoute />;
  },
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
  component: function TripsRoute() {
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
  component: function TripDetailsRoute() {
    const trip = tripDetailsRoute.useLoaderData();
    return trip ? <TripDetails trip={trip} /> : <NotFoundRoute />;
  },
});

tripsRoute.addChildren([tripsIndexRoute, tripDetailsRoute]);

const videosRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'videos',
});

const videosIndexRoute = createRoute({
  getParentRoute: () => videosRoute,
  path: '/',
  loader: ({ context: { dataSet } }) => {
    return dataSet;
  },
  component: function VideosIndexRoute() {
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
  component: function VideosDetailsRoute() {
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
  component: function VideosDetailsSeekedRoute() {
    const video = videosDetailsRootRoute.useLoaderData();
    const seek = videosDetailsSeekedRoute.useLoaderData();
    return video ? (
      <VideoDetails video={video} seek={seek} />
    ) : (
      <NotFoundRoute />
    );
  },
});

videosDetailsRootRoute.addChildren([
  videosDetailsRoute,
  videosDetailsSeekedRoute,
]);

videosRoute.addChildren([videosIndexRoute, videosDetailsRootRoute]);

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  tripsRoute,
  videosRoute,
  locationDetailsRoute,
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
  <>
    <GlobalStyle />
    <NavExtensionContext.Provider>
      <DataContext.Provider value={{ boundary, contours, ways }}>
        <DataSetSelector initialDataSet={buildDataSet([], [])}>
          <RouterWithContext />
        </DataSetSelector>
      </DataContext.Provider>
    </NavExtensionContext.Provider>
  </>
);
