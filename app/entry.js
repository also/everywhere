import d3 from 'd3';
import * as React from 'react';
import find from 'lodash/collection/find';

import {Router, Route, Link} from 'react-router';
import HashHistory from 'react-router/lib/HashHistory';

import {geometryLength} from './distance';

import CityMap from './components/CityMap';
import MapData from './components/MapData';

import WayList from './components/WayList';
import WayDetails from './components/WayDetails';

import VideoListPage from './components/VideoListPage';
import VideoDetails from './components/VideoDetails';

import TripList from './components/TripList';
import TripDetails from './components/TripDetails';

import LocactionDetails from './components/LocationDetails';

import {geoLines} from './geo';

import '!style!css!sass!./style.scss';
import '!style!css!react-select/dist/default.css';

import {ways, groupedWays, boundary, contours, tripsPromise, videos, wayTree} from './data';


document.title = 'not quite everywhere';

const waysLength = d3.sum(geoLines(ways), geometryLength);

const App = React.createClass({
  childContextTypes: {
    boundary: React.PropTypes.any,
    ways: React.PropTypes.any,
    contours: React.PropTypes.any
  },

  getChildContext() {
    return {boundary, ways, contours};
  },

  render() {
    return (
      <div>
        <header>
          <div><Link to="/" style={{color: '#E05338'}}>Everywhere</Link> <Link to="/trips">Trips</Link> <Link to="/videos">Videos</Link> <Link to="/ways">Streets</Link></div>
        </header>
        <div id="content">
          {this.props.children}
        </div>

        <footer>
          <p>Map data © OpenStreetMap contributors</p>
        </footer>
      </div>
    );
  }
});

const CityMapRoute = React.createClass({
  render() {
    // TODO what's the right way to pass this in?
    const {trips} = this.props.route;
    const tripsLength = d3.sum(trips.map(geoLines).reduce((a, b) => a.concat(b)), geometryLength);
    return (
      <CityMap
        trips={trips} groupedWays={groupedWays}
        tripsLength={tripsLength} waysLength={waysLength}/>
    );
  }
});

const WayListRoute = React.createClass({
  render() {
    return (
      <WayList groupedWays={groupedWays} ways={ways} wayTree={wayTree}/>
    );
  }
});

const WayDetailsRoute = React.createClass({
  render() {
    const {params} = this.props;
    const way = find(groupedWays, ({name}) => name === params.name);
    return way ? <WayDetails way={way}/> : null;
  }
});

const VideoListRoute = React.createClass({
  render() {
    const {videoCoverage} = this.props.route;
    return <VideoListPage videos={Array.from(videos.values())} videoCoverage={videoCoverage}/>;
  }
});

const VideoDetailsRoute = React.createClass({
  render() {
    const {params} = this.props;
    return <VideoDetails video={videos.get(params.name)}/>;
  }
});

const TripListRoute = React.createClass({
  render() {
    // TODO what's the right way to pass this in?
    const {trips} = this.props.route;
    return <TripList trips={trips} videoThumbnail={true}/>;
  }
});

const TripDetailsRoute = React.createClass({
  render() {
    // TODO what's the right way to pass this in?
    const {trips} = this.props.route;
    return <TripDetails trip={trips.filter(({features: [{id}]}) => `${id}` === this.props.params.id)[0]}/>;
  }
});

const LocationDetailsRoute = React.createClass({
  render() {
    const {params: {coords}} = this.props;
    return <LocactionDetails location={coords.split(',').map(parseFloat)}/>;
  }
});

const div = document.createElement('div');
document.body.appendChild(div);

const history = new HashHistory();

tripsPromise.then(({trips, videoCoverage}) => {
  React.render(
    <MapData {...{boundary, contours, ways}}>{() => (
      <Router history={history}>
        <Route component={App}>
          <Route path="/" component={CityMapRoute} trips={trips}/>
          <Route path="/ways" component={WayListRoute}/>
          <Route path="/ways/:name" component={WayDetailsRoute}/>
          <Route path="/videos" component={VideoListRoute} videoCoverage={videoCoverage}/>
          <Route path="/videos/:name" component={VideoDetailsRoute}/>
          <Route path="/trips" component={TripListRoute} trips={trips}/>
          <Route path="/trips/:id" component={TripDetailsRoute} trips={trips}/>
          <Route path="/locations/:coords" component={LocationDetailsRoute}/>
        </Route>
      </Router>
    )}</MapData>
  , div);
});
