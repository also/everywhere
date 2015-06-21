import d3 from 'd3';
import geojsonLength from 'geojson-length';
import * as React from 'react';
import find from 'lodash/collection/find';

import {Router, Route} from 'react-router';
import HashHistory from 'react-router/lib/HashHistory';

import StreetInfo from './street-info';
import Position from './position';
import Trips from './trips';
import Contours from './contours';
import Ways from './ways';
import WayList from './way-list';
import WayDetails from './way-details';

import VideoList from './VideoList';
import VideoDetails from './VideoDetails';

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

const cityBoundaryPath = path(boundary);

let selectedStreetName = null;

const CityMap = React.createClass({
  render() {
    return (
      <div>
        <p>{Math.round(tripsLength / 1000)} / {Math.round(highwayLength / 1000)} km</p>
        <StreetInfo ways={groupedWays} onSelectionChange={onSelectionChange}/>

        <svg width={width} height={height}>
          <defs>
            <mask id="boundary-mask">
              <path d={cityBoundaryPath}/>
            </mask>
          </defs>

          <path className="boundary" d={cityBoundaryPath}/>
          <Contours features={contours.features} path={path}/>
          <Ways features={ways.features} path={path} selectedStreetName={selectedStreetName}/>
          <Trips trips={trips} path={path}/>
          <Position projection={projection}/>
        </svg>
      </div>
    );
  }
});

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

function onSelectionChange(selection) {
  console.log(selection);
  selectedStreetName = selection && selection.label;
  render();
}

const history = new HashHistory();

function render() {
  React.render((
    <Router history={history}>
      <Route component={App}>
        <Route path="/" component={CityMap}/>
        <Route path="/ways" component={WayListRoute}/>
        <Route path="/ways/:name" component={WayDetailsRoute}/>
        <Route path="/videos" component={VideoListRoute}/>
        <Route path="/videos/:name" component={VideoDetailsRoute}/>
      </Route>
    </Router>
  ), div);
}

render();
