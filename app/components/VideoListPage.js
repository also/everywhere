import * as React from 'react';

import VideoList from './VideoList';
import Trips from './Trips';
import MapComponent from './Map';


export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <div>
        <h1>Videos</h1>
        <MapComponent width="500" height="500">
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
