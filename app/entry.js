import d3 from 'd3';
import topojson from 'topojson';

import geojsonLength from 'geojson-length';

import '!style!css!sass!./style.scss';

document.title = 'not quite everywhere';

const data = require("json!../highways-clipped-topo.geojson");
const somervilleTopojson = require("json!../somerville-topo.geojson");

const bounds = [[-71.1345882, 42.3727247], [-71.0727282, 42.4181407]];

function center(a, b) {
  return (a + b) / 2;
}

const width = 1000,
    height = 1000;

const body = d3.select("body");

const highways = topojson.feature(data, data.objects['highways-clipped']);
const cityBoundary = topojson.feature(somervilleTopojson, somervilleTopojson.objects.somerville);

const highwayLines = highways.features.map(({geometry}) => geometry).filter(({type}) => type === 'LineString' || type === 'MultiLineString'); 

const length = d3.sum(highwayLines, geojsonLength);

body.append('p').text(`${Math.round(length / 1000)} km`);

const svg = body.append("svg")
    .attr("width", width)
    .attr("height", height);

const projection = d3.geo.mercator()
    .center([center(bounds[0][0], bounds[1][0]), center(bounds[0][1], bounds[1][1])])
    .scale(900000)
    .translate([width / 2, height / 2]);

const path = d3.geo.path()
    .projection(projection)

const cityBoundaryPath = path(cityBoundary);

svg.append('defs')
  .append('mask')
    .attr('id', 'boundary-mask')
    .append("path")
  .attr('class', 'boundary-mask')
      .attr("d", cityBoundaryPath)

svg.append("path")
  .attr('class', 'boundary')
      .datum(cityBoundary)
      .attr("d", cityBoundaryPath);

svg.append("path")
  .attr('class', 'roads')
      .datum(highways)
      .attr("d", path);

console.log('hello, world');
