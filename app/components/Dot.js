import PropTypes from 'prop-types';
import * as React from 'react';
import createReactClass from 'create-react-class';

export default createReactClass({
  contextTypes: {
    projection: PropTypes.any,
  },

  render() {
    const { projection } = this.context;
    const { position, ...extraProps } = this.props;

    if (position) {
      const [x, y] = projection(position);
      return <circle cx={x} cy={y} {...extraProps} />;
    } else {
      return null;
    }
  },
});
