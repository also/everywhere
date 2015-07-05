import * as React from 'react';
import {Link} from 'react-router';

import * as format from '../format';

export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <div className='video-list'>
        {videos.map(({name, duration, start, thumbnail}) => (
          <div key={name}>
            <div><Link to={`/videos/${name}`}><img src={thumbnail.small} width="160" height="90"/></Link></div>
            <div><strong>{start.format('LLL')}</strong></div>
            <div>{format.duration(duration)} <span className='video-name'>{name}</span></div>
          </div>
        ))}
      </div>
    );
  }
});
