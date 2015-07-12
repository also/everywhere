import React from 'react/addons';
import {Link, Navigation} from 'react-router';

import {wayTree, group} from '../ways';

import MapComponent from './Map';
import Dot from './Dot';
import Ways from './Ways';
import TripList from './TripList';

export default React.createClass({
  mixins: [Navigation],

  onClick({geo}) {
    this.transitionTo(`/locations/${geo.join(',')}`);
  },

  render() {
    const {location, tripTree} = this.props;
    const nearbyWays = wayTree.within(location, 0.0000005).map(({node: {data: {feature}}}) => feature);
    const nearbyGroupedWays = group(nearbyWays);
    const nearbyTrips = Array.from(new Set(tripTree.within(location, 0.0000005).map(({node: {data: {feature}}}) => feature))).map(feature => ({type: 'FeatureCollection', features: [feature]}));
    return (
      <div>
        <h1>{location.join(', ')}</h1>
        <MapComponent width={1000} height={1000} onClick={this.onClick}>
          {() => [
            <Ways features={nearbyWays} selected={true}/>,
            <Dot r={4} className='position' position={this.props.location}/>
          ]}
        </MapComponent>
        <h2>Trips</h2>
        <TripList trips={nearbyTrips}/>
        <h2>Streets</h2>
        <div className='thumbnails'>
          {nearbyGroupedWays.map(way => (
            <div key={way.name}>
              <Link to={`/ways/${way.name}`}>
                <MapComponent width={160} height={160} zoomFeature={{type: 'FeatureCollection', features: way.features}}>{() => <Ways features={way.features} selected={true}/>}</MapComponent>
                <div><strong>{way.name || '(no name)'}</strong></div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    );
  }
});
