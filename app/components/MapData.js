import * as React from 'react';

export default React.createClass({
  childContextTypes: {
    boundary: React.PropTypes.any,
    ways: React.PropTypes.any,
    contours: React.PropTypes.any,
  },

  getChildContext() {
    const { boundary, ways, contours } = this.props;
    return { boundary, ways, contours };
  },

  render() {
    return this.props.children();
  },
});
