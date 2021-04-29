import PropTypes from 'prop-types';
import * as React from 'react';
import createReactClass from 'create-react-class';
import MapContext from './MapContext';

const Way = createReactClass({
  render() {
    const { feature, selected } = this.props;
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
  },
});

export default function Ways({ features, selected }) {
  return (
    <g className="roads">
      {features.map((feature, i) => (
        <Way key={i} feature={feature} selected={selected} />
      ))}
    </g>
  );
}
