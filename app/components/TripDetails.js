import * as React from 'react';

import * as format from '../format';

import VideoList from './VideoList';
import Trips from './Trips';
import MapComponent from './Map';
import Dot from './Dot';

export default React.createClass({
  getInitialState() {
    return {nearest: null};
  },

  onMouseMove({geo}) {
    const {trip} = this.props;
    const {features: [{properties: {tree}}]} = trip;
    const nearest = tree.nearest(geo);
    this.setState({nearest});
  },

  render() {
    const {trip} = this.props;
    const {features: [{properties: {id, start, movingTime, videos}}]} = trip;
    return (
      <div>
        <h1>{id}</h1>
        <p>Started <strong>{start.format('LLL')}</strong>, {format.duration(movingTime)} moving</p>
        <MapComponent width="500" height="500" onMouseMove={this.onMouseMove}>
          {this.mapLayers}
        </MapComponent>

        <h2>Videos</h2>
        <VideoList videos={videos}/>
      </div>
    );
  },

  mapLayers() {
    const {trip} = this.props;
    const {nearest} = this.state;

    let dot = null;
    if (nearest) {
      const {coordinates: [position]} = nearest;
      dot = <Dot position={position} r={4} className='position'/>;
    }
    return [
      <Trips trips={[trip]}/>,
      dot
    ];
  }
});
