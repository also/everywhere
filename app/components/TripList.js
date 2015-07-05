import * as React from 'react';
import {Link} from 'react-router';


export default React.createClass({
  render() {
    const {trips, videoThumbnail} = this.props;

    return (
      <div>
        <h1>Trips</h1>
        <table>
          {trips.map(({features: [{properties: {id, start, videos}}]}) => (
            <tr key={id}>
              <td><Link to={`/trips/${id}`}>{id}</Link></td>
              <td>{start.toString()}</td>
              {videoThumbnail && <td>{videos.length > 0 ? <img src={videos[0].thumbnail.small} width="160" height="90"/> : 'no video'}</td>}
            </tr>
          ))}
        </table>
      </div>
    );
  }
});
