import * as React from 'react';
import {Link} from 'react-router';


export default React.createClass({
  render() {
    const {trips} = this.props;

    return (
      <table>
        {trips.map(({features: [{properties: {id, start}}]}) => (
          <tr key={id}>
            <td><Link to={`/trips/${id}`}>{id}</Link></td>
            <td>{start.toString()}</td>
          </tr>
        ))}
      </table>
    );
  }
});
