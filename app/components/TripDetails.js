import * as React from 'react';

import VideoList from './VideoList';
import Trips from './Trips';
import MapComponent from './Map';

export default React.createClass({
  render() {
    const {trip} = this.props;
    const {features: [{properties: {id, start, movingTime, videos}}]} = trip;
    return (
      <div>
        <h1>{id}</h1>
        <p>Started {start.toString()}, {Math.round(movingTime / 60)} minutes moving</p>
        <MapComponent width="1000" height="1000">
          {this.mapLayers}
        </MapComponent>
        <VideoList videos={videos}/>
      </div>
    );
  },

  mapLayers() {
    const {trip} = this.props;
    return [
      <Trips trips={[trip]}/>
    ];
  }
});
