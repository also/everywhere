import * as React from 'react';

import TripMap from './TripMap';
import VideoList from './VideoList';

export default React.createClass({
  render() {
    const {trip} = this.props;
    const {features: [{properties: {id, start, movingTime, videos}}]} = trip;
    return (
      <div>
        <h1>{id}</h1>
        <p>Started {start.toString()}, {Math.round(movingTime / 60)} minutes moving</p>
        <TripMap trip={trip}/>
        <VideoList videos={videos}/>
      </div>
    );
  }
});
