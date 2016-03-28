import * as React from 'react';
import {Navigation} from 'react-router';

import Position from '../Position';
import Trips from '../Trips';
import MapComponent from '../Map';


export default React.createClass({
  mixins: [Navigation],

  onClick({geo}) {
    this.transitionTo(`/locations/${geo.join(',')}`);
  },

  render() {
    const {tripsLength, waysLength} = this.props;

    return (
      <div>
        <p>{Math.round(tripsLength / 1000)} / {Math.round(waysLength / 1000)} km</p>

        <MapComponent width="1000" height="1000" onClick={this.onClick}>
          {this.layers}
        </MapComponent>
      </div>
    );
  },

  layers() {
    const {trips} = this.props;
    return [
      <Trips trips={trips}/>,
      <Position/>
    ];
  }
});
