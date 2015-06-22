import * as React from 'react';
import {Link} from 'react-router';


function iteratorMap(it, fn) {
  function* gen() {
    for (const v of it) {
      yield fn(v);
    }
  }
  return gen();
}

export default React.createClass({
  render() {
    const {videos} = this.props;

    return (
      <table>
        {Array.from(iteratorMap(videos.values(), ({name, duration, start, thumbnail}) => (
          <tr key={name}>
            <td><Link to={`/videos/${name}`}><img src={thumbnail.small} width="160" height="90"/></Link></td>
            <td>{start.toString()}</td>
            <td>{Math.round(duration / 60)}</td>
            <td>{name}</td>
          </tr>
        )))}
      </table>
    );
  }
});
