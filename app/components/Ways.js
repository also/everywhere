import PropTypes from 'prop-types';
import * as React from 'react';
import createReactClass from 'create-react-class';

const Way = createReactClass({
  contextTypes: {
    path: PropTypes.any,
  },

  render() {
    const { path } = this.context;
    const { feature, selected } = this.props;
    const { highway, displayName, id } = feature.properties;
    const className = selected ? 'selected' : '';
    return (
      <path
        d={path(feature)}
        data-highway={highway}
        className={className}
        key={id}
      />
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
