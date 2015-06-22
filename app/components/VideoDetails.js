import * as React from 'react';

import TripList from './TripList';


export default React.createClass({
  render() {
    const {video} = this.props;
    return (
      <div>
        <h1>{video.name}</h1>
        <p>Taken {video.start.toString()}, {Math.round(video.duration / 60)} minutes long</p>
        <div><video src={video.low} controls="true" width="640" height="360"/></div>
        <TripList trips={video.trips}/>
        <div>{video.stills.map(({small, large}, i) => (
          <a href={large} key={i}><img src={large} width="320"/></a>
        ))}</div>
      </div>
    );
  }
});
