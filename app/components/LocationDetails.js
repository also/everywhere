import React from 'react/addons';
import {Link, Navigation} from 'react-router';

import * as format from '../format';
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
    const {location, tripTree, videoTree} = this.props;
    const maxDistance = 0.0000005;

    const nearbyWays = wayTree.within(location, maxDistance).map(({node: {data: {feature}}}) => feature);
    const nearbyGroupedWays = group(nearbyWays);
    const nearbyTrips = Array.from(new Set(tripTree.within(location, maxDistance).map(({node: {data: {feature}}}) => feature))).map(feature => ({type: 'FeatureCollection', features: [feature]}));

    const nearbyVideoCoverageByName = new Map();
    videoTree.within(location, maxDistance).forEach(result => {
      const name = result.node.data.feature.properties.video;
      const current = nearbyVideoCoverageByName.get(name);
      if (!current || result.distance < current.distance) {
        nearbyVideoCoverageByName.set(name, result);
      }
    });

    const nearbyVideos = Array.from(nearbyVideoCoverageByName.values()).map(({node, distance}) => {
      const {data: {feature: {properties: {start, video}}}, coordinates: [coord]} = node;
      const [,,, timeOffsetSecs] = coord;
      const time = +start.clone().add(timeOffsetSecs, 's');
      return {video, time, distance};
    });

    return (
      <div>
        <h1>{location.join(', ')}</h1>
        <MapComponent width={1000} height={1000} onClick={this.onClick}>
          {() => [
            <Ways features={nearbyWays} selected={true}/>,
            <Dot r={4} className='position' position={this.props.location}/>
          ]}
        </MapComponent>
        <h2>Videos</h2>
        <div className='thumbnails'>
          {nearbyVideos.map(({video: {name, duration, start, thumbnail}, time}) => (
            <div key={name}>
              <Link to={`/videos/${name}/${time}`}>
                <div><img src={thumbnail.small} width="160" height="90"/></div>
                <div><strong>{start.format('LLL')}</strong></div>
                <div>{format.duration(duration)} <span className='name'>{name}</span></div>
              </Link>
            </div>
          ))}
        </div>
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
