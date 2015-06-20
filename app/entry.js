import d3 from 'd3';
import topojson from 'topojson';

import * as React from 'react';
import Select from 'react-select';

import geojsonLength from 'geojson-length';

import '!style!css!sass!./style.scss';
import '!style!css!react-select/dist/default.css';

import data from 'json!../highways-clipped-topo.geojson';
import somervilleTopojson from 'json!../somerville-topo.geojson';

import contours from 'json!../contour.geojson';

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

const Trip = React.createClass({
  render() {
    const {trip, path} = this.props;
    return <path className="trip" d={path(trip)}/>;
  },

  componentDidMount() {
    // react doesn't support mask
    // https://github.com/facebook/react/issues/1657#issuecomment-63209488
    React.findDOMNode(this).setAttribute('mask', 'url(#boundary-mask)');
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

const Contours = React.createClass({
  render() {
    const {features, path} = this.props;
    return (
      <g>
        {features.map(contour => <path className="contour" d={path(contour)}/>)}
      </g>
      );
  }
}); 

const StreetInfo = React.createClass({
  getInitialState() {
    return {selected: null, selectedOption: null};
  },

  onChange(selected, [selectedOption]) {
    this.setState({selected, selectedOption});
    const {onSelectionChange} = this.props;
    if (onSelectionChange) {
      onSelectionChange(selectedOption);
    }
  },

  render() {
    const {features} = this.props;
    const {selected, selectedOption} = this.state;

    let info = null;

    if (selectedOption != null) {
      const {features} = selectedOption;
      info = <p>{selected}: {features.length} features</p>;
    }

    return (
      <div>
        <StreetList features={features} onChange={this.onChange} selected={selected}/>
        {info}
      </div>
    );
  }
});

const StreetList = React.createClass({
  render() {
    const {features, selected} = this.props;

    const streets = new Map();

    const options = [];

    features.forEach(feature => {
      const {properties: {id, name}} = feature;
      let features = streets.get(name);
      if (!features) {
        features = [];
        streets.set(name, features);
        const label = name || '(no name)';
        options.push({value: label, label, features});
      }
      features.push(id);
    });

    options.sort(({label: a}, {label: b}) => a === b ? 0 : a > b ? 1 : -1);

    return <Select options={options} onChange={this.props.onChange} value={selected}/>;
  }
});

const Position = React.createClass({
  getInitialState() {
    return {position: null};
  },
  componentWillMount() {
    if ('geolocation' in navigator) {
      this.watchId = navigator.geolocation.watchPosition(position => this.setState({position}));
    } else {
      /* geolocation IS NOT available */
    }
  },
  componentWillUnmount() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  },
  render() {
    const {position} = this.state;
    if (position) {
      const {coords: {latitude, longitude}} = position;
      const [x, y] = projection([longitude, latitude]);
      return <circle cx={x} cy={y} r={4} className='position'/>;
    } else {
      return null;
    }
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

      <StreetInfo features={highways.features} onSelectionChange={onSelectionChange}/>
      <svg width={width} height={height}>
        <defs>
          <mask id="boundary-mask">
            <path d={cityBoundaryPath}/>
          </mask>
        </defs>

        <path className="boundary" d={cityBoundaryPath}/>
        <Contours features={contours.features} path={path}/>
        <Roads features={highways.features} path={path}/>
        <Trips trips={trips} path={path}/>
        <Position/>
      </svg>
      <p>Map data © OpenStreetMap contributors</p>
    </div>
  , div);
}

render();
