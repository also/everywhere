import d3 from 'd3';
import geojsonLength from 'geojson-length';
import * as React from 'react';
import find from 'lodash/collection/find';

import {Router, Route} from 'react-router';
import HashHistory from 'react-router/lib/HashHistory';

import CityMap from './components/CityMap';

import WayList from './components/WayList';
import WayDetails from './components/WayDetails';

import VideoList from './components/VideoList';
import VideoDetails from './components/VideoDetails';

import '!style!css!sass!./style.scss';
import '!style!css!react-select/dist/default.css';

import {ways, groupedWays, boundary, contours, trips, videos} from './data';


document.title = 'not quite everywhere';

function center(a, b) {
  return (a + b) / 2;
}

function geoLines(geoJson) {
  return geoJson.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString');
}

const width = 1000,
    height = 1000;

const bounds = d3.geo.bounds(boundary);

const highwayLength = d3.sum(geoLines(ways), geojsonLength);
const tripsLength = d3.sum(trips.map(geoLines).reduce((a, b) => a.concat(b)), geojsonLength);

const projection = d3.geo.mercator()
    .center([center(bounds[0][0], bounds[1][0]), center(bounds[0][1], bounds[1][1])])
    .scale(900000)
    .translate([width / 2, height / 2]);

const path = d3.geo.path()
    .projection(projection);

const App = React.createClass({
  render() {
    return (
      <div>
        {this.props.children}

        <p>Map data © OpenStreetMap contributors</p>
      </div>
    );
  }
});

const CityMapRoute = React.createClass({
  render() {
    return <CityMap width={width} height={height}
      ways={ways} groupedWays={groupedWays} contours={contours} trips={trips} boundary={boundary}
      path={path} projection={projection}
      tripsLength={tripsLength} highwayLength={highwayLength}
      />;
  }
});

const WayListRoute = React.createClass({
  render() {
    return (
      <WayList ways={groupedWays}/>
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
    return <VideoList videos={videos}/>;
  }
});

const VideoDetailsRoute = React.createClass({
  render() {
    const {params} = this.props;
    return <VideoDetails video={videos.get(params.name)}/>;
  }
});

const div = document.createElement('div');
document.body.appendChild(div);

const history = new HashHistory();

function render() {
  React.render((
    <Router history={history}>
      <Route component={App}>
        <Route path="/" component={CityMapRoute}/>
        <Route path="/ways" component={WayListRoute}/>
        <Route path="/ways/:name" component={WayDetailsRoute}/>
        <Route path="/videos" component={VideoListRoute}/>
        <Route path="/videos/:name" component={VideoDetailsRoute}/>
      </Route>
    </Router>
  ), div);
}

render();
