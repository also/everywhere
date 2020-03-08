import d3 from 'd3';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import find from 'lodash/collection/find';

// import { Router, Route, Link } from 'react-router';
// import HashHistory from 'react-router/lib/HashHistory';

import { HashRouter as Router, Switch, Route, Link } from 'react-router-dom';

import { geometryLength } from './distance';

import CityMap from './components/pages/CityMap';
import MapData from './components/MapData';

import WayList from './components/pages/WayList';
import WayDetails from './components/pages/WayDetails';

import VideoListPage from './components/pages/VideoListPage';
import VideoDetails from './components/pages/VideoDetails';

import TripListPage from './components/pages/TripListPage';
import TripDetails from './components/pages/TripDetails';

import LocationDetails from './components/pages/LocationDetails';

import { geoLines } from './geo';

import 'style!css!./style.scss';

import {
  ways,
  groupedWays,
  boundary,
  contours,
  tripsPromise,
  videos,
  wayTree,
} from './data';

document.title = 'not quite everywhere';

const waysLength = d3.sum(geoLines(ways), geometryLength);

const App = createReactClass({
  childContextTypes: {
    boundary: PropTypes.any,
    ways: PropTypes.any,
    contours: PropTypes.any,
  },

  getChildContext() {
    return { boundary, ways, contours };
  },

  render() {
    return (
      <div>
        <header>
          <div>
            <Link to="/" style={{ color: '#E05338' }}>
              Everywhere
            </Link>{' '}
            <Link to="/trips">Trips</Link> <Link to="/videos">Videos</Link>{' '}
            <Link to="/ways">Streets</Link>
          </div>
        </header>
        <div id="content">{this.props.children}</div>

        <footer>
          <p>Map data © OpenStreetMap contributors</p>
        </footer>
      </div>
    );
  },
});

const CityMapRoute = createReactClass({
  render() {
    // TODO what's the right way to pass this in?
    const { trips } = this.props;
    const tripsLength = d3.sum(
      trips.map(geoLines).reduce((a, b) => a.concat(b)),
      geometryLength
    );
    return (
      <CityMap
        trips={trips}
        groupedWays={groupedWays}
        tripsLength={tripsLength}
        waysLength={waysLength}
      />
    );
  },
});

const WayListRoute = createReactClass({
  render() {
    return <WayList groupedWays={groupedWays} ways={ways} wayTree={wayTree} />;
  },
});

const WayDetailsRoute = createReactClass({
  render() {
    const { params } = this.props.match;
    const way = find(
      groupedWays,
      ({ displayName }) => displayName === params[0]
    );
    return way ? <WayDetails way={way} /> : null;
  },
});

const VideoDetailsRoute = createReactClass({
  render() {
    console.log(this.props);
    const { params } = this.props.match;
    return <VideoDetails video={videos.get(params.name)} seek={params.seek} />;
  },
});

const LocationDetailsRoute = createReactClass({
  render() {
    const {
      tripTree,
      videoTree,
      match: {
        params: { coords },
      },
    } = this.props;
    return (
      <LocationDetails
        location={coords.split(',').map(parseFloat)}
        tripTree={tripTree}
        videoTree={videoTree}
      />
    );
  },
});

const div = document.createElement('div');
document.body.appendChild(div);

tripsPromise.then(({ trips, videoCoverage, tripTree, videoTree }) => {
  ReactDOM.render(
    <MapData {...{ boundary, contours, ways }}>
      {() => (
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
                trips={trips}
              />
              <Route
                path="/trips"
                render={() => <TripListPage trips={trips} />}
              />
              <Route
                path="/locations/:coords"
                render={({ match }) => (
                  <LocationDetailsRoute
                    tripTree={tripTree}
                    videoTree={videoTree}
                    match={match}
                  />
                )}
              />
              <Route path="/">
                <CityMapRoute trips={trips} />
              </Route>
            </Switch>
          </App>
        </Router>
      )}
    </MapData>,
    div
  );
});
