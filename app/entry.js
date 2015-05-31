import d3 from 'd3';
import topojson from 'topojson';

import * as React from 'react';
import Select from 'react-select';

import geojsonLength from 'geojson-length';

import '!style!css!sass!./style.scss';
import '!style!css!react-select/dist/default.css';

import data from 'json!../highways-clipped-topo.geojson';
import somervilleTopojson from 'json!../somerville-topo.geojson';

document.title = 'not quite everywhere';

function center(a, b) {
  return (a + b) / 2;
}

function geoLines(geoJson) {
  return geoJson.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString');
}

function feature(geojson) {
  return topojson.feature(geojson, geojson.objects[Object.keys(geojson.objects)[0]]);
}

const tripContext = require.context('json!../trips');
const trips = tripContext.keys().map(name => feature(tripContext(name)));

const width = 1000,
    height = 1000;

const highways = feature(data);
const cityBoundary = feature(somervilleTopojson);

const bounds = d3.geo.bounds(cityBoundary);

const highwayLength = d3.sum(geoLines(highways), geojsonLength);
const tripsLength = d3.sum(trips.map(geoLines).reduce((a, b) => a.concat(b)), geojsonLength);

const projection = d3.geo.mercator()
    .center([center(bounds[0][0], bounds[1][0]), center(bounds[0][1], bounds[1][1])])
    .scale(900000)
    .translate([width / 2, height / 2]);

const path = d3.geo.path()
    .projection(projection);

const cityBoundaryPath = path(cityBoundary);

const Roads = React.createClass({
  render() {
    const {features, path} = this.props;
    return (
      <g className="roads">
        {features.map(feature => (
          <path d={path(feature)} data-highway={feature.properties.highway} key={feature.properties.id}/>
        ))}
      </g>
    );
  }
});

const Trip = React.createClass({
  render() {
    const {trip, path} = this.props;
    return <path className="trip" d={path(trip)}/>;
  },

  componentDidMount() {
    // react doesn't support mask
    // https://github.com/facebook/react/issues/1657#issuecomment-63209488
    React.findDOMNode(this).mask = 'url(#boundary-mask)';
  }
});

const Trips = React.createClass({
  render() {
    const {trips, path} = this.props;
    return (
      <g>
        {trips.map(trip => <Trip trip={trip} path={path}/>)}
      </g>
    );
  }
});

const StreetList = React.createClass({
  render() {
    const {features} = this.props;

    const options = features.map(({properties: {id, name}}) => ({value: id, label: name || '(no name)'}));
    options.sort(({label: a}, {label: b}) => a === b ? 0 : a > b ? 1 : -1);

    return <Select options={options}/>;
  }
});

const div = document.createElement('div');
document.body.appendChild(div);

React.render(
  <div>
    <p>{Math.round(tripsLength / 1000)} / {Math.round(highwayLength / 1000)} km</p>
    <StreetList features={highways.features}/>
    <svg width={width} height={height}>
      <defs>
        <mask id="boundary-mask">
          <path d={cityBoundaryPath}/>
        </mask>
      </defs>

      <path className="boundary" d={cityBoundaryPath}/>
      <Roads features={highways.features} path={path}/>
      <Trips trips={trips} path={path}/>
    </svg>
    <p>Map data © OpenStreetMap contributors</p>
  </div>
, div);
