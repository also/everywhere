import {
  useContext,
  useEffect,
  useState,
  useRef,
  MouseEvent,
  memo,
  PropsWithChildren,
} from 'react';
import d3 from 'd3';
import { Feature, FeatureCollection } from 'geojson';
import styled from 'styled-components';

import MapContext from './MapContext';
import Contours from './Contours';
import Ways from './Ways';
import DataContext from './DataContext';

const BaseMap = memo(function BaseMap({
  showWays,
  showContours,
}: {
  showWays: boolean;
  showContours: boolean;
}) {
  const { contours, boundary, ways } = useContext(DataContext);
  const { path } = useContext(MapContext);

  return (
    <g>
      <path className="boundary" d={path(boundary)} />
      {showContours && <Contours features={contours.features} />}
      {showWays ? <Ways features={ways.features} /> : null}
    </g>
  );
});

function mouse(e: MouseEvent<SVGElement>, node: Element) {
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

    &.loading-animation {
      opacity: 0.3;

      path {
        stroke-dashoffset: 1000;
        stroke-dasharray: 100;
        animation: dash 10s linear;
      }

      @keyframes dash {
        to {
          stroke-dashoffset: 0;
        }
      }
    }
  }
`;

function compute({
  width,
  height,
  zoomFeature,
  zoom,
  boundary,
}: {
  width: number;
  height: number;
  zoomFeature?: Feature | FeatureCollection;
  zoom?: number;
  boundary: Feature;
}) {
  const projection: d3.geo.InvertibleProjection = d3.geo
    .mercator()
    .scale(1)
    .translate([0, 0]) as any;

  const path = d3.geo.path().projection(projection);

  const boundsFeature = zoomFeature || boundary;

  const [[left, top], [right, bottom]] = path.bounds(boundsFeature);

  const s = Math.min(
    1 << 20,
    (zoom != null ? zoom : 0.98) /
      Math.max((right - left) / width, (bottom - top) / height)
  );

  projection
    .scale(s)
    .translate([
      (width - s * (right + left)) / 2,
      (height - s * (bottom + top)) / 2,
    ]);

  return { path, projection };
}

export type MapMouseEvent = {
  mouse: typeof mouse;
  geo: [number, number];
};

export type MapMouseHandler = (v: MapMouseEvent) => any;

export default function Map({
  width,
  height,
  zoomFeature,
  zoom,
  showWays = true,
  showContours = false,
  onMouseMove,
  onClick,
  children,
  asLoadingAnimation = false,
}: PropsWithChildren<{
  width: number;
  height: number;
  zoomFeature?: Feature | FeatureCollection;
  zoom?: number;
  showWays?: boolean;
  showContours?: boolean;
  onMouseMove?: MapMouseHandler;
  onClick?: MapMouseHandler;
  asLoadingAnimation?: boolean;
}>) {
  const { boundary } = useContext(DataContext);
  const [mapContext, setMapContext] = useState(() =>
    compute({ width, height, zoomFeature, zoom, boundary })
  );

  useEffect(() => {
    setMapContext(compute({ width, height, zoomFeature, zoom, boundary }));
  }, [width, height, zoomFeature, zoom, boundary]);

  const svgNode = useRef<SVGSVGElement>(null);

  return (
    <MapContext.Provider value={mapContext}>
      <MapSvg
        className={asLoadingAnimation ? 'loading-animation' : undefined}
        width={width}
        height={height}
        onMouseMove={
          onMouseMove
            ? (e) =>
                onMouseMove({
                  mouse,
                  geo: mapContext.projection.invert(mouse(e, svgNode.current!)),
                })
            : undefined
        }
        onClick={
          onClick
            ? (e) =>
                onClick({
                  mouse,
                  geo: mapContext.projection.invert(mouse(e, svgNode.current!)),
                })
            : undefined
        }
        ref={svgNode}
      >
        <BaseMap showWays={showWays} showContours={showContours} />
        {typeof children === 'function' ? children() : children}
      </MapSvg>
    </MapContext.Provider>
  );
}
