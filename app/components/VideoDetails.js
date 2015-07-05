import * as React from 'react';

import TripList from './TripList';
import VideoPlayer from './VideoPlayer';


export default React.createClass({
  render() {
    const {video} = this.props;
    return (
      <div>
        <h1>{video.name}</h1>
        <p>Taken {video.start.toString()}, {Math.round(video.duration / 60000)} minutes long</p>
        <VideoPlayer video={video}/>
        <TripList trips={video.trips}/>
        <div>{video.stills.map(({small, large}, i) => (
          <a href={large} key={i}><img src={large} width="320"/></a>
        ))}</div>
      </div>
    );
  }
});
