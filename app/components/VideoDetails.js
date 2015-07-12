import * as React from 'react';
import {Navigation} from 'react-router';

import * as format from '../format';
import {findSeekPosition} from '../videos';
import {featureCollection} from '../geo';

import TripList from './TripList';
import VideoPlayer from './VideoPlayer';
import MapComponent from './Map';
import Trips from './Trips';
import Dot from './Dot';

const VideoAndMap = React.createClass({
  mixins: [Navigation],

  onClick({geo}) {
    const {video} = this.props;
    const seekPosition = findSeekPosition(video, geo);
    this.transitionTo(`/videos/${name}/${seekPosition}`);
  },

  getInitialState() {
    return {location: null};
  },

  onLocationChange(location) {
    this.setState({location});
  },

  render() {
    const {video, seek} = this.props;

    const {location=[0, 0]} = this.state;

    return (
      <span>
        <span style={{display: 'inline-block'}}><VideoPlayer video={video} seek={seek} onLocationChange={this.onLocationChange} ref='video'/></span>
        <span style={{display: 'inline-block', verticalAlign: 'top', marginLeft: '1em'}} className='map-box'>
          <MapComponent width={360} height={360} zoomFeature={featureCollection(video.coverage)} onClick={this.onClick}>{this.mapLayers}</MapComponent>
        </span>
      </span>
    );
  },

  mapLayers() {
    const {video} = this.props;
    const {location=[0, 0]} = this.state;
    return [<Trips trips={video.coverage}/>, <Dot r={4} className='position' position={location}/>];
  }
});


export default React.createClass({
  render() {
    const {video, seek} = this.props;

    return (
      <div>
        <h1>{video.name}</h1>
        <p>Taken <strong>{video.start.format('LLL')}</strong>, {format.duration(video.duration)} long</p>
        <VideoAndMap video={video} seek={seek}/>
        <h2>Trips</h2>
        <TripList trips={video.trips}/>
        <h2>Stills</h2>
        <div>{video.stills.map(({small, large}, i) => (
          <a href={large} key={i}><img src={large} width="320"/></a>
        ))}</div>
      </div>
    );
  }
});
