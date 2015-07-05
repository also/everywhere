import * as React from 'react';


export default React.createClass({
  contextTypes: {
    projection: React.PropTypes.any
  },

  render() {
    const {projection} = this.context;
    const {position, ...extraProps} = this.props;

    if (position) {
      const [x, y] = projection(position);
      return <circle cx={x} cy={y} {...extraProps}/>;
    } else {
      return null;
    }
  }
});
