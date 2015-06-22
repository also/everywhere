import * as React from 'react';
import d3 from 'd3';

import Contours from './Contours';
import Ways from './Ways';



function center(a, b) {
  return (a + b) / 2;
}


export default React.createClass({
  contextTypes: {
    boundary: React.PropTypes.any.isRequired,
    ways: React.PropTypes.any,
    contours: React.PropTypes.any
  },

  childContextTypes: {
    projection: React.PropTypes.any.isRequired,
    path: React.PropTypes.any.isRequired
  },

  getChildContext() {
    // FIXME context from state in react 0.13 is :(
    const {projection, path} = this.state;
    return {projection, path};
  },

  getInitialState() {
    // FIXME props in getInitialState
    const {width, height} = this.props;
    const {boundary} = this.context;

    const bounds = d3.geo.bounds(boundary);

    const projection = d3.geo.mercator()
        .center([center(bounds[0][0], bounds[1][0]), center(bounds[0][1], bounds[1][1])])
        .scale(900000)
        .translate([width / 2, height / 2]);

    const path = d3.geo.path()
        .projection(projection);

    return {path, projection};
  },

  render() {
    const {boundary, ways, contours} = this.context;
    const {width, height, selectedStreetName} = this.props;
    const {path} = this.state;
    const cityBoundaryPath = path(boundary);

    return (
      <svg width={width} height={height}>
        <defs>
          <mask id="boundary-mask">
            <path d={cityBoundaryPath}/>
          </mask>
        </defs>

        <path className="boundary" d={cityBoundaryPath}/>
        <Contours features={contours.features}/>
        <Ways features={ways.features} selectedStreetName={selectedStreetName}/>
        {this.props.children()}
      </svg>
    );
  }
});
