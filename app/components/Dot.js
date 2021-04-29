import * as React from 'react';
import createReactClass from 'create-react-class';

import MapContext from './MapContext';

export default createReactClass({
  render() {
    const { position, ...extraProps } = this.props;

    if (position) {
      return (
        <MapContext.Consumer>
          {({ projection }) => {
            const [x, y] = projection(position);
            return <circle cx={x} cy={y} {...extraProps} />;
          }}
        </MapContext.Consumer>
      );
    } else {
      return null;
    }
  },
});
