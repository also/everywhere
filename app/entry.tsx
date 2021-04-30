import d3 from 'd3';
import createReactClass from 'create-react-class';
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
  tripsPromise,
  videos,
  wayTree,
} from './data';
import DataContext from './components/DataContext';
import { CoverageFeature, TripFeature, TripTree } from './trips';
import { CoverageTree } from './videos';

const GlobalStyle = createGlobalStyle`
body {
  font-family: 'helvetica neue';
  font-size: 13px;
  margin: 0;
  padding: 0;
  color: #444;
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

const Content = styled.div`
  padding: 3em;
`;

const Footer = styled.footer`
  margin: 1em;
  text-align: center;
  font-size: 0.8em;
  color: #cecece;
`;

document.title = 'not quite everywhere';

const waysLength = d3.sum(
  geoLines(ways),
  // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
  geometryLength
);

const App = createReactClass({
  render() {
    return (
      <div>
        <Header>
          <div>
            <HeaderLink to="/" style={{ color: '#E05338' }}>
              Everywhere
            </HeaderLink>{' '}
            <HeaderLink to="/trips">Trips</HeaderLink>{' '}
            <HeaderLink to="/videos">Videos</HeaderLink>{' '}
            <HeaderLink to="/ways">Streets</HeaderLink>
          </div>
        </Header>
        <Content>{this.props.children}</Content>

        <Footer>
          <p>Map data © OpenStreetMap contributors</p>
        </Footer>
      </div>
    );
  },
});

function CityMapRoute({ trips }: { trips: TripFeature[] }) {
  // TODO what's the right way to pass this in?
  const tripsLength = d3.sum(
    trips.map(geoLines).reduce((a, b) => a.concat(b)),
    // @ts-expect-error the d3.sum type is wrong. d3.sum ignores null
    geometryLength
  );
  return (
    <CityMap trips={trips} tripsLength={tripsLength} waysLength={waysLength} />
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
  return <VideoDetails video={videos.get(params.name)} seek={params.seek} />;
}

function LocationDetailsRoute({
  tripTree,
  videoTree,
  match: {
    params: { coords },
  },
}: RouteComponentProps<{ coords: string }> & {
  tripTree: TripTree;
  videoTree: CoverageTree;
}) {
  return (
    <LocationDetails
      location={coords.split(',').map(parseFloat)}
      tripTree={tripTree}
      videoTree={videoTree}
    />
  );
}

const div = document.createElement('div');
document.body.appendChild(div);

tripsPromise.then(({ trips, videoCoverage, tripTree, videoTree }) => {
  ReactDOM.render(
    <>
      <GlobalStyle />
      <DataContext.Provider value={{ boundary, contours, ways }}>
        <Router>
          <App>
            <Switch>
              <Route path="/ways/*" component={WayDetailsRoute} />
              <Route path="/ways" component={WayListRoute} />
              <Route path="/videos/:name/:seek" component={VideoDetailsRoute} />
              <Route path="/videos/:name" component={VideoDetailsRoute} />
              <Route
                path="/videos"
                render={() => (
                  <VideoListPage
                    videos={Array.from(videos.values())}
                    videoCoverage={videoCoverage}
                    videoTree={videoTree}
                  />
                )}
              />
              <Route
                path="/trips/:id"
                render={({ match }) => (
                  <TripDetails
                    trip={
                      trips.filter(({ id }) => `${id}` === match.params.id)[0]
                    }
                  />
                )}
              />
              <Route
                path="/trips"
                render={() => <TripListPage trips={trips} />}
              />
              <Route
                path="/locations/:coords"
                render={props => (
                  <LocationDetailsRoute
                    {...props}
                    tripTree={tripTree}
                    videoTree={videoTree}
                  />
                )}
              />
              <Route path="/">
                <CityMapRoute trips={trips} />
              </Route>
            </Switch>
          </App>
        </Router>
      </DataContext.Provider>
    </>,
    div
  );
});
