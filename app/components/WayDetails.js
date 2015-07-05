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
        intersection.ways.forEach(iway => intersections.add(iway.properties.name));
      });
    });

    intersections.delete(way.name);

    return (
      <div>
        <h1>{way.name}</h1>
        <MapComponent width="400" height="400">
          {this.mapLayers}
        </MapComponent>
        <h2>Intersections</h2>
        {Array.from(intersections).sort().map(int => <p><Link key={int} to={`/ways/${int}`}>{int}</Link></p>)}
      </div>
    );
  },

  mapLayers() {
    const {way} = this.props;
    return <Ways features={way.features} selected={true}/>;
  }
});
