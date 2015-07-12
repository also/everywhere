import * as React from 'react';
import {Link} from 'react-router';

import MapComponent from './Map';
import Trips from './Trips';


export default React.createClass({
  render() {
    const {trips} = this.props;

    return (
      <div className='thumbnails'>
        {trips.map(trip => {
          const {properties: {id, start, videos}} = trip;
          return (
            <div key={id}>
              <Link to={`/trips/${id}`}>
              <MapComponent width={160} height={160} showWays={false}>{() => <Trips trips={[trip]}/>}</MapComponent>
              <div><strong>{start.format('LLL')}</strong></div>
              <div className='name'>{id}</div>
              <div>{videos.length > 0 ? <img src={videos[0].thumbnail.small} width="160" height="90"/> : null}</div>
              </Link>
            </div>
          );
        })}
      </div>
    );
  }
});
