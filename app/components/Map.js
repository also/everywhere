import PropTypes from 'prop-types';
import { findDOMNode } from 'react-dom';
import createReactClass from 'create-react-class';
import d3 from 'd3';
import shallowEqual from 'fbjs/lib/shallowEqual';
import omit from 'lodash/object/omit';
import styled from 'styled-components';
import MapContext from './MapContext';

import Contours from './Contours';

import Ways from './Ways';

const BaseMap = createReactClass({
  contextTypes: {
    boundary: PropTypes.any.isRequired,
    ways: PropTypes.any,
    contours: PropTypes.any,
  },

  // can't use PureRenderMixin because context :(
  shouldComponentUpdate(nextProps, nextState, nextContext) {
    return (
      !shallowEqual(this.props, nextProps) ||
      !shallowEqual(this.state, nextState) ||
      !shallowEqual(this.context, nextContext)
    );
  },

  render() {
    const { boundary, contours, ways } = this.context;
    const { showWays } = this.props;

    return (
      <g>
        <MapContext.Consumer>
          {({ path }) => <path className="boundary" d={path(boundary)} />}
        </MapContext.Consumer>
        {/*<Contours features={contours.features}/>*/}
        {showWays ? <Ways features={ways.features} /> : null}
      </g>
    );
  },
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

const MapSvg = styled.svg`
  & {
    .roads {
      path {
        fill: none;
        stroke-width: 1px;
        stroke: #fff;

        &.selected {
          stroke-width: 5px;
          stroke: #116aa9;
        }
      }

      [data-highway='secondary'],
      [data-highway='trunk'] {
        stroke-width: 2px;
      }
    }

    path.boundary {
      fill: #00dcc2;
    }

    path.trip {
      fill: none;
      stroke-width: 1.5px;
      stroke: #888;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    path.contour {
      fill: none;
      stroke-width: 1px;
      stroke: lighten(#00dcc2, 3%);
    }

    circle.position {
      fill: #fff;
      stroke-width: 1px;
      stroke: #116aa9;
    }

    path.extent {
      fill: none;
      stroke: #333;
      shape-rendering: crispEdges;
    }
  }
`;

export default createReactClass({
  contextTypes: {
    boundary: PropTypes.any.isRequired,
    ways: PropTypes.any,
    contours: PropTypes.any,
  },

  getInitialState() {
    return this.recompute(this.props);
  },

  componentWillReceiveProps(nextProps) {
    if (
      !shallowEqual(omit(nextProps, 'children'), omit(this.props, 'children'))
    ) {
      this.setState(this.recompute(nextProps));
    }
  },

  recompute(props) {
    const { width, height, zoomFeature, zoom } = props;
    const { boundary } = this.context;

    const projection = d3.geo
      .mercator()
      .scale(1)
      .translate([0, 0]);

    const path = d3.geo.path().projection(projection);

    const boundsFeature = zoomFeature || boundary;

    const [[left, top], [right, bottom]] = path.bounds(boundsFeature);

    const s = Math.min(
      1 << 20,
      (zoom != null ? zoom : 0.98) /
        Math.max((right - left) / width, (bottom - top) / height)
    );
    const t = [
      (width - s * (right + left)) / 2,
      (height - s * (bottom + top)) / 2,
    ];

    projection.scale(s).translate(t);

    return { mapContext: { path, projection } };
  },

  onMouseMove(e) {
    const { onMouseMove } = this.props;
    const {
      mapContext: { projection },
    } = this.state;
    if (onMouseMove) {
      onMouseMove({ mouse, geo: projection.invert(mouse(e, this.svgNode)) });
    }
  },

  onClick(e) {
    const { onClick } = this.props;
    const {
      mapContext: { projection },
    } = this.state;
    if (onClick) {
      onClick({ mouse, geo: projection.invert(mouse(e, this.svgNode)) });
    }
  },

  render() {
    const { width, height, showWays = true, children } = this.props;
    const { mapContext } = this.state;

    return (
      <MapContext.Provider value={mapContext}>
        <MapSvg
          width={width}
          height={height}
          onMouseMove={this.onMouseMove}
          onClick={this.onClick}
          ref={component => (this.svgNode = findDOMNode(component))}
        >
          <BaseMap showWays={showWays} />
          {typeof children === 'function' ? children() : children}
        </MapSvg>
      </MapContext.Provider>
    );
  },
});
