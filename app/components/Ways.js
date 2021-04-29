import * as React from 'react';
import MapContext from './MapContext';

function Way({ feature, selected }) {
  const { highway, displayName, id } = feature.properties;
  const className = selected ? 'selected' : '';
  return (
    <MapContext.Consumer>
      {({ path }) => (
        <path
          d={path(feature)}
          data-highway={highway}
          className={className}
          key={id}
        />
      )}
    </MapContext.Consumer>
  );
}

export default function Ways({ features, selected }) {
  return (
    <g className="roads">
      {features.map((feature, i) => (
        <Way key={i} feature={feature} selected={selected} />
      ))}
    </g>
  );
}
