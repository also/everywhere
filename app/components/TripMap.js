import * as React from 'react';

import Trips from './Trips';
import MapComponent from './Map';


export default React.createClass({
  render() {
    return (
      <MapComponent width="1000" height="1000" {...this.props}>
        {this.layers}
      </MapComponent>
    );
  },

  layers() {
    const {trip} = this.props;
    return [
      <Trips trips={[trip]}/>
    ];
  }
});
