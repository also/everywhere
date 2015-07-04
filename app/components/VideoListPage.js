import * as React from 'react';

import VideoList from './VideoList';
import Trips from './Trips';
import MapComponent from './Map';


export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <div>
        <MapComponent width="1000" height="1000">
          {this.mapLayers}
        </MapComponent>
        <VideoList videos={videos}/>
      </div>
    );
  },

  mapLayers() {
    const {videoCoverage} = this.props;
    return <Trips trips={videoCoverage}/>;
  }
});
