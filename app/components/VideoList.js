import * as React from 'react';
import {Link} from 'react-router';


export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <table>
        {videos.map(({name, duration, start, thumbnail}) => (
          <tr key={name}>
            <td><Link to={`/videos/${name}`}><img src={thumbnail.small} width="160" height="90"/></Link></td>
            <td>{start.toString()}</td>
            <td>{Math.round(duration / 60000)}</td>
            <td>{name}</td>
          </tr>
        ))}
      </table>
    );
  }
});
