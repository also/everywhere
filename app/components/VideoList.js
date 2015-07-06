import * as React from 'react';
import {Link} from 'react-router';

import * as format from '../format';

export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <div className='thumbnails'>
        {videos.map(({name, duration, start, thumbnail}) => (
          <div key={name}>
            <Link to={`/videos/${name}`}>
              <div><img src={thumbnail.small} width="160" height="90"/></div>
              <div><strong>{start.format('LLL')}</strong></div>
              <div>{format.duration(duration)} <span className='name'>{name}</span></div>
            </Link>
          </div>
        ))}
      </div>
    );
  }
});
