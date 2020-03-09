import React from 'react';
import createReactClass from 'create-react-class';

import PageTitle from '../PageTitle';
import TripList from '../TripList';

export default createReactClass({
  render() {
    return (
      <div>
        <PageTitle>Trips</PageTitle>
        <TripList {...this.props} />
      </div>
    );
  },
});
