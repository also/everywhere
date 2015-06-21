import * as React from 'react';


export default React.createClass({
  contextTypes: {
    path: React.PropTypes.any
  },

  render() {
    const {path} = this.context;
    const {features} = this.props;
    return (
      <g>
        {features.map((contour, i) => <path key={i} className="contour" d={path(contour)}/>)}
      </g>
    );
  }
});
