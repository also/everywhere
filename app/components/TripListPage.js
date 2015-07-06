import React from 'react';

import TripList from './TripList';


export default React.createClass({
  render() {
    return (
      <div>
        <h1>Trips</h1>
        <TripList {...this.props}/>
      </div>
    );
  }
});
