import * as React from 'react';
import {Link} from 'react-router';


export default React.createClass({
  render() {
    const {ways} = this.props;

    return (
      <ul>
        {ways.map(way => (
          <li key={way.name}><Link to={`/ways/${way.name}`}>{way.name || '(no name)'}</Link></li>
        ))}
      </ul>
    );
  }
});
