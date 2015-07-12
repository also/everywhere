import * as React from 'react';
import {Link} from 'react-router';

import MapComponent from './Map';
import Ways from './Ways';


export default React.createClass({
  render() {
    const {way} = this.props;
    const intersections = new Set();

    way.features.forEach(feat => {
      feat.intersections.forEach(intersection => {
        intersection.ways.forEach(iway => intersections.add(iway.properties.displayName));
      });
    });

    const featColl = {
      type: 'FeatureCollection',
      features: way.features
    };

    intersections.delete(way.displayName);

    return (
      <div>
        <h1>{way.displayName}</h1>
        <div className='map-box'>
          <MapComponent width={400} height={400} zoomFeature={featColl} zoom={0.7}>
            {this.mapLayers}
          </MapComponent>
        </div>
        <h2>Intersections</h2>
        <ul style={{WebkitColumnWidth: '200px'}}>
        {Array.from(intersections).sort().map(int => <li><Link key={int} to={`/ways/${int}`}>{int}</Link></li>)}
        </ul>
      </div>
    );
  },

  mapLayers() {
    const {way} = this.props;
    return <Ways features={way.features} selected={true}/>;
  }
});
