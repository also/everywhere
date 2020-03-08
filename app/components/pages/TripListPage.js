import React from 'react';
import createReactClass from 'create-react-class';

import TripList from '../TripList';

export default createReactClass({
  render() {
    return (
      <div>
        <h1>Trips</h1>
        <TripList {...this.props} />
      </div>
    );
  },
});
