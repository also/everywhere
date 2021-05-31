import d3 from 'd3';
import * as ReactDOM from 'react-dom';
import styled, { createGlobalStyle } from 'styled-components';

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
import { ReactNode, useContext, useState } from 'react';
import LocalDataExplorer from './components/pages/LocalDataExplorer';
import DataSetContext from './components/DataSetContext';
import { loadDataset } from './default-data-set';
import LeafletMap from './components/LeafletMap';
import DataPage from './components/pages/DataPage';
import { WorkerChannel, workerHandshake } from './WorkerChannel';
import WorkerContext from './components/WorkerContext';
import StandardPage from './components/StandardPage';

const worker = new Worker(new URL('./worker.ts', import.meta.url));

const workerChannel = WorkerChannel.forWorker(worker);
const handshakeResult = workerChannel.sendRequest(workerHandshake, 'ping');

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
`;

const HeaderLink = styled(Link)`
  color: #444;
  text-decoration: none;
  font-weight: bold;
  margin-right: 2em;
`;

const Footer = styled.footer`
  margin: 1em;
  text-align: center;
  font-size: 0.8em;
  color: #cecece;

  & a {
    color: inherit;
  }
`;

document.title = 'not quite everywhere';

const waysLength = d3.sum(
  geoLines(ways),
  // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
  geometryLength
);

function App({ children }: { children: ReactNode }) {
  let extras = undefined;
  if (localStorage.getItem('enableExtras') === 'true') {
    extras = (
      <>
        <HeaderLink to="/map">Map</HeaderLink>{' '}
        <HeaderLink to="/data">Data</HeaderLink>
        <HeaderLink to="/local">Files</HeaderLink>
      </>
    );
  }
  return (
    <div>
      <Header>
        <div>
          <HeaderLink to="/" style={{ color: '#E05338' }}>
            Everywhere
          </HeaderLink>{' '}
          <HeaderLink to="/trips">Trips</HeaderLink>{' '}
          <HeaderLink to="/videos">Videos</HeaderLink>{' '}
          <HeaderLink to="/ways">Streets</HeaderLink> {extras}
        </div>
      </Header>
      {children}

      <Footer>
        <p>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
          contributors
        </p>
      </Footer>
    </div>
  );
}

function CityMapRoute() {
  const { trips } = useContext(DataSetContext);
  // TODO what's the right way to pass this in?
  const tripsLength = d3.sum(
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

function WayDetailsRoute({ match: { params } }: RouteComponentProps<[string]>) {
  const way = groupedWays.find(({ displayName }) => displayName === params[0]);
  return way ? <WayDetails way={way} /> : null;
}

function VideoDetailsRoute({
  match: { params },
}: RouteComponentProps<{ seek: string; name: string }>) {
  const { videos } = useContext(DataSetContext);
  return (
    <VideoDetails
      video={videos.get(params.name)}
      seek={parseInt(params.seek, 10)}
    />
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
  const { trips } = useContext(DataSetContext);
  return <TripDetails trip={trips.filter((t) => `${t.id}` === id)[0]} />;
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
  children: (renderProp: (dataset: DataSet) => void) => JSX.Element;
}) {
  const [dataset, setDataSet] = useState(initialDataSet);
  return (
    <DataSetContext.Provider value={dataset}>
      {children(setDataSet)}
    </DataSetContext.Provider>
  );
}

function MapRoute() {
  const { trips } = useContext(DataSetContext);
  return <LeafletMap features={trips} />;
}

const div = document.createElement('div');
document.body.appendChild(div);

Promise.all([loadDataset(), handshakeResult]).then(([dataset]) => {
  ReactDOM.render(
    <>
      <GlobalStyle />
      <DataContext.Provider value={{ boundary, contours, ways }}>
        <WorkerContext.Provider value={{ worker, channel: workerChannel }}>
          <DataSetSelector initialDataSet={dataset}>
            {(setDataSet) => (
              <Router>
                <App>
                  <Switch>
                    <Route
                      path="/local"
                      render={() => (
                        <LocalDataExplorer setDataSet={setDataSet} />
                      )}
                    />
                    <Route path="/data" component={DataPage} />
                    <Route path="/map" component={MapRoute} />
                    <Route path="/ways/*" component={WayDetailsRoute} />
                    <Route path="/ways" component={WayListRoute} />
                    <Route
                      path="/videos/:name/:seek"
                      component={VideoDetailsRoute}
                    />
                    <Route path="/videos/:name" component={VideoDetailsRoute} />
                    <Route path="/videos" component={VideosRoute} />
                    <Route path="/trips/:id" component={TripDetailsRoute} />
                    <Route path="/trips" component={TripsRoute} />
                    <Route
                      path="/locations/:coords"
                      component={LocationDetailsRoute}
                    />
                    <Route path="/" component={CityMapRoute} />
                  </Switch>
                </App>
              </Router>
            )}
          </DataSetSelector>
        </WorkerContext.Provider>
      </DataContext.Provider>
    </>,
    div
  );
});
