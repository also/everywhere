import PropTypes from 'prop-types';
import * as React from 'react';

const Way = React.createClass({
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

export default React.createClass({
  render() {
    const { features, selected } = this.props;
    return (
      <g className="roads">
        {features.map((feature, i) => (
          <Way key={i} feature={feature} selected={selected} />
        ))}
      </g>
    );
  },
});
