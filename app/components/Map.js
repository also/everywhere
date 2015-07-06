import * as React from 'react';
import d3 from 'd3';
import shallowEqual from 'react/lib/shallowEqual';

import Contours from './Contours';
import Ways from './Ways';


const BaseMap = React.createClass({
  contextTypes: {
    path: React.PropTypes.any,
    boundary: React.PropTypes.any.isRequired,
    ways: React.PropTypes.any,
    contours: React.PropTypes.any
  },

  // can't use PureRenderMixin because context :(
  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return !shallowEqual(this.props, nextProps) ||
           !shallowEqual(this.state, nextState) ||
           !shallowEqual(this.context, nextContext);
  },

  render() {
    const {boundary, path, contours, ways} = this.context;

    const cityBoundaryPath = path(boundary);

    return (
      <g>
        <defs>
          <mask id="boundary-mask">
            <path d={cityBoundaryPath}/>
          </mask>
        </defs>

        <path className="boundary" d={cityBoundaryPath}/>
        <Contours features={contours.features}/>
        <Ways features={ways.features}/>
      </g>
    );
  }
});


function mouse(e, node) {
  const previousEvent = d3.event;

  try {
    d3.event = e.nativeEvent;
    return d3.mouse(node);
  } finally {
    d3.event = previousEvent;
  }
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
    return this.recompute(this.props);
  },

  componentWillReceiveProps(nextProps) {
    this.setState(this.recompute(nextProps));
  },

  recompute(props) {
    const {width, height, zoomFeature, zoom} = props;
    const {boundary} = this.context;

    const projection = d3.geo.mercator()
      .scale(1)
      .translate([0, 0]);

    const path = d3.geo.path()
      .projection(projection);

    const boundsFeature = zoomFeature || boundary;

    const [[left, top], [right, bottom]] = path.bounds(boundsFeature);

    const s = Math.min(1 << 20, (zoom != null ? zoom : .98) / Math.max((right - left) / width, (bottom - top) / height));
    const t = [(width - s * (right + left)) / 2, (height - s * (bottom + top)) / 2];

    projection
      .scale(s)
      .translate(t);

    return {path, projection};
  },

  onMouseMove(e) {
    const {onMouseMove} = this.props;
    const {projection} = this.state;
    if (onMouseMove) {
      onMouseMove({mouse, geo: projection.invert(mouse(e, this.svgNode))});
    }
  },

  onClick(e) {
    const {onClick} = this.props;
    const {projection} = this.state;
    if (onClick) {
      onClick({mouse, geo: projection.invert(mouse(e, this.svgNode))});
    }
  },

  render() {
    const {boundary, ways, contours} = this.context;
    const {width, height} = this.props;
    const {path} = this.state;

    return (
      <svg width={width} height={height} onMouseMove={this.onMouseMove} onClick={this.onClick} ref={component => this.svgNode = React.findDOMNode(component)}>
        <BaseMap/>
        {this.props.children()}
      </svg>
    );
  }
});
