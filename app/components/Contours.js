import * as React from 'react';
import createReactClass from 'create-react-class';

import MapContext from './MapContext';

export default createReactClass({
  render() {
    const { features } = this.props;
    return (
      <MapContext.Consumer>
        {({ path }) => (
          <g>
            {features.map((contour, i) => (
              <path key={i} className="contour" d={path(contour)} />
            ))}
          </g>
        )}
      </MapContext.Consumer>
    );
  },
});
