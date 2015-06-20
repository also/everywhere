import d3 from 'd3';
import geojsonLength from 'geojson-length';
import * as React from 'react';

import StreetInfo from './street-info';
import Position from './position';
import Trips from './trips';
import Contours from './contours';

import '!style!css!sass!./style.scss';
import '!style!css!react-select/dist/default.css';

import {ways, boundary, contours, trips} from './data';


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

const Road = React.createClass({
  render() {
    const {feature, path} = this.props;
    const {highway, name, id} = feature.properties;
    const className = name && name === selectedStreetName ? 'selected' : '';
    return <path d={path(feature)} data-highway={highway} className={className} key={id}/>;
  }
});

const Roads = React.createClass({
  render() {
    const {features, path} = this.props;
    return (
      <g className="roads">
        {features.map(feature => <Road feature={feature} path={path}/>)}
      </g>
    );
  }
});


const div = document.createElement('div');
document.body.appendChild(div);

function onSelectionChange(selection) {
  console.log(selection);
  selectedStreetName = selection && selection.label;
  render();
}

function render() {
  React.render(
    <div>
      <p>{Math.round(tripsLength / 1000)} / {Math.round(highwayLength / 1000)} km</p>

      <StreetInfo features={ways.features} onSelectionChange={onSelectionChange}/>
      <svg width={width} height={height}>
        <defs>
          <mask id="boundary-mask">
            <path d={cityBoundaryPath}/>
          </mask>
        </defs>

        <path className="boundary" d={cityBoundaryPath}/>
        <Contours features={contours.features} path={path}/>
        <Roads features={ways.features} path={path}/>
        <Trips trips={trips} path={path}/>
        <Position projection={projection}/>
      </svg>
      <p>Map data © OpenStreetMap contributors</p>
    </div>
  , div);
}

render();
