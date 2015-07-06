import * as React from 'react';

import * as format from '../format';

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
        <p>Taken <strong>{video.start.format('LLL')}</strong>, {format.duration(video.duration)} long</p>
        <span style={{display: 'inline-block'}}><VideoPlayer video={video}/></span>
        <span style={{display: 'inline-block', verticalAlign: 'top', marginLeft: '1em'}} className='map-box'>
          <MapComponent width={360} height={360} zoomFeature={featColl}>{this.mapLayers}</MapComponent>
        </span>
        <h2>Trips</h2>
        <TripList trips={video.trips}/>
        <h2>Stills</h2>
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
