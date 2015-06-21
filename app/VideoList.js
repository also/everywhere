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
      <ul>
        {Array.from(iteratorMap(videos.values(), ({name}) => (
          <li key={name}><Link to={`/videos/${name}`}>{name}</Link></li>
        )))}
      </ul>
    );
  }
});
