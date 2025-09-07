import './index.css';
import d3 from 'd3';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';

import {
  HashRouter as Router,
  Switch,
  Route,
  Link,
  RouteComponentProps,
} from 'react-router-dom';

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

function WayListRoute() {
  return <WayList groupedWays={groupedWays} wayTree={wayTree} />;
}

function WayDetailsRoute({ match: { params } }: RouteComponentProps<[string]>) {
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

function VideoDetailsRoute({
  match: { params },
}: RouteComponentProps<{ seek: string; name: string }>) {
  const { videos } = useContext(DataSetContext);
  const video = videos.get(params.name);
  return video ? (
    <VideoDetails video={video} seek={parseInt(params.seek, 10)} />
  ) : (
    <NotFoundRoute />
  );
}

function LocationDetailsRoute({
  match: {
    params: { coords },
  },
}: RouteComponentProps<{ coords: string }>) {
  const { tripTree, videoTree } = useContext(DataSetContext);
  return (
    <LocationDetails
      location={coords.split(',').map(parseFloat)}
      tripTree={tripTree}
      videoTree={videoTree}
    />
  );
}

function TripDetailsRoute({
  match: {
    params: { id },
  },
}: RouteComponentProps<{ id: string }>) {
  const { tripsById } = useContext(DataSetContext);
  const trip = tripsById.get(id);
  return trip ? <TripDetails trip={trip} /> : <NotFoundRoute />;
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

function TripsRoute() {
  const { trips } = useContext(DataSetContext);
  return <TripListPage trips={trips} />;
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

root.render(
  <NavExtensionContext.Provider>
    <DataContext.Provider value={{ boundary, contours, ways }}>
      <DataSetSelector initialDataSet={buildDataSet([], [], true)}>
        {/* @ts-expect-error old react router :( */}
        <Router>
          <App>
            <Switch>
              <Route path="/local" component={DataExplorer} />
              <Route path="/ways/*" component={WayDetailsRoute} />
              <Route path="/ways" component={WayListRoute} />
              <Route path="/videos/:name/:seek" component={VideoDetailsRoute} />
              <Route path="/videos/:name" component={VideoDetailsRoute} />
              <Route path="/videos" component={VideosRoute} />
              <Route path="/trips/:id" component={TripDetailsRoute} />
              <Route path="/trips" component={TripsRoute} />
              <Route
                path="/locations/:coords"
                component={LocationDetailsRoute}
              />
              <Route path="/docs" component={DocsPage} />
              <Route path="/" component={CityMapRoute} />
            </Switch>
          </App>
        </Router>
      </DataSetSelector>
    </DataContext.Provider>
  </NavExtensionContext.Provider>
);
