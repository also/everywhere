import PropTypes from 'prop-types';
import * as React from 'react';

export default React.createClass({
  contextTypes: {
    path: PropTypes.any,
  },

  render() {
    const { path } = this.context;
    const { features } = this.props;
    return (
      <g>
        {features.map((contour, i) => (
          <path key={i} className="contour" d={path(contour)} />
        ))}
      </g>
    );
  },
});
