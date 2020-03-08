import PropTypes from 'prop-types';
import * as React from 'react';
import createReactClass from 'create-react-class';

export default createReactClass({
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
