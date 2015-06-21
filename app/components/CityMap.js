import * as React from 'react';

import StreetInfo from './StreetInfo';
import Position from './Position';
import Trips from './Trips';
import Contours from './Contours';
import Ways from './Ways';


export default React.createClass({
  childContextTypes: {
    projection: React.PropTypes.any,
    path: React.PropTypes.any
  },

  getChildContext() {
    const {projection, path} = this.props;
    return {projection, path};
  },

  getInitialState() {
    return {selectedStreetName: null};
  },

  selectStreet(selection) {
    console.log(selection);
    this.setState({selectedStreetName: selection && selection.label});
  },

  render() {
    const {boundary, path, ways, groupedWays, width, height, contours, trips, tripsLength, waysLength} = this.props;
    const {selectedStreetName} = this.state;
    const cityBoundaryPath = path(boundary);

    return (
      <div>
        <p>{Math.round(tripsLength / 1000)} / {Math.round(waysLength / 1000)} km</p>
        <StreetInfo ways={groupedWays} onSelectionChange={this.selectStreet}/>

        <svg width={width} height={height}>
          <defs>
            <mask id="boundary-mask">
              <path d={cityBoundaryPath}/>
            </mask>
          </defs>

          <path className="boundary" d={cityBoundaryPath}/>
          <Contours features={contours.features}/>
          <Ways features={ways.features} selectedStreetName={selectedStreetName}/>
          <Trips trips={trips}/>
          <Position/>
        </svg>
      </div>
    );
  }
});
