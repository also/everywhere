import PropTypes from 'prop-types';
import * as React from 'react';
import createReactClass from 'create-react-class';

export default createReactClass({
  childContextTypes: {
    boundary: PropTypes.any,
    ways: PropTypes.any,
    contours: PropTypes.any,
  },

  getChildContext() {
    const { boundary, ways, contours } = this.props;
    return { boundary, ways, contours };
  },

  render() {
    return this.props.children();
  },
});
