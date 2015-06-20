import * as React from 'react';


export default React.createClass({
  render() {
    const {features, path} = this.props;
    return (
      <g>
        {features.map(contour => <path className="contour" d={path(contour)}/>)}
      </g>
    );
  }
});
