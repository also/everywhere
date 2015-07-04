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
        .center([-71.11726545524994, 42.39685987297373])
        .scale(9000000)
        .translate([width / 2, height / 2]);

    const path = d3.geo.path()
        .projection(projection);

    return {path, projection};
  },

  onMouseMove(e) {
    const {onMouseMove} = this.props;
    if (onMouseMove) {
      const {projection} = this.state;

      const previousEvent = d3.event;

      try {
        d3.event = e.nativeEvent;
        const mouse = d3.mouse(this.svgNode);
        onMouseMove({mouse, geo: projection.invert(mouse)});
      } finally {
        d3.event = previousEvent;
      }
    }
  },

  render() {
    const {boundary, ways, contours} = this.context;
    const {width, height, selectedStreetName} = this.props;
    const {path} = this.state;
    const cityBoundaryPath = path(boundary);

    return (
      <svg width={width} height={height} onMouseMove={this.onMouseMove} ref={component => this.svgNode = React.findDOMNode(component)}>
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
