import * as React from 'react';

import TripList from './TripList';
import VideoPlayer from './VideoPlayer';
import MapComponent from './Map';
import Trips from './Trips';


export default React.createClass({
  render() {
    const {video} = this.props;
    const featColl = {
      type: 'FeatureCollection',
      features: video.coverage.map(({features: [feature]}) => feature)
    };

    return (
      <div>
        <h1>{video.name}</h1>
        <p>Taken {video.start.toString()}, {Math.round(video.duration / 60000)} minutes long</p>
        <span style={{display: 'inline-block'}}><VideoPlayer video={video}/></span>
        <span style={{display: 'inline-block', verticalAlign: 'top'}}>
          <MapComponent width={360} height={360} zoomFeature={featColl}>{this.mapLayers}</MapComponent>
        </span>
        <TripList trips={video.trips}/>
        <div>{video.stills.map(({small, large}, i) => (
          <a href={large} key={i}><img src={large} width="320"/></a>
        ))}</div>
      </div>
    );
  },

  mapLayers() {
    const {video} = this.props;
    return <Trips trips={video.coverage}/>;
  }
});
