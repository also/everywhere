import * as React from 'react';

import StreetInfo from './StreetInfo';
import Position from './Position';
import Trips from './Trips';
import MapComponent from './Map';


export default React.createClass({
  getInitialState() {
    return {selectedStreetName: null};
  },

  selectStreet(selection) {
    console.log(selection);
    this.setState({selectedStreetName: selection && selection.name});
  },

  render() {
    const {groupedWays, tripsLength, waysLength} = this.props;
    const {selectedStreetName} = this.state;

    return (
      <div>
        <p>{Math.round(tripsLength / 1000)} / {Math.round(waysLength / 1000)} km</p>
        <StreetInfo ways={groupedWays} onSelectionChange={this.selectStreet}/>

        <MapComponent width="1000" height="1000" selectedStreetName={selectedStreetName}>
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
